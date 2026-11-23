# The Living Air Atlas

AIR / AFTER pairs a porcelain reading surface with a basalt instrument panel and an illustrated urban horizon. The selected city, pollutant and household decision share the opening view. Decision Studio, Home Air Lab and Ask AIR are sibling destinations with their own URLs.

## Shared tokens

| Token | Value | Role |
| --- | --- | --- |
| Paper | `#f7f6f1` | Page background |
| Surface | `#fffefa` | Masthead, dialogs, selected controls |
| Ink | `#202f32` | Main text and active navigation |
| Muted ink | `#506169` | Supporting text |
| Rule | `#bac6c5` | Dividers and boundaries |
| Copper | `#935034` | Annotations and interactive accents |
| Mineral | `#668b91` | Atmospheric illustration |

System sans carries controls, body copy and tabular measurements. Georgia marks the atmospheric opening and short editorial headings. The system requires no font download. Shared layout tokens, dialogs and navigation live in `web/assets/styles.css`. Each experience owns its specific visual rules.

## Illustrations and evidence

- The Living Atmosphere uses a seeded skyline, bridge and reflections baked into a second canvas on resize. Both buffers cap pixel ratio at 1.5. Animated frames composite the cached scene and a single particle path.
- A finite PM2.5 value selects up to 88 illustrative particles using `min(88, 8 + round(0.45 * concentration))`. Missing evidence selects zero and suspends the loop. A zero reading retains a distinct numeric label. Density is an artistic mapping with no physical units.
- Forecast selection changes the hero label, source time and illustration together. Gaps separate groups of available points. A native range control exposes the selected hour to keyboard and touch.
- The Decision Fork compares explicit assumptions. Room feature selectors connect an architectural section with cooking, filtration and ventilation guidance. Indoor concentration and airflow are unmeasured.
- The scene skips animation when hidden, offscreen or subject to reduced motion, and spaces moving frames by at least 48 ms. Neither motion nor color is needed to read a result.

## Navigation and accessibility

Desktop uses a horizontal masthead. Below 921 CSS pixels a bottom navigation bar reserves space for the device safe area. Native dialogs handle Escape and focus return. Every view has a deep link. Active destinations, scenario tabs and room selections expose their state to assistive technology. Render assistant replies and provider text through text nodes.
