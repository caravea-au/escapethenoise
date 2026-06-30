# Component Library

This document defines how the component library should grow from the current baseplate.

## Current State

- `frontend/src/app/` currently owns the shell directly.
- No shared or UI component inventory is committed yet.
- Add new components only when `[project-name]` has a confirmed route, content, or interaction need.

## Rebuild Rules

- Recreate component folders only when a component is truly reusable or route-specific.
- Keep route entry files in `frontend/src/app/`.
- Introduce `frontend/src/components/ui/` for primitives only when a new design system starts to form.
- Introduce `frontend/src/components/shared/` for cross-page composed UI only when those elements actually exist.
- Use route-specific folders only when a route earns them through actual complexity.

For the broader structure guide, see [`FRONTEND-STRUCTURE.md`](./FRONTEND-STRUCTURE.md).
