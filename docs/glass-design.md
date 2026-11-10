# Warm glass workspace

The supplied `adjustable-glass-dashboard` React component is integrated under
`src/components/ui/`, matching this project's existing shadcn-style component
directory and `@/*` TypeScript alias. Tailwind CSS 4 and TypeScript already exist;
no scaffold or alias migration is needed. GSAP and `@gsap/react` are pinned in the
npm lockfile.

`GlassWorkspace` retains its data-driven dashboard API and adds a `children` slot.
KITSNODE uses this slot via `KitsGlassWorkspace`, so the existing calculators,
keyword research, reports, navigation and store preview remain the actual page
content. The attachment's sample transactions, savings and cash-flow figures are
not used as seller data.

`src/app/glass-theme.css` scopes the warm palette and material to `.kits-glass`.
The tools and store layouts share the same shell. Desktop inputs use an editorial
left column and a glass form on the right; narrower screens stack these sections.
The live profit figures use four responsive cards (two columns on phones).

The glass control adjusts blur, opacity, saturation, edge light and tint. Changes
apply locally to the current workspace and reset on a full reload. Escape closes
the control and returns focus to its trigger. Existing print/PDF actions suppress
the decorative photograph and settings control. Reduced-motion preferences are
respected by the component's GSAP hook.

Background: an Unsplash interior photograph, downloaded as
`public/images/glass-interior.jpg` from
https://images.unsplash.com/photo-1600210492486-724fe5c67fb0 .
It is decorative, has an empty alternative text, is self-hosted and uses the
configured GitHub Pages base path. A warm background remains if it cannot load.

Verification: all 201 existing tests pass; TypeScript passes; the 23-page static
export succeeds. On the Windows sandbox the default parallel export encountered
an EPERM directory-creation failure; the successful local export used one worker
with a temporary config. The tracked Next.js build configuration is unchanged.
