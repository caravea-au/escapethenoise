# [project-name] monorepo

- **`frontend/`** - Next.js site
- **`backend/`** - Strapi 5 headless CMS
- **`docs/`** - implementation notes, structure guides, and deployment references

## Commands

Run from the repository root.

| Task | Command |
|------|---------|
| Frontend dev | `npm run dev` or `npm run dev --workspace=frontend` |
| Backend dev | `npm run dev:backend` |
| Frontend build | `npm run build` |
| Backend build | `npm run build:backend` |
| Frontend prod start (root host) | `npm start` |
| Frontend prod start (workspace only) | `npm run start:frontend` |

## Environment

- **Frontend:** `frontend/.env.local`
  - `NEXT_PUBLIC_STRAPI_URL`
  - `STRAPI_API_TOKEN`
  - `NEXT_PUBLIC_MAPBOX_TOKEN`
- **Backend:** `backend/.env`

See [`docs/WORKFLOW.md`](./docs/WORKFLOW.md) for environment and workflow details.

## Frontend Structure

The frontend currently uses:

- `frontend/src/app/` for Next.js route entry files
- `frontend/src/styles/` for shared tokens and supporting global styles
- `frontend/public/` for static assets
- `frontend/src/app/` for the current shell implementation
- `frontend/src/pages/_error.tsx` for compatibility with the existing Next setup

Every component lives in its own folder and includes:

- `Component.tsx`
- `Component.module.css`

See:

- [`docs/FRONTEND-STRUCTURE.md`](./docs/FRONTEND-STRUCTURE.md)
- [`docs/COMPONENT-LIBRARY.md`](./docs/COMPONENT-LIBRARY.md)
- [`docs/BRANDING.md`](./docs/BRANDING.md)

## Design References

Replace placeholder brand tokens, content assumptions, and design references with the real materials for `[project-name]`.

If Figma is used, record file keys and node IDs in [`docs/FIGMA-REFERENCES.md`](./docs/FIGMA-REFERENCES.md).

## Strapi Cloud

If deploying Strapi Cloud, set the project root / base directory to `backend` so Cloud resolves `@strapi/strapi` from `backend/package.json`.

## Production Deployment

Use [`docs/PLOI-DEPLOYMENT.md`](./docs/PLOI-DEPLOYMENT.md) as the default production deployment template when this baseplate is adapted for a project.
