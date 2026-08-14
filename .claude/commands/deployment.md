---
description: Deploy a project to Ploi for one branch/environment — resolve the server target from the vault, gate on DNS, write the GitHub Action + Ploi deploy scripts, place .env over SSH, fix SSL, create the Strapi admin and transfer content. Confirms every server write.
argument-hint: main | staging [--prepare-only]   e.g. /deployment staging
---

Bring **one environment** of this project up on Ploi, end to end. Follow the **`ploi-deployment`**
skill throughout — every rule in it is a failure that already shipped, and this command is the
ordered walk through them. **Confirm before every server write.** **Never `sudo`.** **Never put the
box address or any secret in a repo file.** **Never push** — this writes files, `/commit` + `/pr` ship them.

Input: `$ARGUMENTS` = `main` (production) or `staging`. Default: ask which. `--prepare-only` writes
the CI + deploy scripts + docs and stops before touching the server.

> **Where this runs:** the main thread, over `Bash` + `ssh`. Not delegated — a subagent cannot ask you
> to approve a write, and the confirm-each-step gate is the whole safety model. Read the
> `ploi-deployment` skill's `templates/` for every file this command writes.

## 0. Resolve the target (vault first, never the repo)

Derive the project slug from the repo folder via the vault's `Brain/_INDEX.md`, then read
`Brain/<slug>/ploi-deployment-target.md`.

- **Found** → show the topology table and ask you to confirm it is still current.
- **Missing** → read `Shared/ploi-fleet.md` for the known boxes and ask: which box (an existing one or
  a new IP), the domains for this environment, and the branch → environment mapping. Assign ports from
  the fleet table **cross-checked live** with `ss -tlnp` so a new site cannot collide with an existing
  one. pm2 name = the domain with dots stripped.

**Write both vault files before doing anything else** — the fleet port table and the project's target
note. If the box is new, add it to `Shared/ploi-fleet.md`. Nothing here goes into the repo.

## 1. Guard rails (STOP if any fail)

- Build the path allowlist: exactly `/home/ploi/<domain>` for **this project's** domains. Every `ssh`
  command must `cd` into one of them. Refuse any path outside it, and refuse `sudo` outright —
  privileged work (nginx, `/var/www/html`, `pm2 startup`) is handed to you for the Ploi dashboard.
- `$ARGUMENTS` must be `main` or `staging`, and that branch must exist on `origin`.
- Working tree clean, or say what is uncommitted before continuing.
- **Private git dependency check:** grep the root `package.json` for a `github:` dependency. If one is
  present (usually `claude-brain`), **STOP** — `npm ci` on the box will die with
  `fatal: could not read Username for 'https://github.com'` and never create `node_modules`. Report
  it with the fix from the skill (rule 3) and let the user decide before going further.
- **Strapi types check:** if `backend/types/generated/` is git-ignored and `backend/package.json` has
  no `prebuild` hook, flag it — the first backend build will fail on phantom `TS2353` errors (skill
  rule 7).

## 2. DNS gate

Ask whether DNS is pointed at the box for this environment's domains, then **verify rather than
trust** — during a cutover a bare `curl` against the hostname lies:

```bash
nslookup <host> 8.8.8.8
curl -sI --resolve '<host>:443:<box-ip>' https://<host>
```

**Not pointed, or `--prepare-only`** → prepare-only mode: run §3 and §4, print the exact A records to
add, and stop with a clear "server work not started" note. **Pointed** → continue.

## 3. CI (GitHub Action)

1. `gh auth status` — pushing anything under `.github/workflows/**` is rejected without the `workflow`
   scope. If it is missing, tell the user to run `gh auth refresh -h github.com -s workflow` now.
2. `gh secret list` to confirm the four secrets exist (never read their values):
   `PLOI_FRONTEND_DEPLOY_WEBHOOK` · `PLOI_BACKEND_DEPLOY_WEBHOOK` ·
   `STAGING_PLOI_FRONTEND_DEPLOY_WEBHOOK` · `STAGING_PLOI_BACKEND_DEPLOY_WEBHOOK`.
   Any missing → name them, point at Ploi panel → Site → Repository tab for the URL, and note the CI is
   inert until they exist. Still write the files.
3. Write `.github/workflows/ploi-deploy.yml` and `.github/scripts/ploi-deploy.sh` from the skill's
   templates, substituting the domains. Drop the `staging` branch + `STAGING_*` lines if this project
   has no staging environment.
4. Tell the user to **disable Ploi's own auto-deploy-on-push** on every site — the Action must be the
   only trigger, or one push deploys twice concurrently.

## 4. Deploy scripts + runbook

Generate into `docs/deploy/`, from the skill's templates with the real domain / port / pm2 name:
`<env>-frontend-deploy.sh`, `<env>-backend-deploy.sh`, `env.{backend,frontend}.template`, and
`README.md` (topology + secrets tables, DNS, SSL, first bring-up, ops cheatsheet — **no IP**).

Print each deploy script in full and say where it goes: **Ploi panel → Site → Deploy Script**. Ploi
runs these, not the repo, so a script that is only committed has not been deployed.

## 5. Server bootstrap (confirm each write)

**Survey read-only first** and report a table: does `/home/ploi/<domain>` exist · is the repo cloned on
the right branch · is `.env` present · `pm2 list` · is the port free · `[ -e public/. ]`.

Then, one confirmation per write, showing the exact command and target path:

1. **`backend/.env` before anything else** — it is a prerequisite of the first *build*, not just the
   first start. Generate every secret **on the server** with `openssl rand -base64 32` (`APP_KEYS` is
   four, comma-joined), `chmod 600`. Staging secrets must differ from production.
2. **`frontend/.env`** — must exist before the first `next build`; `NEXT_PUBLIC_STRAPI_URL` is baked in.
   Leave `STRAPI_API_TOKEN` blank until the CMS first-run in §7.
3. **First install + build + pm2 start**, backend before frontend, using the commands from the deploy
   scripts. `export PORT=<port>` before the frontend's `pm2 start`.

Never echo a secret back into the transcript — write it on the server and report only the key names.

## 6. SSL

Assert the ACME webroot symlink for each of this environment's domains (this is doable as `ploi`, no
sudo):

```bash
[ -e public/. ] || ln -sfn /var/www/html public
```

`-e public/.` not `-L public`: a **dangling** symlink passes `-L` and then fails exactly like a missing
directory, killing the 60-day renewal silently. If `/var/www/html` itself is missing, that needs root —
hand the user the `sudo mkdir -p /var/www/html && sudo chmod 755 /var/www/html` line for the dashboard.

Then hand off: request the Let's Encrypt certificate in Ploi, **one site at a time** (certbot holds a
global lock). Report the expiry of any cert that already exists.

## 7. First deploy + content

1. **Deploy.** Fire the webhook (or push the branch) and poll `ping_url` until terminal — a green POST
   proves only that Ploi accepted the request.
2. **Strapi admin.** Ask for email, first/last name and a password (never echo it back), then over SSH:
   `npm run strapi admin:create-user -- -e <email> -p <password> -f <first> -l <last> --workspace=backend`.
3. **API token.** Have the user create a **custom read-only** token in the CMS admin (never full
   access, never unlimited lifespan), put it in `frontend/.env` as `STRAPI_API_TOKEN`, then
   `pm2 restart <frontend-pm2> --update-env`.
4. **Content.** Ask for a transfer token (created in the remote admin's Settings → Transfer Tokens —
   there is no CLI for it). Back up the remote `backend/.tmp/data.db` first, always.
   - **`staging`:** local → staging. `strapi transfer --to https://<cms-host>/admin --to-token <t> --force`.
   - **`main`:** two hops, because Strapi cannot transfer remote → remote. Back up the **local** DB,
     pull staging down (`--from https://<staging-cms>/admin --from-token <t> --force`, which
     **overwrites local**), show a summary of what came across, confirm, then push to live with `--to`.
   - A transfer replaces every content type, all media, `strapi::core-store`, `strapi::webhook` and
     users-permissions roles. Admin logins and API tokens survive.

## 8. Verify + write back

`curl -sI https://<domain>` is 200 · the CMS API answers · `pm2 list` shows both processes online ·
`grep -R --fixed-strings "http://localhost:1337" frontend/.next/server` finds nothing (a hit means the
build ran without `NEXT_PUBLIC_STRAPI_URL` and needs a rebuild, not a restart).

Then update the vault: DNS state, cert expiry, ports now taken (append to the fleet table), pm2 names,
and the date of this deploy.

## Never

- Put the box IP, SSH user, webhook URL, transfer token, admin password or any `.env` value in a repo
  file, a commit, or the transcript.
- `sudo`, or touch any path outside this project's `/home/ploi/<domain>` directories.
- `git pull` in a deploy script, or `npm install --omit=dev` anywhere.
- Treat a green webhook POST, or a green Actions run, as proof that the deploy succeeded.
- Push to `main`, or commit anything — `/commit` then `/pr`.

## Report

A table per site: **domain · port · pm2 · dir · branch · DNS · SSL · deployed**, each ✅ / ⚠️ / ❌.
Then: files written (repo) · files written (vault) · secrets still missing · **what is left for you in
the Ploi dashboard**, in order. End with the next command — `/commit` to land the CI + deploy scripts.
