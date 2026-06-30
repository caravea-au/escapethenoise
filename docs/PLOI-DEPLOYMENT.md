# Ploi Deployment Guide

Use this as the default deployment template when this baseplate is adapted for a production project.

Production deployment should treat `frontend/` and `backend/` as two separate applications even though the repository is an npm workspaces monorepo.

## Required Rule

Do not run production installs or builds from the repository root unless the command only orchestrates a workspace-specific command.

Use workspace-specific commands on Ploi:

```bash
npm ci --prefix frontend
npm run build --prefix frontend

npm ci --prefix backend
npm run build --prefix backend
```

This keeps frontend dependencies separate from backend/Strapi dependencies.

## Frontend Site

Use the actual Ploi site path in place of `/home/ploi/[frontend-domain]`.

```bash
cd /home/ploi/[frontend-domain]
git pull origin main
npm ci --prefix frontend
npm run build --prefix frontend
```

Frontend runtime command:

```bash
npm run start --prefix frontend
```

Set frontend environment variables on the frontend Ploi site:

```env
NODE_ENV=production
NEXT_PUBLIC_STRAPI_URL=https://[cms-domain]
STRAPI_API_TOKEN=your-production-read-token
NEXT_PUBLIC_MAPBOX_TOKEN=your-mapbox-token
```

## Backend Site

Use the actual Ploi site path in place of `/home/ploi/[cms-domain]`.

```bash
cd /home/ploi/[cms-domain]
git pull origin main
npm ci --prefix backend
npm run build --prefix backend
```

Backend runtime command:

```bash
npm run start --prefix backend
```

Set Strapi variables on the backend Ploi site only. Do not share the backend `.env` with the frontend site.

## Ploi Webhooks

Use separate Ploi deploy webhooks for frontend and backend deploys:

- `PLOI_FRONTEND_DEPLOY_WEBHOOK`
- `PLOI_BACKEND_DEPLOY_WEBHOOK`

Store webhook URLs in GitHub repository secrets. Do not commit webhook URLs.

Recommended path split:

- Changes under `frontend/`, root package files, or frontend deploy workflow trigger the frontend webhook.
- Changes under `backend/`, root package files, or backend deploy workflow trigger the backend webhook.
