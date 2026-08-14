#!/usr/bin/env bash
# ============================================================================
# Ploi Deploy Script: [frontend-domain] (Next.js frontend, [ENV])
# ----------------------------------------------------------------------------
# Paste this into: Ploi panel > Site [frontend-domain] > Deploy Script.
# It runs on the server as the `ploi` user each time the deploy webhook fires
# (i.e. on every push to `[branch]` that touches frontend/ or app.js).
# nginx reverse-proxies [frontend-domain] -> localhost:[frontend-port].
#
# TEMPLATE placeholders, all filled in by `/deployment`:
#   [frontend-domain]  e.g. staging.example.com   (also the site directory name)
#   [frontend-port]    e.g. 3004
#   [frontend-pm2]     e.g. staging-examplecom    (pm2 process name, no dots)
#   [branch]           main | staging
#   [ENV]              PRODUCTION | STAGING
# ============================================================================
set -euo pipefail

cd /home/ploi/[frontend-domain]

# Sync hard to [branch]. `reset --hard`, never `git pull`: `next build` rewrites
# tracked files, so the working tree is always dirty on the server and a plain
# pull aborts. Only tracked files are reset; untracked .env / node_modules /
# public are left untouched.
git fetch origin [branch]
git reset --hard origin/[branch]

# Keep the Let's Encrypt webroot alive. Certbot writes ACME challenges to
# <site>/public, nginx serves them from /var/www/html, so `public` must be the
# symlink joining the two or cert issuance AND the 60-day renewal 404. Untracked,
# so `git reset --hard` above preserves it; this line only restores it if a repo
# re-install ever wipes it. `-e public/.` (not `-L public`) because a DANGLING
# symlink fails exactly like a missing directory and `-L` would not catch it.
[ -e public/. ] || ln -sfn /var/www/html public

# Install both workspaces (root) and build the frontend. `npm ci` (not `npm install`):
# every direct dependency is a `^` range, so `install` can re-resolve and rewrite the
# lockfile on the server, meaning the deployed tree is not provably the reviewed one.
# `ci` installs exactly what's committed and fails loudly on a lockfile mismatch.
# devDependencies are KEPT (no --omit=dev): typescript, tailwindcss,
# @tailwindcss/postcss, eslint-config-next and sharp are devDeps that `next build`
# genuinely needs, so --omit=dev is not a valid workaround for anything.
npm ci --no-audit --no-fund

# Drop Next's persistent Strapi response cache before building. `next build` writes every
# `fetch(..., { next: { revalidate } })` response here and REUSES entries that are still
# inside their window on the next build. Nothing above clears it: it is untracked, so
# `git reset --hard` leaves it, and `npm ci` only touches node_modules. The result is a
# deploy that rebuilds cleanly and still bakes in CMS content the editor changed minutes
# ago, which reads as "the deploy did nothing".
# Only fetch-cache/ is removed. The webpack/SWC caches beside it hold no CMS data and
# only make builds faster, so nuking all of .next/cache would cost build time for nothing.
rm -rf frontend/.next/cache/fetch-cache

npm run build --workspace=frontend

# Start (first deploy) or hot-reload the process. `npm start` -> node app.js -> Next.
# `export PORT` is required: app.js reads PORT, and `--update-env` re-reads the deploy
# shell's environment. Without it Next falls back to :3000 and nginx 502s.
export PORT=[frontend-port]
pm2 restart [frontend-pm2] --update-env \
  || pm2 start npm --name [frontend-pm2] -- start

pm2 save
echo "🚀 [frontend-domain] (frontend) deployed on :[frontend-port]"
