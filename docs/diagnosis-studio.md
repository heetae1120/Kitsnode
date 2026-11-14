# Diagnosis entry and visual system

`/tools/` begins with an explicit Starter / Player choice. No product input is shown before that choice. Choosing a mode initializes a new draft, resets report state and focuses the input workspace. “유형 바꾸기” returns to the choice heading; selecting again starts a fresh diagnosis. No choice or draft is persisted. `/tools/player/` remains a direct Player entry for existing links.

Starter begins its completed report at profit/budget. Player begins at keyword/ad planning, preserving the existing distinction. Both use the existing cost validation and calculation functions. The verified editor's preview-stage bridge can still open individual stages without the chooser.

`diagnosis-studio.css` scopes the hero's black/orange/warm-white typography, flat cards, focus states, inputs, modals, report reader, reorder visualization and preparation screens to `MarketingPlanner`. Other tools retain their styles. The dedicated header links back to the hero and exposes mode selection instead of the old tools navigation.

Verification covers both choices, changing mode, empty-field validation, product/budget entry, platform and ancillary costs, goal duration, calculated profit, report pagination, reorder visualization and 390px layout. Example: price 30,000, unit cost 12,000, quantity 100, fee 6%, packaging 1,000, logistics 3,000 and no returns yields 12,200 per item and 1,220,000 before advertising. Existing automated tests verify the unchanged calculations.
