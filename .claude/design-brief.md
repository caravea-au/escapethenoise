# Claude Design Export Brief

**Upload this file when you ask Claude to design a website.** It makes the design come out
**premium** *and* drop cleanly into our Next.js pipeline. Fill in Part 1, then paste your request.

---

## Part 1 — Inputs you set (fill these in)

```
BRAND
  Name        : [e.g. CIAA — Find a Dealer]
  Personality : [e.g. trusted / official / outdoors-Australian / plain-spoken]
  Colours     : [named tokens + hex — e.g. green #27412E, rust #C17C2C, cream #F6F1E4]
  Fonts       : [Google Fonts only — e.g. Oswald (display) + Hanken Grotesk (body) + Fraunces (serif accent)]

ART-DIRECTION DIALS  (1–10)
  Design variance  : [7]   ← how experimental the layout is
  Motion intensity : [6]   ← how much orchestrated motion
  Visual density   : [5]   ← content per screen (low = editorial whitespace)

REFERENCE TARGET
  "Match the level of: [a described feel, or 'our v2 editorial build'].
   Use for calibration only — never clone a real site pixel-for-pixel."

PAGES TO DESIGN
  [home, dealer-directory, buying-guides, ...]
```

---

## Part 2 — What "premium" means here (the art direction to follow)

Design a **distinctive, editorial** site — not a templated one. Follow these rules:

- **Type carries the design.** Oversized display headlines, restraint elsewhere, a clear scale.
  Use **one serif-italic accent** phrase per section for contrast — never all-caps everything.
- **Whitespace is structure.** Generous vertical rhythm; sections breathe.
- **One accent colour drives action.** No decorative gradients, no drop-shadows on type,
  no more than two accent colours, no centered body paragraphs.
- **Imagery is full-bleed and cinematic**, always under a scrim so text stays readable.
- **Editorial devices** — numbered section markers (`/01/`), hairline rules, meta rows —
  only where they encode real structure.
- **Motion is purposeful, not decorative** (see Part 4).

> Spend boldness in ONE signature element per page; keep everything around it quiet.

---

## Part 3 — Required OUTPUT STRUCTURE (return the export in exactly this shape)

```
<export-name>/
├── design.md                 brand story + look (the source of truth)
├── art-direction.md          the dials, rules and do/don'ts above, as a spec
│
├── tokens/                   design tokens, split out (values only)
│   ├── colors.md             named tokens + hex
│   ├── typography.md         type scale (role → size per breakpoint) + font weights
│   ├── spacing.md            spacing scale
│   ├── radii.md
│   └── motion.md             durations · easings · the effect list
│
├── pages/                    one folder per page
│   └── <page>/
│       ├── <page>.html       Tailwind markup, with COMPONENT boundaries marked (Part 5)
│       └── <page>.motion.md  per-section motion spec (Part 4)
│
├── components/
│   └── components.md         which blocks repeat (→ become reusable components)
│
├── content/
│   └── <page>.content.md     copy per page; MARK which fields are CMS/Strapi-driven
│
└── assets/
    ├── logos/                (SVG preferred)
    ├── photos/               (name them by use; note intended crop)
    ├── icons/
    └── video/
```

---

## Part 4 — Motion & interaction spec (required, per section)

For **every section** of every page, state the intended motion in `<page>.motion.md`:

```
HERO
  background : video | image | flat   (+ parallax? yes/no)
  headline   : mask-reveal (line-by-line) | fade-up | none
  scrim      : required if text sits over media
NAV          : transparent-over-hero → solid-on-scroll | static
SECTION <x>  : fade-up | word-by-word scroll reveal | typewriter accent | none
IMAGES       : reveal on scroll (fade / clip / scale)?
HOVER        : link/card/button micro-interactions?
```

Describe the **intent** — do NOT write animation code (we implement it from our own kit).

---

## Part 5 — Constraints (so the export converts cleanly)

- **Mark reusable components** in the HTML:
  `<!-- COMPONENT: DealerCard -->` … `<!-- /COMPONENT: DealerCard -->`
- **No `clamp()`** for responsive type — give sizes as **breakpoint steps**
  (e.g. `40px / 60px / 78px` for mobile / tablet / desktop).
- **Tokens, never raw hex**, in the markup (use the names from `tokens/`).
- **Separate copy from layout**; flag anything that should come from the CMS.
- **One canonical HTML per page** (no duplicate demo/runtime files).
- **Assets**: real or clearly-labelled placeholders; note format/size intent.

---

## Part 6 — Quality bar (the design must hit all of these)

- [ ] Reads **distinctive**, not templated (passes the "could be any SaaS site?" test — it can't)
- [ ] Clear type hierarchy; a signature moment per page; genuine whitespace
- [ ] One accent colour; no banned decoration (Part 2)
- [ ] Every section has a **motion intent**; a hero treatment is specified
- [ ] Structured per Part 3; components marked; copy separated; tokens named
- [ ] Responsive intent given as breakpoint steps (no clamp)

> Deliver the whole export as the structure in Part 3. Our Next.js pipeline reads it directly.
