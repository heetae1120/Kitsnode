# Diagnosis entry and visual system

`/tools/` begins with an explicit Starter / Player choice. No product input is shown before that choice. Choosing a mode initializes a new draft, resets report state and focuses the input workspace. “유형 바꾸기” returns to the choice heading; selecting again starts a fresh diagnosis. No choice or draft is persisted. `/tools/player/` remains a direct Player entry for existing links.

Starter begins its completed report at profit/budget. Player begins at keyword/ad planning, preserving the existing distinction. Both use the existing cost validation and calculation functions. The verified editor's preview-stage bridge can still open individual stages without the chooser.

`diagnosis-studio.css` scopes the hero's black/orange/warm-white typography, flat cards, focus states, inputs, modals, report reader, reorder visualization and preparation screens to `MarketingPlanner`. Other tools retain their styles. The dedicated header links back to the hero and exposes mode selection instead of the old tools navigation.

Verification covers both choices, changing mode, empty-field validation, product/budget entry, platform and ancillary costs, goal duration, calculated profit, report pagination, reorder visualization and 390px layout. Example: price 30,000, unit cost 12,000, quantity 100, fee 6%, packaging 1,000, logistics 3,000 and no returns yields 12,200 per item and 1,220,000 before advertising. Existing automated tests verify the unchanged calculations.

## Guided inputs and report chapters

The first unanswered visible input receives a shaded background across the selected diagnosis, cost step, goal dialog and report forms. A focused edit keeps its highlight until blur/Tab, so the first digit does not prematurely advance the guide. Numeric controls display raw digits while editing and add grouping only on blur; no asynchronous caret writes run during typing. After ten seconds in an unanswered field, the reference-value control becomes orange and an adjacent hint explains how to use it. Applying a reference, changing steps or leaving the journey clears the previous timer and emphasis. Reference fees and return-handling examples are explicitly marked as assumptions.

Report chapter buttons span the content width and describe the next chapter. The redundant overview-to-keyword button is removed; the last chapter's continuation and report tabs retain navigation. The signup notice ignores stale close events from a cleanup/reopen cycle.

Reorder planning uses a month calendar anchored to an editable selling start date (initially today in Asia/Seoul). Deadline = target days minus lead time, clamped to zero. Recommended date = deadline minus a planning buffer of 25% of lead days (rounded up, at most seven days), clamped to zero. UTC date-only arithmetic avoids DST shifts. The calendar marks recommended reorder, deadline and depletion dates, shows safe/risk days and supports month navigation. Zero lead time and lead times exceeding the selling period are supported. This is a steady-sales plan, not an inventory forecast or guarantee. Report navigation places the small previous button below the full-width next action.
