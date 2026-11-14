# Diagnosis landing page

The homepage is shared by `/` and `/tools/start/`. It ends with the diagnosis CTA. The former About, Services, Work, Contact, footer, sample dialogs and local brief form have been removed. Header and final CTA link directly to the existing `/tools/` diagnosis using Next.js Link, preserving the configured GitHub Pages base path.

## Files

- `src/data/agency-content.ts`: Korean service headlines, descriptions and diagnosis CTA.
- `src/components/agency/agency-home.tsx`: four scenes and the final diagnosis section.
- `src/components/agency/use-agency-motion.ts`: GSAP pin/scrub timeline, reveals and cleanup.
- `src/components/agency/agency.css`: scoped black/orange system and responsive typography.

## Behavior

The reversible timeline coordinates four full-screen scenes over 400vh of desktop scroll distance and 320vh on mobile. Existing transition timing, icon rotation and enlargement remain unchanged. A separate, unpinned section ends the page with “지금 진단하러 가기”. No content follows it.

Mobile layouts emphasize Korean headlines and keep abstract symbols visible between the headline and supporting text. The final CTA spans the content width. A compact header diagnosis link replaces navigation to removed sections. The 360×640 layout uses smaller symbols and copy spacing to avoid collisions.

Reduced-motion preferences use ordinary stacked scenes. Initialization failure exposes all scene content. GSAP contexts and matchMedia clean up on unmount and media changes.

## Verification

Checked 390×844 and 360×640 layouts, forward scene transitions, the document ending at the diagnosis section, absence of removed sections/footer and actual navigation to the existing product/budget input page. The production build includes TypeScript checking. GitHub Actions tests and deploys the static output.
