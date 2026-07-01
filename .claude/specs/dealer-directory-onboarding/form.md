# Spec: `dealer-directory-onboarding` — dealership onboarding form

Export: `dealer-directory-onboarding-formv5.html` (standalone HTML; `design.md` governs tokens/type).

---

## WHAT YOU'LL SEE
A focused, single-column "List your dealership" form on the cream canvas: a brand masthead, a sticky
progress rail that fills as fields are completed, seven numbered card sections (details, location, contact,
trading hours, what-you-offer, listing/media, final details + consent), and a rust "List my dealership"
submit button. On success the browser navigates to a **Thank You page that reuses the home hero banner**.

## ELEMENTS (in order)
1. **Sticky progress rail** — top-of-page bar: "Escape the Noise" label + progress track (fills %) + "N of M done".
2. **Masthead** — full-colour brand lockup, eyebrow "no better time to", h1 "List your dealership", lede, "Takes about 5 minutes" pill.
3. **Section 1 — Dealership details** — name, registered name, ABN, year established, DMS select (+ "Other" reveal).
4. **Section 2 — Location** — street, suburb, state select, postcode, "more than one location" toggle.
5. **Section 3 — Contact & enquiries** — phone, leads email, SMS mobile, contact name, role, public enquiries email.
6. **Section 4 — Trading hours** — 7 day rows (open/close time + "Open" toggle → "Closed"), "copy Monday to Tue–Fri" link.
7. **Section 5 — What you offer** — Services / Brands / Product types multi-selects (+ "other" text), new/used/both pills, finance/delivery/RVMAP/RV Master toggles.
8. **Section 6 — Your listing** — website, short description (320-char counter), logo upload, photo uploader (1–5), social URLs.
9. **Section 7 — Final details** — submitter name/email/phone, state association select, 3-checkbox consent box.
10. **Submit** — full-width rust button + foot note + "Powered by Caravea".
11. **Thank You page** (`/dealer-directory-onboarding/thank-you`) — home hero banner with "You're on the map" copy + back-to-home button.

## REUSE MAP
- **Masthead eyebrow** → REUSE `Eyebrow` (tone rust).
- **Masthead h1** → REUSE `Heading` (`as="h1"`, sizes via className, no clamp).
- **Masthead lede** → REUSE `Text` (variant lead).
- **Brand lockup** → REUSE existing asset `/brand/lockup-horizontal-fullcolour.svg` via `next/image` (no new asset; do NOT reference `design-input/`).
- **"Takes ~5 min" pill / "Powered by Caravea" / honeypot / foot note** → Tier 3 inline.
- **Text/email/tel/url/number inputs** → REUSE `Input` (Tier 1; cream fill, line border, rust focus already match).
- **Select & textarea** → NEW Tier 3 inline, styled to match `Input` (caret SVG for select; char counter for textarea). Input primitive covers `<input>` only.
- **Sticky progress rail** → NEW Tier 3 inline (inside the form island; stateful).
- **Numbered section card** (number badge + title + subtitle, used 7×) → NEW **Tier 2 `FormSection`** (colocated, presentational).
- **Multi-select dropdown** (search + checkboxes + removable tag chips) → NEW **Tier 2 `MultiSelect`** (client).
- **Radio pills** (New/Used/Both) → NEW Tier 3 `RadioPills` (colocated).
- **Toggle line** (checkbox + label + sublabel; used in location/offer/consent) → NEW Tier 3 `ToggleLine` (colocated).
- **Trading hours grid** → NEW **Tier 2 `TradingHours`** (client; copy-to-weekdays, open/closed toggle).
- **Logo file picker** → NEW Tier 3 inline (button-styled label + filename).
- **Photo uploader** (up to 5 previews, add/remove, object URLs) → NEW **Tier 2 `PhotoUploader`** (client).
- **The whole form** (state, validation, progress, submit, honeypot) → NEW **Tier 2 `DealerOnboardingForm`** (`'use client'` island).
- **Submit button** → REUSE `Button` (variant `primary` = rust fill; `fullWidth`).
- **Thank You banner** → REUSE home `Hero` (`@/components/home/Hero`) passing `{ title, subtitle }`; below it REUSE `Section`/`Container` + `Button` for the back-to-home CTA.

> No registry component is rebuilt. New pieces are genuinely absent from `.claude/COMPONENTS.md`.

## TOKEN MAPPING (HTML inline palette → project tokens — `design.md` wins)
green `#27412e`→`green` · deep pine `#13271A`→`green-dark` · ochre `#C17C2C`→`rust` · deep ochre→`rust-dark` ·
canvas `#EFE7D2`→`cream-deep` · paper `#FDFAF2`→`cream` · borders→`line`/`sand` · help text→`muted` ·
radius 14/10px→`rounded-card`/`rounded-input` · Fraunces→`font-oswald` · Inter→`font-sans`.
Consent box warm-sand, sage chip fills → `sand`/`cream-deep`/`green` tints via tokens. Error terracotta → inline `text-[#b4452f]` (no error token exists; acceptable one-off, noted).

## CONTENT
- **Static (from export, verbatim):** all labels, hints, placeholders, eyebrow/h1/lede, section titles, consent text, success copy, foot/powered notes.
- **Hardcoded option lists (frontend `options.ts`, copied verbatim from HTML `OPTIONS`):** services, brands (~400), product types, DAYS, states, DMS list, state associations.
- **Strapi:** none read; submission is **written** to `POST /api/dealer-submissions` (public create).
- ❓missing copy: none — the export is complete.
- **Assumption to confirm:** focused page — the global `Navbar`/`Footer` should **not** wrap this route (the sticky progress rail is the only top chrome, matching the design). Requires a route group so `layout.tsx` chrome is excluded for this page + thank-you.

## RESPONSIVE (breakpoint steps, no clamp; HTML breakpoint at 620px → use Tailwind `sm`/`md`)
- **320:** single column; field grid collapses to 1-col; progress "Escape the Noise" label hidden; section padding tightens; trading-hours rows wrap (time inputs full-width); h1 ~32px.
- **768:** two-column field grid returns; h1 ~40px; cards 30px padding.
- **1024:** content capped at 720px centred column; h1 ~44px.
- **1440:** unchanged (720px column centred in viewport); h1 ~46px.
- Hero on thank-you uses existing breakpoint steps (40→51→68→78px).

## INTERACTIONS (`'use client'` — `DealerOnboardingForm` + islands)
- Live **progress** counter (required fields + 3 option groups + logo + ≥1 photo).
- **MultiSelect**: open/close, search filter (lists ≥20), checkbox select, removable chips, click-outside + Esc close.
- **Trading hours**: per-day open/closed toggle, "copy Monday to Tue–Fri".
- **Char counter** (description /320); **DMS "Other"** text reveal; **logo** filename echo; **photo** add/remove (max 5, object-URL previews, revoke on remove).
- **Validation** on submit: required fields, ABN 11 digits, postcode 4 digits, email regex, ≥1 per option group, logo + ≥1 photo, all 3 consents; scroll to first error; honeypot abort.
- **Submit** (Strapi 5 — no upload-at-create): `POST /api/upload` the logo + photos first → collect file ids → `POST ${NEXT_PUBLIC_STRAPI_URL}/api/dealer-submissions` JSON `{ data: { …, logo: id, photos: [ids] } }` → on ok `router.push('/dealer-directory-onboarding/thank-you')`; on error restore button + inline message.

## ACCEPTANCE
- Visual fidelity at **320 / 768 / 1024 / 1440** vs the export, re-skinned to tokens (no raw hex except the one noted error colour).
- **a11y:** semantic labels bound to inputs, `aria-expanded`/`role="listbox"` on multi-select, focus-visible rings (rust), alt on logo, keyboard-operable toggles, Esc closes dropdowns.
- **prefers-reduced-motion:** progress-fill + dropdown transitions disabled (globals.css already honours this).
- No `clamp()`. Token colours only. Every new Tier-1/2 component registered in `.claude/COMPONENTS.md`.

✅ APPROVED: ☐
