---
description: Seed real content into LOCAL Strapi from the design export — page/section copy, headings, images (uploaded to Media), SEO, header/footer nav, and collection entries + relations — idempotently, so pages FETCH from Strapi instead of hardcoding. Never invents copy; never writes a boot seed script.
argument-hint: <page> | <collection> | all   e.g. /seed home   ·   /seed events   ·   /seed all
---

**Content is Strapi's job.** This command populates the **local** Strapi instance with the real
content the export already authored, so a page can be built and QA'd against **fetched** data — never
hardcoded placeholders or fallbacks. **The export's `content/` is the source of truth. Never invent
copy** (`CLAUDE.md`): if a value is missing, STOP and ask.

Input: `$ARGUMENTS` = a **page** (`home`, `about`), a **collection** (`events`, `stock`, `range`,
`blogs`), or `all`. Default: ask which.

> **Where this runs:** the main thread drives it via the `strapi` MCP (like `/project-setup`). For a
> large collection import, delegate the bulk write to `backend-developer`. **Local Strapi only** — to
> promote content to staging/prod use Strapi Transfer (`docs/STRAPI-CONTENT-MIGRATION.md`), not this.

## 0. Pre-check (STOP if not ready)
- Local Strapi is running (`npm run dev:backend`) and writable via the `strapi` MCP.
- The target's **content type(s) exist** (created in `/project-setup` Phase 0b) — incl. the shared
  **`seo`** component and the **`navigation`** global. If a type is missing → STOP, run `/project-setup`.
- Confirm the target is in `.claude/PROJECT-PLAN.md`'s content model.

## 1. Resolve the source content
- **Page:** `design-input/<export>/content/<page>.content.md` (+ the page HTML for structure/order).
- **Collection:** the entries the export provides for it under `content/` (events / stock / range /
  blogs, + their author/category). Seed **only what the export actually contains** — do not fabricate
  extra entries. If the export has no data for a collection, report it and ask for the source.
- **`all`:** every `content/*` file, foundation/singletons first, then collections.
- Older flat export? Pull content from `design.md` / the page HTML and note it.

## 2. Map content → Strapi (per the PROJECT-PLAN content model)
- **Editorial → fields:** headings, body/rich text, CTA labels + targets → their content-type fields.
- **Images → Strapi Media:** upload each content image to the Media Library (optimize to WebP,
  ≤200 KB desktop / ≤100 KB mobile), set **`alt`** text from the content, and reference the uploaded
  media — **not** a `public/` path. (Brand/system assets like the logo stay in `public/`; only
  *content* imagery lives in Strapi Media.)
- **SEO → the `seo` component:** metaTitle, metaDescription, ogImage, canonicalURL, keywords,
  structured-data fields — one per page single-type / collection entry.
- **Relations:** wire by a **stable key** (slug/title/uid) — e.g. blog→author, stock→range/category.
  Create referenced entries first (foundation-first), then link.
- **Header/footer nav → the `navigation` global:** label + url per item (order preserved).

## 3. Upsert idempotently (re-runnable, never duplicated)
Match each entry on a **stable key** (slug, else title/uid). **Create** if absent, **update** if
changed, **skip** if identical. Check duplicate `collectionName`/slug before creating. Do this **live
via the `strapi` MCP now** — **never** add an unconditional boot/seed script and never commit
`.tmp/data.db` or `public/uploads/` (`CLAUDE.md` content-safety).

## 4. Do NOT seed (these stay in code — the content↔code boundary)
Form field definitions (labels/validation/options) · page routing + the nav *tree structure* (which
routes exist) · system/UI microcopy (loading, pagination, 404, cookie) · empty/error-state copy for
missing content. Editorial copy *around* a form (its heading/intro) **is** content → seed it. Nav
**labels + URLs** for header/footer **are** content → seed them into the `navigation` global.

## 5. Report
Per type/entry: **created / updated / skipped** counts · media uploaded (+ sizes) · relations wired ·
SEO populated (y/n) · anything **missing from the export** (listed as a question, never invented).
End with: "Content in local Strapi — build with `/build-component <page>/<section>` (it fetches, no
hardcoding)." Do **not** push. Commit any code changes via `/commit`.
