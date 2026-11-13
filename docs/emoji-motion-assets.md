# Emoji motion assets

Created with the built-in ImageGen tool. Both assets have transparent backgrounds and were resized to 640px wide and encoded as WebP (quality 88). No runtime image service is required.

- `public/emoji-studio/starter.webp`: used in the hero and starter card.
- `public/emoji-studio/player.webp`: used in the hero and player card.

## Final prompts

Starter:

> Create a single premium 3D emoji illustration asset for a Korean seller onboarding website, transparent background. Subject: a joyful round golden-yellow smiley emoji with simple black oval eyes and open friendly smile, nestled behind one mint-green open shipping carton with two small white gloved hands holding the carton, small glossy red heart floating above to the right. Reference aesthetic: polished soft 3D social emoji, shiny molded toy plastic, rounded bevels, subtle realistic soft shading and ambient occlusion, bright saturated yellow mint and red, clean uncluttered isolated centered composition, three-quarter perspective. All objects comfortably inside frame with generous transparent margins. No people, no text, no lettering, no watermark. High quality studio lighting from upper left. Designed for beginner seller STARTER card and floating website hero.

Player:

> Create a single premium 3D emoji illustration asset for an experienced online seller PLAYER onboarding card and animated floating hero. Transparent background, isolated centered composition, generous transparent margins. A confident cheerful round golden-yellow emoji face with simple black eyes, wearing glossy black sunglasses pushed slightly up, beside a mint-green ascending bar chart of three rounded chunky bars and a coral-red upward arrow curling above it, small white gloved hand giving thumbs up. Polished soft 3D social emoji aesthetic, molded shiny toy plastic, rounded bevels, soft studio lighting from upper left, subtle ambient occlusion, vivid yellow mint red and white. No human body, no text, no lettering, no watermark, no scenery. Keep entire illustration comfortably within square frame.

## Motion and report layout

Hero objects float and gently turn independently; the existing pause control also pauses decorative motion. Cards float independently and respect reduced motion. Inventory lines reveal on entry, and the selected marker eases between actual calculated positions. CSS pulse animation is disabled for reduced motion.

The former first and second tablet pages are combined. The remaining sequence is financial summary, reorder plan, and goal. At 1074×883 the collapsed summary and reorder plan (including late-order warning) fit without scrolling inside the tablet. Expanded detail tables and smaller screens may scroll to preserve readable content.

The supplied animation gallery URL was inaccessible during implementation; no third-party animation code or assets were copied.
