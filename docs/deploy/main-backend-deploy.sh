#!/usr/bin/env bash
# ============================================================================
# Ploi Deploy Script: cms.nobettertime.com.au (Strapi backend, PRODUCTION)
# ----------------------------------------------------------------------------
# Paste this into: Ploi panel > Site cms.nobettertime.com.au > Deploy Script.
# Fires on every push to `main` that touches backend/.
# nginx reverse-proxies cms.nobettertime.com.au -> localhost:1340
# (PORT itself comes from backend/.env).
#
# pm2 name is the old pre-rename slug ON PURPOSE — see main-frontend-deploy.sh.
#
# This file is documentation. Committing it does NOT deploy anything — Ploi runs
# the copy pasted into the panel, so any edit here must be pasted in again.
# ============================================================================
set -euo pipefail

cd /home/ploi/cms.nobettertime.com.au

git fetch origin main
git reset --hard origin/main

[ -e public/. ] || ln -sfn /var/www/html public

npm ci --no-audit --no-fund

# Clean generated output BEFORE building, or a content type deleted from src/ lingers
# in the git-ignored dist/ and keeps being registered after a green redeploy.
npm run clean --workspace=backend

# Regenerate Strapi types before building — backend/types/generated/ is git-ignored,
# so a fresh checkout hits phantom TS2353 errors that `strapi build` will not fix.
npm run strapi --workspace=backend -- ts:generate-types
npm run build:backend

pm2 restart cms-escapethenoise-tempcaraveadev --update-env \
  || pm2 start npm --name cms-escapethenoise-tempcaraveadev -- run start --workspace=backend

pm2 save
echo "🚀 cms.nobettertime.com.au (backend) deployed on :1340"
