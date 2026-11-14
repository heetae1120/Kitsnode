# Creative studio homepage

The homepage is shared by `/` and `/tools/start/`. Existing tools remain available at their original routes. The root renders without redirecting, preserving incoming attribution parameters.

## Files

- `src/data/agency-content.ts`: editable headlines, Korean descriptions, services, sample projects, and contact details.
- `src/components/agency/agency-home.tsx`: semantic page, responsive dialog menu, sample project dialogs, and local project-brief form.
- `src/components/agency/use-agency-motion.ts`: GSAP master timeline, ScrollTrigger pin/scrub, header contrast, section reveals, and cleanup.
- `src/components/agency/agency.css`: scoped black/orange/warm-white system, responsive composition, reduced-motion and print styles.
- `src/app/page.tsx`, `src/app/tools/start/page.tsx`: shared page entry points and metadata.
- `src/app/layout.tsx`: default studio metadata; existing analytics, editor integration, and local font remain.
- `package.json`, `package-lock.json`: GSAP and `@gsap/react`. Existing animation dependencies used by tools are retained; the new homepage uses GSAP alone.

## Hero behavior

One reversible timeline coordinates four full-viewport scenes over approximately 400vh of desktop scroll distance and 320vh on mobile. No wheel/touch interception, snap behavior, autoplay, or smooth-scroll library is used. Words reveal through masks. Geometric transitions connect black, orange, warm white, then black compositions. Hidden scenes are inert. A separate, unpinned diagnosis section follows the four scenes. Its Next.js Link routes to the existing `/tools/` product diagnosis, including the configured GitHub Pages base path.

Headlines, navigation, service titles, sample artwork, contact, and footer use Korean copy. The `as-korean-site` typography rules adjust line height and responsive sizing while preserving the GSAP timeline and icon motion.

OS reduced motion uses ordinary stacked scenes. An initialization failure removes the pin and inline animation styles so the full content remains available. GSAP contexts and matchMedia revert animations/triggers on unmount and media changes.

## Content and contact limitations

Work artwork is code-native and explicitly labeled as sample concepts. No customer names, awards, or performance claims are invented. Replace the work data and artwork with approved actual cases when available.

The contact form validates required browser fields and prepares a local UTF-8 text file or clipboard copy. It does not submit to a backend. Set the optional contact email in the content file to expose a real mail link; a production submission channel needs a separate integration.

## Verification

Verified desktop forward/reverse scene transitions, pinning, progress, final CTA navigation, dialog focus/Escape, mobile menu navigation, 390px horizontal layout, and actual brief copy/download. The 388 existing tests passed. A fresh browser session reported no runtime errors. Initial development hot reload after adding a hook required a full reload; clean sessions were used for final verification.

Implementation references: [GSAP ScrollTrigger](https://gsap.com/docs/v3/Plugins/ScrollTrigger/) and [GSAP React cleanup](https://gsap.com/resources/React/).
