# Testing Checklist

Manual QA checklist for each project built from this baseplate. Replace placeholder routes and product-specific checks as the project takes shape.

## Build And Runtime Gates

- [ ] Run `npm run build` for frontend changes or docs changes that describe frontend behavior
- [ ] Run `npm run build:backend` for backend, Strapi schema, seed, or CMS workflow changes
- [ ] Stop any local frontend or backend dev servers started for the task unless the user asks to keep them running
- [ ] Confirm no generated output, local database, uploaded media, cache, or build artifact churn is included in the handoff

## Global Checks

- [ ] Page loads without console errors
- [ ] Header and footer render correctly if the project has them
- [ ] Mobile navigation opens/closes properly if present
- [ ] Page is responsive at 320px, 768px, 1024px, and 1440px
- [ ] Fonts and brand colors match `docs/BRANDING.md`
- [ ] Links navigate to the correct pages
- [ ] Images have meaningful alt text
- [ ] Images are optimized for the project target, preferably WebP, with desktop images <=200 KB and mobile images <=100 KB unless an exception is documented
- [ ] Forms validate required fields and show clear success/error states
- [ ] Layout uses flex/grid and normal flow first; no new responsive `clamp()` sizing is introduced
- [ ] Content, product facts, routes, and imagery come from confirmed sources rather than guessed placeholders

## Route Checks

- [ ] Homepage renders expected project content
- [ ] New route entries under `frontend/src/app/` render without layout regressions
- [ ] Extracted components follow `Component.tsx` plus `Component.module.css`
- [ ] CMS-backed pages handle missing Strapi content gracefully
- [ ] API routes return expected success and error states
- [ ] Invalid routes display the custom 404 page

## Cross-Browser

- [ ] Chrome latest
- [ ] Firefox latest
- [ ] Safari latest
- [ ] Edge latest

## Accessibility Spot-Check

- [ ] Color contrast passes WCAG AA for body text
- [ ] Interactive elements are keyboard accessible
- [ ] Focus states are visible
- [ ] Page structure is understandable to screen readers
