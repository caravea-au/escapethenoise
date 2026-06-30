# Layout: Minimize `position: absolute`

## Goal

Structure each component with document flow, flex, and grid first so layouts stay predictable across desktop and mobile viewports. Reserve absolute positioning for narrow cases where it is the right tool, not the default way to place content.

## Why This Matters

- Absolute positioning removes elements from normal flow, so siblings no longer account for the positioned box.
- Responsive work becomes fragile when visual alignment depends on breakpoint-specific `top`, `left`, or transform nudges.
- Accessibility and maintainability improve when DOM structure matches visual structure.

## Default Approach

1. Use flexbox for rows, toolbars, stacked groups, and simple side-by-side layouts.
2. Use CSS Grid for two-dimensional layouts, cards, asymmetric sections, and image-plus-copy columns.
3. Use padding, margin, and `gap` for spacing instead of manual pixel nudging.
4. Use stack patterns such as `flex flex-col gap-*` for vertical rhythm.
5. Author CSS sizing in `px` by default, including spacing, widths, heights, offsets, radii, font sizes, and breakpoint-specific values.
6. Do not use CSS `clamp()` for responsive sizing. Use explicit media queries, container-aware rules, or responsive utilities.

## When `absolute`, `fixed`, Or `sticky` Is Acceptable

| Use case | Notes |
| --- | --- |
| Decorative overlays | Non-interactive visuals that must sit on top of a photo or surface |
| Badges or small affordances | Use inside a relatively positioned wrapper that defines the anchor |
| Sticky header or modal backdrop | Use established shell or modal patterns |
| Known one-off effects | Isolate masks, clipping, or special effects in a dedicated wrapper |

Avoid using absolute positioning as a substitute for layout when flex or grid can express the same hierarchy.

## Implementation Checklist

- [ ] Can this be flex or grid with `gap`, `items-*`, `justify-*`, and responsive direction changes?
- [ ] If something overlaps, is there a single containing block with a small number of positioned children?
- [ ] Does DOM reading order match visual order, especially for screen readers and keyboard focus?
- [ ] Are breakpoints handled with layout rules instead of one-off `top` or `left` offsets?
- [ ] Are sizes and breakpoint values authored in `px` without `clamp()`?

## Related Docs

- [`COMPONENT-LIBRARY.md`](./COMPONENT-LIBRARY.md)
- [`HIFI-PLAN.md`](./HIFI-PLAN.md)
