#!/usr/bin/env bash
# ============================================================================
# Ploi Deploy Script: staging.nobettertime.com.au (Next.js frontend, STAGING)
# ----------------------------------------------------------------------------
# Paste this into: Ploi panel > Site staging.nobettertime.com.au > Deploy Script.
# It runs on the server as the `ploi` user each time the deploy webhook fires
# (i.e. on every push to `staging` that touches frontend/ or app.js).
# nginx reverse-proxies staging.nobettertime.com.au -> localhost:3010.
#
# This file is documentation. Committing it does NOT deploy anything — Ploi runs
# the copy pasted into the panel, so any edit here must be pasted in again.
# ============================================================================
set -euo pipefail

cd /home/ploi/staging.nobettertime.com.au

# Sync hard to staging. `reset --hard`, never `git pull`: `next build` rewrites
# tracked files (frontend/next-env.d.ts, frontend/tsconfig.json), so the working
# tree is always dirty on the server and a plain pull aborts with "local changes
# would be overwritten" — which is exactly how the frontend once sat 10 commits
# behind while every deploy looked green. Only tracked files are reset; untracked
# .env / node_modules / public survive.
git fetch origin staging
git reset --hard origin/staging

# Keep the Let's Encrypt webroot alive. Certbot writes ACME challenges to
# <site>/public, nginx serves them from /var/www/html, so `public` must be the
# symlink joining the two or cert issuance AND the 60-day renewal 404. Untracked,
# so the reset above preserves it; this line only restores it if a repo re-install
# ever wipes it. `-e public/.` (not `-L public`) because a DANGLING symlink fails
# exactly like a missing directory and `-L` would not catch it.
[ -e public/. ] || ln -sfn /var/www/html public

# Install both workspaces (root) and build the frontend. `npm ci` (not `npm install`):
# every direct dependency is a `^` range, so `install` can re-resolve and rewrite the
# lockfile on the server, meaning the deployed tree is not provably the reviewed one.
# devDependencies are KEPT (no --omit=dev): typescript, tailwindcss,
# @tailwindcss/postcss, eslint-config-next and sharp are devDeps that `next build`
# genuinely needs, so --omit=dev is not a valid workaround for anything.
npm ci --no-audit --no-fund

# Drop Next's persistent Strapi response cache before building. `next build` writes
# every `fetch(..., { next: { revalidate } })` response here and REUSES entries still
# inside their window on the next build. Nothing above clears it: it is untracked so
# `git reset --hard` leaves it, and `npm ci` only touches node_modules. The result is
# a deploy that rebuilds cleanly and still bakes in CMS content the editor changed
# minutes ago, which reads as "the deploy did nothing".
rm -rf frontend/.next/cache/fetch-cache

npm run build --workspace=frontend

# Start (first deploy) or hot-reload the process. `npm start` -> node app.js -> Next.
# `export PORT` is required: app.js reads PORT, and `--update-env` re-reads the deploy
# shell's environment. Without it Next falls back to :3000 and nginx 502s.
export PORT=3010
pm2 restart staging-nobettertimecomau --update-env \
  || pm2 start npm --name staging-nobettertimecomau -- start

pm2 save
echo "🚀 staging.nobettertime.com.au (frontend) deployed on :3010"
