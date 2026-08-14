---
name: ploi-deployment
description: >
  How a Caravea site actually deploys to Ploi — two Node sites per environment (Next.js frontend +
  Strapi CMS), a path-filtered GitHub Action firing a deploy webhook, per-site Deploy Scripts, server
  .env, Let's Encrypt webroot, and Strapi Transfer for content. Use whenever a task touches
  deployment, CI/CD, a Ploi site or deploy script, SSH to the box, DNS/SSL cutover, promoting content
  to staging or production, or debugging a deploy that "succeeded" but changed nothing. Invoked by
  /deployment. Every rule here is a failure that already shipped.
---

# Ploi deployment

Each environment is **two Ploi sites** on one Ubuntu box: the Next.js frontend (nginx reverse-proxies
the domain to a local `3xxx` port, `npm start` → `node app.js`) and Strapi (proxied to a `13xx` port,
`strapi start`). Both are the **same monorepo checked out twice**, into `/home/ploi/<domain>`.

The GitHub Action never builds anything. It decides *which workspace changed*, fires that site's Ploi
deploy webhook, and waits for the result. All build/restart commands live in the site's **Deploy
Script** in the Ploi panel, which is why those scripts are kept in `docs/deploy/` and pasted in by hand.

## Why (the constraints that bite)

- **A Ploi deploy webhook returns before the deploy runs.** The POST answers `{"status":"ok",
  "ping_url":"…"}` immediately, so `curl --fail` only proves Ploi *accepted* the request.
- **`sudo` for the `ploi` user is password-prompted**, so non-interactive SSH can never use it.
  Anything privileged (nginx, `/var/www/html`, `pm2 startup`) has to go through the Ploi dashboard.
- **Ports are owned by nginx, not by you.** Ploi wrote `proxy_pass http://localhost:<port>` into each
  vhost when the site was created; the deploy script has to match, and two projects must never claim
  the same port. Check `ss -tlnp` plus the fleet table in the vault before assigning one.
- **The working tree on the server is always dirty.** `next build` rewrites tracked files, so any
  sync strategy that assumes a clean tree fails on the second deploy.

## The non-negotiables

1. **`git reset --hard origin/<branch>`, never `git pull`.** A plain pull aborts on the dirty tree
   above. `git checkout -- .` first is the older workaround and has already drifted out of sync with
   what runs on the boxes; reset is what production uses.

2. **Keep devDependencies. `npm ci`, not `npm install --omit=dev`.** `typescript`, `tailwindcss`,
   `@tailwindcss/postcss`, `eslint-config-next` and `sharp` are devDeps that the frontend and Strapi
   builds genuinely need. `ci` over `install` because every direct dep is a `^` range, so `install`
   can re-resolve on the server and the deployed tree stops being the reviewed one.

3. **No private git dependency may appear in any `package.json`.** `npm ci` on the box dies with
   `fatal: could not read Username for 'https://github.com'` and **aborts the whole workspace
   install**, so `node_modules` is never created and neither workspace builds — one dev-only entry
   takes down the entire deploy. `claude-brain` was the usual culprit and is **no longer a dependency
   of any repo**: run it with `npx github:caravea-au/claude-brain#v<KIT-VERSION> sync`, and read the
   version from the committed `.claude/KIT-VERSION`. If you find it back in a `package.json`, that is
   the bug. Do **not** paste a GitHub token into `~/.gitconfig` on the box as a workaround: that leaked
   a token in a session transcript on 2026-07-28. `--omit=dev` is not an escape hatch either, see rule 2.

4. **Gate CI on `ping_url`, never on the POST.** Poll until the status is terminal, and require the
   deploy log's leading timestamp to be at or after your trigger time (allow ~120s clock skew) so you
   cannot read the *previous* deployment's result. Fail closed on an unrecognised status. Skipping
   this produced six consecutive green runs over an un-deployed, blank production site.

5. **`export PORT=<port>` before `pm2 restart --update-env`** on the frontend. `app.js` reads `PORT`
   and `--update-env` re-reads the deploy shell's environment; without it Next binds `:3000` and
   nginx 502s.

6. **`.env` is a prerequisite of the first deploy, not of the first start.** `strapi ts:generate-types`
   boots Strapi's register phase, so a missing `backend/.env` fails the *build* with
   `Missing admin.auth.secret configuration`. And `NEXT_PUBLIC_STRAPI_URL` is baked into the frontend
   bundle (`images.remotePatterns`, `metadataBase`), so it must exist before the first `next build` —
   getting it wrong needs a rebuild, not a restart.

7. **`backend/types/generated/` is git-ignored, so a fresh checkout has no Strapi types** and `tsc`
   reports phantom `TS2353: '<field>' does not exist in type …` errors for fields that plainly exist.
   `strapi build` does not generate them. The backend needs a `"prebuild": "strapi ts:generate-types"`
   hook so `npm run build:backend` regenerates them first.

8. **The ACME webroot must be a live symlink.** Certbot writes to `<site>/public/.well-known/…`;
   every vhost on the box serves that path from `/var/www/html`. Installing the monorepo also replaces
   the `public/` Ploi scaffolds. So `ln -sfn /var/www/html /home/ploi/<domain>/public`, re-asserted
   defensively in every deploy script. Test it with `[ -e public/. ]`, **not** `[ -L public ]` — a
   dangling symlink passes `-L` and then fails exactly like a missing directory, which silently kills
   the 60-day renewal rather than the visible first issuance.

9. **`rm -rf frontend/.next/cache/fetch-cache` before building.** Next persists every
   `fetch(…, { next: { revalidate } })` response there and reuses in-window entries on the next build.
   Untracked, so `git reset --hard` leaves it and `npm ci` never touches it. The symptom is a clean,
   green deploy that ships pre-edit CMS content and reads as "the deploy did nothing".

10. **Guard the push baseline.** `github.event.before` is all zeros on a new branch and *unreachable*
    after a force-push or branch reset, so `git diff` dies with `fatal: bad object` and **no deploy
    runs at all**. Check `git cat-file -e "$before^{commit}"` and deploy both workspaces when it is
    unusable: an extra deploy is idempotent, a skipped one silently ships nothing.

11. **Serialise deploys per branch** (`concurrency`, `cancel-in-progress: false`). Two pushes landing
    together otherwise run `npm ci` concurrently in the same directory. Queue, never cancel — a
    cancelled deploy leaves the box half-updated.

12. **The frontend vhost's `location /` must be a reverse proxy**, not Ploi's default PHP template. A
    vhost reset to the template serves **403**. Fixing it needs the dashboard (rule: no `sudo`).

13. **Never put the box IP, SSH user, webhook URL, transfer token, admin password or any `.env` value
    in a repo file.** Repo files carry domain, directory, port and pm2 name only. The box address
    lives in the Obsidian vault.

## Topology contract

One row per site. `/deployment` fills this in and stores it in the vault.

| Env | Domain | Serves | Port | pm2 name | Directory | Branch |
|---|---|---|---|---|---|---|
| prod | `<domain>` | frontend | `3xxx` | `<domain minus dots>` | `/home/ploi/<domain>` | `main` |
| prod | `cms.<domain>` | backend | `13xx` | `cms<domain minus dots>` | `/home/ploi/cms.<domain>` | `main` |
| staging | `staging.<domain>` | frontend | `3xxx` | `staging-<…>` | `/home/ploi/staging.<domain>` | `staging` |
| staging | `staging-cms.<domain>` | backend | `13xx` | `staging-cms<…>` | `/home/ploi/staging-cms.<domain>` | `staging` |

Secrets, per environment: `PLOI_{FRONTEND,BACKEND}_DEPLOY_WEBHOOK` and
`STAGING_PLOI_{FRONTEND,BACKEND}_DEPLOY_WEBHOOK`, as GitHub repo secrets. Pushing any change under
`.github/workflows/**` needs `gh auth refresh -h github.com -s workflow` first.

## Where the target lives

The Obsidian vault, never the repo:

- `Shared/ploi-fleet.md` — the boxes (IP, hostname, SSH user) and the **cross-project port allocation
  table**. Read this before assigning a port to a new site.
- `Brain/<slug>/ploi-deployment-target.md` — this project's rows of the table above, plus DNS state,
  cert expiry and last deploy.

## Strapi transfer

Content moves with `strapi transfer`, never git, never a boot seed script.

- **Local ↔ remote only.** There is no remote→remote transfer, so staging → production is two hops
  through local: pull staging down with `--from`, then push up with `--to`. The pull **overwrites your
  local database** — back it up first.
- `--to` / `--from` must be the **`/admin`** URL, and `--force` is required in a non-interactive shell.
- Back up the remote `backend/.tmp/data.db` before every transfer, always.
- **What a transfer replaces:** every content type, all media, `strapi::core-store`,
  `strapi::webhook`, and `plugin::users-permissions` roles + permissions.
  **What survives:** the admin login and existing API tokens.
- Transfer tokens are created in the remote admin UI (Settings → Transfer Tokens). There is no CLI for
  it. Never log one, never commit one.

## Reference implementation

- Templates ship beside this skill in `templates/` — `ploi-deploy.yml`, `ploi-deploy.sh`,
  `{frontend,backend}-deploy.sh`, `env.{backend,frontend}.template`, `deploy-README.md`.
- The hardened live reference is **`caraveacreative-nextjs`**: `.github/workflows/ploi-deploy.yml`,
  `.github/scripts/ploi-deploy.sh`, `docs/deploy/`. It is the only repo carrying all of rules 4, 8, 9,
  10 and 11.
- Do **not** copy `canyon-caravans/docs/deploy/*.sh` — those still use `git pull --ff-only` and have
  already drifted from what runs on the box (rule 1).
