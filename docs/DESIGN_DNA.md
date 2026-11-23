# AIR / AFTER — Visual DNA, v1

Our expression is **atmospheric editorial**: a serious environmental field guide with the refinement of a contemporary publication. Every visual feature must express a user decision or the provenance of evidence.

## Signature primitives

- **Porcelain field** (`#eeeae1`): the reading environment, not stark pure white.
- **Atmospheric ink** (`#1c312c`): high-information hero surface and comparison interface.
- **Muted copper** (`#bc7d55`): selections and meaningful editorial accents, not glowing warning red.
- **Cooled mineral green** (`#769985`): restrained atmospheric data traces.
- **Typographic pairing:** geometric system sans for wayfinding and annotations; italic Georgia for a humane, editorial contrast. No remote font dependency.
- **Hairline rhythm:** precise 1px rules, small folio indexes, generous spacing, purposeful asymmetry.
- **Microcopy:** inviting, practical, matter-of-fact. No fear-mongering, no exaggerated medical claims.
- **Illustrations:** procedural, scientifically disclosed as metaphors. Never depict a computed room concentration or air-flow simulation as measurement.

## Interaction grammar

1. Location and context are always easy to change.
2. One main action per visible module; avoid a grid of unrelated buttons.
3. Each environmental reading has type, source, unit, timestamp and error state.
4. The chart uses real returned model points; never interpolate missing data as if measured.
5. Transformations are restrained (200–450ms), with no transition essential to understanding.
6. Canvas engine is deterministic in configuration; particle field is metaphor. Pause on hidden pages and reduced motion.
7. Custom icons are monoline/bespoke. Do not install a generic icon set to scatter decorative symbols.
8. Content width, column rhythm and spacing must remain deliberate at 390px and 1440px.
9. New screens should extend existing motifs, not introduce a new color scheme per feature.

## Anti-pattern blacklist

Cyber neon, purple-blue gradients, frosted-glass card fleets, generic dashboard KPI donuts, oversized fake 3D globes, stock pollution photography, default Tailwind/SaaS layouts, random color-changing animations, emoji as interface iconography, hollow animations that slow the app, imported hero images without clear purpose.

## Engineering limits for graphics

`web/assets/app.js` includes the initial lightweight atmospheric Canvas. If upgrading or modifying it, maintain its API `setDensity` and `drawOnce` or update all callers and tests. Keep Canvas 2D unless a documented, measurable requirement truly needs more. Respect `devicePixelRatio` caps, `requestAnimationFrame` throttling, `visibilitychange`, and `prefers-reduced-motion`. No WebGL dependency by default.
