# Development Workflow

Use this workflow when adapting the baseplate into a production project. Keep the project-specific docs aligned with the live codebase as the implementation takes shape.

## Branching

| Branch | Purpose |
| --- | --- |
| `main` | Production-ready, protected. Never push directly. |
| `develop` | Integration branch when the project uses one. |
| `feature/<name>` | Page, feature, CMS, or workflow tasks. |
| `fix/<description>` | Bug fixes. |
| `chore/<description>` | Tooling, config, and docs. |

## Implementation Flow

1. Confirm scope from existing docs, Figma, live site references, or user-provided content. Do not guess content.
2. Add or update route entries in `frontend/src/app/` from the confirmed information architecture.
3. Model only the Strapi content types the project actually needs.
4. Extract reusable components only when repetition or complexity justifies them.
5. Use project tokens and existing component conventions; keep layout in normal flow with flex/grid first.
6. Optimize committed images and avoid generated-output churn.
7. Validate with the QA gates below.
8. Update docs if the implementation changes structure, routes, CMS behavior, deployment, or workflow.

## Environment

Frontend local env in `frontend/.env.local`:

```env
NEXT_PUBLIC_STRAPI_URL=http://localhost:1337
STRAPI_API_TOKEN=your-api-token-here
NEXT_PUBLIC_MAPBOX_TOKEN=your-mapbox-token-here
```

Backend local env lives in `backend/.env`. Add more variables only when the implementation requires them.

## Strapi Content Workflow

- Treat Git as the source of truth for schemas, components, routes, controllers, services, and frontend rendering code.
- Treat Strapi records, SQLite data, and uploaded media as runtime data.
- Never use deploys or unconditional seeds as content sync.
- Seed only missing bootstrap content and keep production seed mode disabled except for planned one-time bootstrap runs.
- Use Strapi transfer for local-to-live content migration after backing up the remote database and uploaded media.

## QA Gates

Before handing off:

1. Run `npm run build` for frontend or docs changes that describe frontend behavior.
2. Run `npm run build:backend` for backend, Strapi schema, seed, or CMS workflow changes.
3. Manually verify affected visual routes at 320px, 768px, 1024px, and 1440px.
4. Check console output, responsive layout, image loading, alt text, focus states, and key links/forms.
5. Stop local frontend or backend dev servers started for the task unless the user asks to keep them running.

## Commit And Handoff

Use imperative, task-sized commit subjects:

```text
Add services landing page shell
Create Strapi content type for case studies
Document baseplate environment variables
```

Keep PRs focused, describe behavior changes, include screenshots for UI changes when useful, and never push directly to `main`.
