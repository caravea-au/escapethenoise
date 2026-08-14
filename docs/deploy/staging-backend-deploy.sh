#!/usr/bin/env bash
# ============================================================================
# Ploi Deploy Script: staging-cms.nobettertime.com.au (Strapi backend, STAGING)
# ----------------------------------------------------------------------------
# Paste this into: Ploi panel > Site staging-cms.nobettertime.com.au > Deploy Script.
# It runs on the server as the `ploi` user each time the deploy webhook fires
# (i.e. on every push to `staging` that touches backend/).
# nginx reverse-proxies staging-cms.nobettertime.com.au -> localhost:1345
# (PORT itself comes from backend/.env).
#
# PREREQUISITE: backend/.env must already exist on the server before the FIRST
# run of this script. `strapi ts:generate-types` boots Strapi's register phase,
# so a missing .env fails the BUILD with `Missing admin.auth.secret configuration`.
#
# This file is documentation. Committing it does NOT deploy anything — Ploi runs
# the copy pasted into the panel, so any edit here must be pasted in again.
# ============================================================================
set -euo pipefail

cd /home/ploi/staging-cms.nobettertime.com.au

# Sync hard to staging. `reset --hard`, never `git pull` (see the frontend script).
# Untracked backend/.env, node_modules, .tmp/data.db and public/uploads survive.
git fetch origin staging
git reset --hard origin/staging

# Keep the Let's Encrypt webroot alive (see the frontend script for the full why).
# `-e public/.` catches a dangling symlink, which `-L public` would not.
[ -e public/. ] || ln -sfn /var/www/html public

# Install both workspaces (root). devDependencies are kept: the Strapi build needs
# typescript, and `--omit=dev` would break it.
npm ci --no-audit --no-fund

# Clean generated output BEFORE building. The backend is TypeScript Strapi 5, so
# `strapi start` runs compiled dist/ — and dist/ is git-IGNORED, so `git reset --hard`
# never touches it. `strapi build` compiles OVER the existing dist without deleting
# orphaned files, so a content type removed from src/ lingers in dist/src/api/<name>/
# and keeps getting registered: it still appears in the Content Manager and still
# answers on /api/<name> after a redeploy that "succeeded".
npm run clean --workspace=backend

# Regenerate Strapi's types, then build. backend/types/generated/ is git-ignored, so a
# fresh checkout has none and `tsc` reports phantom `TS2353: '<field>' does not exist
# in type ...` for fields that plainly do exist — including on content types the commit
# never touched. `strapi build` does not generate them, so this runs first. (The repo's
# `prebuild` hook does the same thing; this line keeps the script correct on its own.)
npm run strapi --workspace=backend -- ts:generate-types
npm run build:backend

# Start (first deploy) or hot-reload the process. `npm start -w backend` -> strapi start.
# PORT + secrets come from backend/.env; --update-env re-reads it.
pm2 restart staging-cmsnobettertimecomau --update-env \
  || pm2 start npm --name staging-cmsnobettertimecomau -- run start --workspace=backend

pm2 save
echo "🚀 staging-cms.nobettertime.com.au (backend) deployed on :1345"
