# Liquid menus and tablet inputs

The supplied Nimbus Liquid Navbar is integrated in `src/components/ui/`, using
the existing TypeScript alias and Tailwind/shadcn-style directory. It requires
React only and adds no dependencies or page background assets.

The component supports a `children` slot so existing Next.js links and grouped
menus retain their destinations, disclosure controls, outside-click handling and
Escape focus return. The tools header uses WebGL water and the store sidebar uses
the CSS drop. Each instance has a unique refraction filter ID. The renderer stops
when hidden, releases graphics resources and timers on unmount, and follows the
current reduced-motion preference. Native links still work without WebGL.

`LiquidSurfaces` delegates pointer highlights to existing input fields and menu
controls. It does not change values, calculations or submit handling.
`liquid-interface.css` scopes its styles to these wrappers.

Profitability inputs use an iPad-style frame on both input steps. The budget and
sales horizon share a row. Price, unit cost and quantity share the next row on
desktop; these three fields stack on small screens. The three progress steps are
larger and preserve the original validated order.

The introductory sentence, repeated field helper paragraphs and the refresh
notice are removed. Labels, units, errors, conditional cost warnings and
on-demand cost help remain available. Calculations and report assumptions are
unchanged.

Validation: 206 existing tests, TypeScript and the 23-page static export pass.
The local Windows export uses a temporary single-worker setting; the tracked
Next.js configuration is unchanged.
