# Backend

This workspace is a clean Strapi 5 backend for the reset baseplate.

## Commands

Run from the repository root:

```bash
npm run dev:backend
npm run dev:backend:clean
npm run build:backend
```

Or from `backend/` directly:

```bash
npm run develop
npm run dev:clean
npm run build
```

## Current State

- Default local database: SQLite
- Media uploads: `backend/public/uploads/`
- Environment template: `backend/.env.example`
- No custom project content types are carried forward
- No seed routine is carried forward
- The backend should be remodeled from the Strapi admin or new source files as `[project-name]` is defined

## Notes

- If the admin shows stale generated artifacts, run `npm run dev:backend:clean`.
- Create new content types and components only when the new project model is clear.
