# Deployment — escapethenoise / No Better Time

Two environments, each **two Ploi sites** on one Ubuntu box: the Next.js frontend and the Strapi CMS,
the same monorepo cloned twice into `/home/ploi/<domain>`. nginx reverse-proxies each domain to a
local port.

The box address, SSH user, webhook URLs and every secret value live in the Obsidian vault
(`Shared/ploi-fleet.md` and `Brain/escapethenoise/ploi-deployment-target.md`), never here. This
directory carries domain, directory, port and pm2 name only.

## Topology

| Env | Domain | Serves | Port | pm2 name | Directory | Branch |
|---|---|---|---|---|---|---|
| prod | `nobettertime.com.au` | frontend | 3004 | `escapethenoise-tempcaraveadev` | `/home/ploi/nobettertime.com.au` | `main` |
| prod | `cms.nobettertime.com.au` | backend | 1340 | `cms-escapethenoise-tempcaraveadev` | `/home/ploi/cms.nobettertime.com.au` | `main` |
| staging | `staging.nobettertime.com.au` | frontend | 3010 | `staging-nobettertimecomau` | `/home/ploi/staging.nobettertime.com.au` | `staging` |
| staging | `staging-cms.nobettertime.com.au` | backend | 1345 | `staging-cmsnobettertimecomau` | `/home/ploi/staging-cms.nobettertime.com.au` | `staging` |

**The production pm2 names are the old pre-rename slug on purpose.** The site moved from
`escapethenoise-temp.caravea.dev` to `nobettertime.com.au` on 2026-07-01 and the processes were left
registered under the old name. Staging uses the normal convention because those processes are new.

**Ports are owned by nginx, not by these scripts.** Ploi wrote `proxy_pass http://localhost:<port>`
into the vhost when each site was created, so a deploy script must match the vhost. To read the real
map, on the box:

```bash
for f in /etc/nginx/sites-enabled/*; do
  echo "$(basename "$f") -> $(grep -hoE 'proxy_pass http://localhost:[0-9]+' "$f" | grep -oE '[0-9]+$' | head -1)"
done
```

`ss -tlnp` is not a substitute: a site Ploi has created but never deployed holds its port in the vhost
while binding nothing, so a live port scan makes a taken port look free.

## How a deploy actually happens

1. You push to `main` or `staging`.
2. `.github/workflows/ploi-deploy.yml` works out which workspace changed and fires that site's Ploi
   deploy webhook.
3. `.github/scripts/ploi-deploy.sh` polls the returned `ping_url` until the deploy reaches a terminal
   status, and fails the job if the deploy failed.
4. Ploi runs the site's **Deploy Script**, which is the copy pasted into the panel — **not** the copy
   in this directory.

That last point is the one that bites. The `*.sh` files here are documentation of what should be in
the panel. Editing one and committing it deploys nothing; you must paste it into
**Ploi panel → Site → Deploy Script** as well.

| File | Paste into |
|---|---|
| `staging-frontend-deploy.sh` | Site `staging.nobettertime.com.au` → Deploy Script |
| `staging-backend-deploy.sh` | Site `staging-cms.nobettertime.com.au` → Deploy Script |
| `main-frontend-deploy.sh` | Site `nobettertime.com.au` → Deploy Script |
| `main-backend-deploy.sh` | Site `cms.nobettertime.com.au` → Deploy Script |

**Turn Ploi's own auto-deploy-on-push OFF for all four sites.** The GitHub Action must be the only
trigger, or one push runs two concurrent deploys in the same directory.

## Secrets

GitHub repo secrets (Settings → Secrets and variables → Actions). Each value is the deploy webhook URL
from **Ploi panel → Site → Repository tab**.

| Secret | Site |
|---|---|
| `PLOI_FRONTEND_DEPLOY_WEBHOOK` | `nobettertime.com.au` |
| `PLOI_BACKEND_DEPLOY_WEBHOOK` | `cms.nobettertime.com.au` |
| `STAGING_PLOI_FRONTEND_DEPLOY_WEBHOOK` | `staging.nobettertime.com.au` |
| `STAGING_PLOI_BACKEND_DEPLOY_WEBHOOK` | `staging-cms.nobettertime.com.au` |

Pushing any change under `.github/workflows/**` needs `gh auth refresh -h github.com -s workflow`
first, or the push is rejected.

## Server .env

Two files per environment, both git-ignored and written directly on the box with mode 600. See
`env.backend.template` and `env.frontend.template` for the annotated contents.

- `<cms-dir>/backend/.env` — must exist **before the first build**, not just the first start:
  `strapi ts:generate-types` boots Strapi's register phase and fails the build with
  `Missing admin.auth.secret configuration` without it.
- `<frontend-dir>/frontend/.env` — note the path is `frontend/.env`, not the repo root. Must exist
  before the first `next build`, because `NEXT_PUBLIC_*` values are inlined into the bundle.

Generate secrets on the server with `openssl rand -base64 32` (`APP_KEYS` is four, comma-joined).
Staging secrets must differ from production.

### Two things specific to this project

- **SMTP is not an env var.** It lives in a Strapi "SMTP Settings" single type, i.e. in the database.
  A content transfer therefore carries working production mail credentials into the target
  environment. After any prod → staging transfer, turn `smtp_settings.enabled` off in the staging
  admin before testing a form, or staging submissions email the real inbox.
- **DigitalOcean Spaces is one shared multi-tenant bucket.** Production writes under the
  `nobettertime` root path. Staging must use a different prefix, or leave `DO_SPACE_ENDPOINT` blank
  for local-disk uploads.

## DNS

One A record per domain, pointed at the box. Verify against public DNS rather than a bare `curl`,
which lies during a cutover:

```bash
nslookup staging.nobettertime.com.au 8.8.8.8
curl -sI --resolve 'staging.nobettertime.com.au:443:<box-ip>' https://staging.nobettertime.com.au
```

## SSL

Certbot writes ACME challenges to `<site>/public/.well-known/`, but every vhost on this box serves
that path from `/var/www/html`. Installing the monorepo replaces the `public/` directory Ploi
scaffolded, so the two have to be joined by a symlink:

```bash
cd /home/ploi/<domain>
[ -e public/. ] || ln -sfn /var/www/html public
```

Every deploy script re-asserts this. Test with `-e public/.`, **not** `-L public`: a dangling symlink
passes `-L` and then fails exactly like a missing directory, which kills the 60-day renewal silently
rather than the visible first issuance.

Then request the certificate in the Ploi panel, **one site at a time** — certbot holds a global lock
and concurrent requests fail with "Another instance of Certbot is already running".

## Ops cheatsheet

```bash
pm2 list                              # what is running
pm2 logs <pm2-name> --lines 100       # tail one process
pm2 restart <pm2-name> --update-env   # re-read .env (frontend also needs export PORT=<port> first)

# is the deployed bundle pointing at the right CMS?
grep -R --fixed-strings "http://localhost:1337" frontend/.next/server   # a hit = built without
                                                                        # NEXT_PUBLIC_STRAPI_URL
```

**A green webhook POST proves nothing.** Ploi answers the POST immediately and runs the deploy
afterwards, which is why `ploi-deploy.sh` polls `ping_url` and requires the deploy log's leading
timestamp to be at or after the trigger time. Without that check you read the *previous* deployment's
result — that is how six consecutive green runs once sat over an un-deployed site.

## Content

Content moves with `strapi transfer`, never git, never a boot seed script. There is **no remote →
remote transfer**, so staging → production is two hops through local. Back up the remote
`backend/.tmp/data.db` before every transfer.

```bash
# local -> staging
npx strapi transfer --to https://staging-cms.nobettertime.com.au/admin --to-token <token> --force
```

`--to` / `--from` must be the **`/admin`** URL, and `--force` is required in a non-interactive shell.
Transfer tokens are created in the target admin under Settings → Transfer Tokens; there is no CLI for
it.

A transfer **replaces** every content type, all media, `strapi::core-store`, `strapi::webhook`, and
users-permissions roles and permissions. Admin logins and existing API tokens survive.
