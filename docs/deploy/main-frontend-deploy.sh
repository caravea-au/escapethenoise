#!/usr/bin/env bash
# ============================================================================
# Ploi Deploy Script: nobettertime.com.au (Next.js frontend, PRODUCTION)
# ----------------------------------------------------------------------------
# Paste this into: Ploi panel > Site nobettertime.com.au > Deploy Script.
# Fires on every push to `main` that touches frontend/ or app.js.
# nginx reverse-proxies nobettertime.com.au -> localhost:3004.
#
# NOTE ON THE pm2 NAME. It is `escapethenoise-tempcaraveadev`, not
# `nobettertimecomau`. The site was renamed from escapethenoise-temp.caravea.dev
# on 2026-07-01 and the pm2 process names were deliberately left on the old slug,
# so this deviates from the fleet convention ON PURPOSE. Renaming it means
# stopping and re-registering the process — do not "fix" it as a drive-by.
#
# This file is documentation. Committing it does NOT deploy anything — Ploi runs
# the copy pasted into the panel, so any edit here must be pasted in again.
# ============================================================================
set -euo pipefail

cd /home/ploi/nobettertime.com.au

# Sync hard to main. `reset --hard`, never `git pull`: `next build` rewrites tracked
# files, so the tree is permanently dirty on the server and a plain pull aborts.
git fetch origin main
git reset --hard origin/main

# Keep the Let's Encrypt webroot alive. `-e public/.` catches a dangling symlink,
# which `-L public` would not — and a dangling link kills the 60-day renewal
# silently rather than the visible first issuance.
[ -e public/. ] || ln -sfn /var/www/html public

# `npm ci`, devDependencies kept — see the staging script for the full reasoning.
npm ci --no-audit --no-fund

# Drop Next's persistent fetch cache so a deploy cannot ship pre-edit CMS content.
rm -rf frontend/.next/cache/fetch-cache

npm run build --workspace=frontend

# `export PORT` before --update-env, or Next binds :3000 and nginx 502s.
export PORT=3004
pm2 restart escapethenoise-tempcaraveadev --update-env \
  || pm2 start npm --name escapethenoise-tempcaraveadev -- start

pm2 save
echo "🚀 nobettertime.com.au (frontend) deployed on :3004"
