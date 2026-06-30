# Frontend Structure

This document describes the current frontend structure for the baseplate.

## Current State

- `frontend/src/app/` contains the active application shell and route entry files.
- New components should be introduced only when `[project-name]` has confirmed UI requirements.
- Shared styling tokens live in `frontend/src/styles/tokens.css`.
- Static assets live in `frontend/public/`.

## Current Structure

```txt
frontend/
  public/

  src/
    app/
      globals.css
      layout.tsx
      not-found.tsx
      page.tsx
    lib/
      fonts.ts
    pages/
      _error.tsx
    styles/
      tokens.css
```

## Rules

- Keep route entry files in `src/app/`.
- Keep global tokens and non-route styling support in `src/styles/`.
- Introduce `src/components/ui/` only when reusable primitives actually exist.
- Introduce `src/components/shared/` only when cross-page composed UI actually exists.
- Add route-specific component folders only when the new project genuinely needs them.
- Keep static assets in `frontend/public/`.

## Rebuild Guidance

When adding a new page:

1. Add the route entry in `src/app/<route>/page.tsx`.
2. Keep the first implementation local to the route when possible.
3. Extract a component only after a real reuse or complexity need appears.

When adding a new component:

1. Create a dedicated folder only if the component is expected to persist.
2. Use `Component.tsx` and `Component.module.css`.
3. Keep the component inventory minimal and driven by real reuse.

## Notes

- `src/pages/_error.tsx` remains in place for compatibility with the current Next setup.
- Future component and system docs should follow the live `[project-name]` implementation.
