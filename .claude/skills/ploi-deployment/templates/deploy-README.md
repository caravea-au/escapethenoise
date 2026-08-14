# [project-name]: Deployment Runbook

Both environments live on one Ploi-managed Ubuntu box, each as **two Ploi sites** (Next.js frontend
+ Strapi backend), reverse-proxied by nginx to a local port.

> **The box address is deliberately not in this file.** SSH host, user and IP live in the Obsidian
> vault only (`Shared/ploi-fleet.md` + `Brain/<slug>/ploi-deployment-target.md`), never in the repo.
> `/deployment` reads them from there.

| Env | Site | Serves | Local port | pm2 process | Directory on server | Branch |
|-----|------|--------|-----------|-------------|---------------------|--------|
| prod | `[frontend-domain]` | `frontend/` (Next.js via `app.js`) | `[frontend-port]` | `[frontend-pm2]` | `/home/ploi/[frontend-domain]` | `main` |
| prod | `[cms-domain]` | `backend/` (Strapi 5) | `[backend-port]` | `[backend-pm2]` | `/home/ploi/[cms-domain]` | `main` |
| staging | `[staging-frontend-domain]` | `frontend/` | `[staging-frontend-port]` | `[staging-frontend-pm2]` | `/home/ploi/[staging-frontend-domain]` | `staging` |
| staging | `[staging-cms-domain]` | `backend/` | `[staging-backend-port]` | `[staging-backend-pm2]` | `/home/ploi/[staging-cms-domain]` | `staging` |

Ports are **not arbitrary**: Ploi already wrote them into each site's nginx `proxy_pass`, so the
deploy scripts must match. Check `ss -tlnp` on the box, and the fleet port table in the vault, before
adding another site.

**Deploy flow:** push to `main`/`staging` → GitHub Action
([`.github/workflows/ploi-deploy.yml`](../../.github/workflows/ploi-deploy.yml)) detects which
workspace changed → `POST`s the matching **Ploi deploy webhook** for that environment (chosen by
branch) → [`.github/scripts/ploi-deploy.sh`](../../.github/scripts/ploi-deploy.sh) polls `ping_url`
until the deploy reaches a terminal status → Ploi runs that site's **Deploy Script** on the server
(`git reset --hard` → `npm ci` → build → `pm2` restart).

Change detection: `frontend/**` or `app.js` → frontend only · `backend/**` → backend only · root
`package.json` / `package-lock.json` → both · `backend/public/uploads/**` → neither (media is
server-side state, not code). `workflow_dispatch` forces either side manually.

**Turn off Ploi's own auto-deploy-on-push for all four sites.** GitHub Actions must be the only
thing deciding which webhook fires, or a single push deploys twice concurrently.

## GitHub repo secrets

Never committed. Copy each URL from Ploi panel → Site → Repository tab.

| | Frontend webhook | Backend webhook |
|-|-|-|
| prod (`main`) | `PLOI_FRONTEND_DEPLOY_WEBHOOK` | `PLOI_BACKEND_DEPLOY_WEBHOOK` |
| staging (`staging`) | `STAGING_PLOI_FRONTEND_DEPLOY_WEBHOOK` | `STAGING_PLOI_BACKEND_DEPLOY_WEBHOOK` |

Pushing a change under `.github/workflows/**` needs the `workflow` OAuth scope:
`gh auth refresh -h github.com -s workflow`. Without it the push is rejected outright.

## Deploy scripts

Paste each into that Ploi site's **Deploy Script** field:

| Site | Script |
|------|--------|
| `[frontend-domain]` | [`prod-frontend-deploy.sh`](./prod-frontend-deploy.sh) |
| `[cms-domain]` | [`prod-backend-deploy.sh`](./prod-backend-deploy.sh) |
| `[staging-frontend-domain]` | [`staging-frontend-deploy.sh`](./staging-frontend-deploy.sh) |
| `[staging-cms-domain]` | [`staging-backend-deploy.sh`](./staging-backend-deploy.sh) |

## DNS

Every host needs an A record pointing at the box before its certificate can be issued.

```
[frontend-domain]        A   <box ip — see the vault>
www.[frontend-domain]    A   <box ip>   (the vhost 301s www -> apex)
[cms-domain]             A   <box ip>
```

During a cutover never trust a bare `curl` against the hostname — pin it to the box and cross-check
with an external resolver:

```bash
nslookup [frontend-domain] 8.8.8.8
curl -sI --resolve '[frontend-domain]:443:<box ip>' https://[frontend-domain]
```

## SSL

Ploi requests certs with certbot's `webroot` plugin pointed at `<site>/public`, but every vhost on
the box serves the challenge from a different path:

```nginx
location ~ /.well-known/acme-challenge {
    allow all;
    root /var/www/html;
}
```

So certbot writes to `<site>/public/.well-known/…` while nginx reads `/var/www/html/.well-known/…`.
Installing this monorepo into the site root also replaces the `public/` directory Ploi scaffolds
(the repo has no root-level `public/`, only `frontend/public/`). Fix: make `public` a **symlink** so
both halves resolve to one directory.

```bash
# once per server (needs root — run via the Ploi dashboard, the ploi user's sudo is password-prompted)
sudo mkdir -p /var/www/html && sudo chmod 755 /var/www/html

# once per site, as ploi
for d in [frontend-domain] [cms-domain] [staging-frontend-domain] [staging-cms-domain]; do
  ln -sfn /var/www/html "/home/ploi/$d/public"
done
```

Then request the Let's Encrypt certificate in Ploi, **one site at a time** — certbot holds a global
lock. Each deploy script re-creates the symlink defensively, because a **dangling** symlink fails
exactly like a missing directory and would silently break the 60-day renewal, not just issuance.

## Environment variables

Set on the server, per site. `.env` is git-ignored and is a hard prerequisite of the **first**
deploy. See [`env.backend.template`](./env.backend.template) and
[`env.frontend.template`](./env.frontend.template). Generate every secret with
`openssl rand -base64 32`; **staging secrets must differ from production**.

## First bring-up (one-time, per environment)

1. **Env files first**, backend before frontend.
2. **First build + start** over SSH (backend first, so the CMS is up when Next builds):
   ```bash
   cd /home/ploi/[cms-domain]
   npm ci --no-audit --no-fund
   npm run clean --workspace=backend && npm run build:backend
   pm2 start npm --name [backend-pm2] -- run start --workspace=backend

   cd /home/ploi/[frontend-domain]
   npm ci --no-audit --no-fund
   npm run build --workspace=frontend
   PORT=[frontend-port] pm2 start npm --name [frontend-pm2] -- start
   pm2 save
   ```
3. **Deploy Script**: paste the matching script into each Ploi site.
4. **nginx**: each frontend/CMS vhost's `location /` must be a reverse proxy to its port, not Ploi's
   default PHP template. A vhost reset to the PHP template serves 403.
5. **DNS + SSL**: above.
6. **CMS first-run**: create the admin user, then Settings → API Tokens → a **custom read-only**
   token into `frontend/.env` as `STRAPI_API_TOKEN`, then
   `pm2 restart [frontend-pm2] --update-env`.
7. **Content**: Strapi Transfer, never git. See `docs/STRAPI-CONTENT-MIGRATION.md`.
8. **Keep staging out of search**: the staging vhosts should send `X-Robots-Tag: noindex, nofollow`.

## Ops cheatsheet (SSH as `ploi`)

```bash
pm2 list                                  # process status (all sites on the box)
pm2 logs [frontend-pm2]                   # frontend logs
pm2 restart [frontend-pm2] --update-env   # restart after an .env change
curl -I http://localhost:[frontend-port]  # healthcheck, bypassing nginx
curl -I http://localhost:[backend-port]/admin
ss -tlnp                                  # what is bound where, before adding a site
```

- `sudo` for the `ploi` user is password-prompted, so non-interactive SSH cannot use it. Anything
  privileged (nginx, `/var/www/html`, `pm2 startup`) goes through the Ploi dashboard.
- **Boot persistence:** pm2 may not resurrect after a reboot. Run `pm2 startup` once (needs sudo),
  follow its printed command, then `pm2 save`.
- `better-sqlite3` throwing `NODE_MODULE_VERSION` after a Node change:
  `cd backend && npm rebuild better-sqlite3`.
- A CMS edit not appearing after a redeploy is the fetch-cache, not the deploy. The scripts clear it
  at build time; flush the running server on demand:
  ```bash
  curl -X POST http://127.0.0.1:[frontend-port]/api/revalidate \
    -H "x-revalidate-secret: $(grep ^REVALIDATE_SECRET= frontend/.env | cut -d= -f2-)" \
    -H 'content-type: application/json' -d '{"paths":["/"]}'
  ```
