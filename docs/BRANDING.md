# Baseplate Branding Tokens

Use these tokens as the starter visual system for `[project-name]`. Replace names, values, and notes once the real brand system is available.

## Colors

### Primary

| Name | Hex | Token | Notes |
|------|-----|-------|-------|
| Brand Primary | `#F56024` | `--color-brand-primary` | Primary CTA, highlights, active states |
| Brand Primary Hover | `#BF3700` | `--color-brand-primary-dark` | Hover / pressed state |
| Brand Ink | `#151515` | `--color-brand-ink` | Primary text and dark surfaces |
| Surface Base | `#FFFFFF` | `--color-surface-base` | Text and light backgrounds |

### Secondary

| Name | Hex | Token | Notes |
|------|-----|-------|-------|
| Surface Muted | `#F9F9F9` | `--color-surface-muted` | Light section backgrounds |
| Text Muted | `#808080` | `--color-text-muted` | Secondary copy |
| Accent | `#53C507` | `--color-accent` | Support accent and status color |
| Accent Soft | `#C8FFA3` | `--color-accent-soft` | Light accent button / hover fill |
| Surface Tint | `#F4FCEE` | `--color-surface-tint` | Soft tinted section background |

### Gradients

| Use | Start | End | Token |
|-----|-------|-----|-------|
| Primary CTA | `#F56024` | `#FFC869` | `--color-brand-gradient-start` / `--color-brand-gradient-end` |
| Promo dark surface | `#151515` | `#151515` | `--color-surface-dark` |

## Typography

The baseplate currently aligns with the existing frontend typography stack:

- **Goldman** - display / headline font
- **Work Sans** - body / UI font

### Type Scale Reference

| Element | Font | Size | Weight | Notes |
|---------|------|------|--------|-------|
| Hero title | Goldman | 40-72px | Regular / Bold | Uppercase |
| Section title | Goldman | 32-48px | Regular | Uppercase |
| Card title | Goldman | 20-26px | Regular | Uppercase |
| Body | Work Sans | 16px | Regular | line-height 1.4-1.5 |
| Button | Work Sans | 16px | SemiBold | Rounded pill buttons |
| Caption / metadata | Work Sans | 14-16px | Regular | Events, address, support copy |

## Border Radii

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-button` | 38px | Primary and secondary pill buttons |
| `--radius-card` | 15px | Cards, map shells, media panels |
| `--radius-input` | 8px | Inputs, dropdowns, menu surfaces |

## Button System

The current button system exposes these visual families:

| Current Code Variant | Starter Visual Intent |
|----------------------|-----------------------|
| `default` | Brand gradient primary CTA |
| `gradient` | Brand gradient emphasis CTA |
| `outlined-green` | Brand outline / glass treatment |
| `outlined-white` | White outline on dark imagery |
| `solid-yellow` | Solid accent secondary CTA |
| `light-yellow` | Soft accent supportive CTA |
| `ghost-green` | Brand outline hover / soft glass state |
| `ghost-white` | White ghost button on dark imagery |
| `dark` | Solid ink inverse CTA |

Note: button variant keys are still legacy names in code and can be normalized later if needed. The baseplate token surface is brand-neutral.

## Form Elements

### Select / Dropdown

- Light and dark variants are present in the starter token set.
- Radius: 8px.
- Selected option pill uses Brand Primary.
- Dark dropdown surface uses translucent black with blur.

### Checkbox & Radio

- Custom controls use Brand Primary for the checked state.
- Checkbox corners are slightly rounded.
- Radio inputs use a circular filled brand-primary center.
