---
description: Holistic pre-ship QA audit of built pages — spelling, headings/SEO, meta tags, canonical, favicon, links, broken images, responsiveness, forms, a11y, Core Web Vitals, motion. Runs the full QA panel + fix loop to green.
argument-hint: <page> | all   e.g. /qa home   ·   /qa all
---

Run a **whole-page/site QA audit** before shipping and produce ONE report. This is **active** — it
finds issues, fixes P0/P1 via the delegated developers, and re-verifies, rather than only reporting.
(The per-section `QUALITY-BAR` gate in `/build-component` is the "done" bar during a build; `/qa` is
the broad final sweep.)

> **Panel:** run the FULL QA panel in parallel (read-only) — `design-fidelity-qa`, `functional-qa`,
> `accessibility-qa`, `performance-qa`, `security-qa` — each given the design reference + the local URL.
> Consolidate + dedupe findings (P0–P3). Then the **fix loop**: dispatch each P0/P1 to the responsible
> developer (routing as in `/build-component` §4b), re-run only the affected QA, repeat until green or 3
> rounds. P2/P3 → optional-polish list. End with the report below + a cost line + your sign-off.

Input: `$ARGUMENTS` = a page/route (`home`, `/guides/[slug]` sample) or `all`. Default: `all`.

## Setup (self-contained — no project deps)
1. `npm run build` then start the app (or use the dev server). Confirm each route returns 200.
2. Tools, all via npx/CDN (nothing to install):
   - **Playwright MCP** — drives every check (must be loaded; `/preflight` confirms it).
   - **axe-core** — inject in-browser via `browser_evaluate` from the CDN (`https://cdn.jsdelivr.net/npm/axe-core/axe.min.js`).
   - **cspell** — `npx cspell` for spelling.
   - **Lighthouse** — `npx lighthouse <url> --quiet --chrome-flags="--headless"` for Core Web Vitals (optional/slow).

## Checks — run each per page, record ✅ / ⚠️ / ❌ + the fix

Prefer **measuring** over eyeballing. Most are deterministic via `browser_evaluate`.

1. **Spelling & copy** — misspellings, doubled words, leftover placeholders (`lorem`, `[project-name]`,
   raw `#` hrefs, TODO). Run `cspell` on rendered text; you read for tone/context ("their/there").
2. **Headings & semantics** — **exactly one `<h1>`**; heading order has no skips (h2→h4); landmarks
   present (`header`/`nav`/`main`/`footer`); `<html lang>` set.
3. **Meta tags (necessary)** — `<title>` unique **50–60 chars**; `meta[name=description]` unique
   **150–155 chars**; `meta[name=viewport]` present; `meta[name=robots]` has no accidental `noindex` on a
   real page; **Open Graph** (`og:title`,`og:description`,`og:image`,`og:url`) + a Twitter card.
4. **Canonical** — `link[rel=canonical]` present, **absolute URL**, **self-referential** unless
   intentionally consolidated; no duplicate/conflicting canonicals.
5. **Favicon** — `link[rel=icon]` present **and the file resolves (not 404)**; `apple-touch-icon`; sized icons.
6. **Links** — collect every `<a href>`; internal links resolve (**no 404**), external links reachable;
   **no broken links**; no empty or `href="#"` placeholders left; `mailto:`/`tel:` well-formed.
7. **Images** — **broken images** (`img.naturalWidth === 0` or a 404 in the network log); all via
   `next/image`; **WebP**; ≤200 KB desktop / ≤100 KB mobile; `width`+`height` set (no CLS); real `alt`;
   lazy where appropriate.
8. **Responsiveness** — at **320 / 768 / 1024 / 1440**: **no horizontal overflow** (no element wider than the
   viewport), no overlap/clipping, tap targets ≥ ~44px.
9. **Forms** — every input has an associated `<label>`; validation/`required` present; **submit is actually
   wired** (submitting produces a real result, not a dead button); errors are accessible; keyboard-operable.
10. **Accessibility** — inject **axe-core**, run it: WCAG **AA contrast**, visible focus, ARIA correctness,
    keyboard nav; confirm `prefers-reduced-motion` is respected (content visible, motion off).
11. **Performance / Core Web Vitals** — 0 console errors; the LCP image uses `priority`; **LCP < 2.5s,
    INP < 200ms, CLS < 0.1** (Lighthouse); no obviously oversized bundle.
12. **Motion (kit)** — 0 blank sections, reveals settle to visible, parallax leaves no edge strip
    (same measurements as `motion-standards` / the gate).
13. **Structured data** (bonus) — if content pages exist, JSON-LD Article/BlogPosting with headline, author,
    datePublished, dateModified, publisher.
14. **Content provenance (Strapi)** — verify on-page content comes from Strapi, not hardcoded. Grep the
    components for hardcoded **editorial strings / image paths / SEO-meta literals** and hardcoded
    **fallback defaults** (flag any). **SEO meta is populated from Strapi** (the `seo` component), read in
    `generateMetadata` — not inline. **Collection pages** (events / stock / range / blogs) render from
    Strapi entries, **not an inline array**. Header/footer nav labels+URLs come from the `navigation`
    global. A missing/empty field shows an **empty/error state**, never a default string. Code-only
    exceptions (form field definitions, routing/nav tree, system microcopy, empty-state copy) are **not**
    findings.

## Report
Group the results under the 14 headings. For each: **✅ pass / ⚠️ warning / ❌ fail**, and for every ❌ the
**page, the element, and the exact fix**. Then run the **fix loop** above on P0/P1 findings. End with a
one-line verdict, the P2/P3 optional-polish list, a cost line (`≈tokens · rounds used · P0/P1 fixed ·
P2/P3 deferred`), and your sign-off.
