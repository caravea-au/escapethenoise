#!/usr/bin/env bash
# ============================================================================
# Ploi Deploy Script: [cms-domain] (Strapi backend, [ENV])
# ----------------------------------------------------------------------------
# Paste this into: Ploi panel > Site [cms-domain] > Deploy Script.
# It runs on the server as the `ploi` user each time the deploy webhook fires
# (i.e. on every push to `[branch]` that touches backend/).
# nginx reverse-proxies [cms-domain] -> localhost:[backend-port]
# (PORT itself comes from backend/.env).
#
# TEMPLATE placeholders, all filled in by `/deployment`:
#   [cms-domain]    e.g. staging-cms.example.com   (also the site directory name)
#   [backend-port]  e.g. 1340
#   [backend-pm2]   e.g. staging-cmsexamplecom     (pm2 process name, no dots)
#   [branch]        main | staging
#   [ENV]           PRODUCTION | STAGING
#
# PREREQUISITE: backend/.env must already exist on the server before the FIRST
# run of this script. `strapi ts:generate-types` boots Strapi's register phase,
# so a missing .env fails the build with `Missing admin.auth.secret configuration`.
# ============================================================================
set -euo pipefail

cd /home/ploi/[cms-domain]

# Sync hard to [branch]. `reset --hard`, never `git pull` (see the frontend script).
# Untracked backend/.env, node_modules, .tmp/data.db and public/uploads survive.
git fetch origin [branch]
git reset --hard origin/[branch]

# Keep the Let's Encrypt webroot alive (see the frontend script for the full why).
# `-e public/.` catches a dangling symlink, which `-L public` would not.
[ -e public/. ] || ln -sfn /var/www/html public

# Install both workspaces (root), clean generated output, then build the Strapi admin.
# devDependencies are kept: the Strapi build needs typescript.
npm ci --no-audit --no-fund
npm run clean --workspace=backend
npm run build:backend

# Start (first deploy) or hot-reload the process. `npm start -w backend` -> strapi start.
# PORT + secrets come from backend/.env; --update-env re-reads it.
pm2 restart [backend-pm2] --update-env \
  || pm2 start npm --name [backend-pm2] -- run start --workspace=backend

pm2 save
echo "🚀 [cms-domain] (backend) deployed on :[backend-port]"
