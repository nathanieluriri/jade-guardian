# Alert Center Redesign Audit

Date: March 17, 2026  
Project: Marcus Cleaning Admin Frontend

## Scope
- Alert Center (`/admin/security/alerts`)
- Alert-adjacent behavior language (Overview/Command surfaces via shared `AlertCard`)

## UX Framework Summary
- 7 UX factors focus: `Usable`, `Findable`, `Desirable`, `Accessible`
- 5 usability characteristics focus: `Efficiency`, `Error tolerance`, `Ease of learning`
- 5 interaction dimensions focus: `Words`, `Visual representations`, `Time`, `Behavior`

## Core Issues Addressed
1. Filter/action category mismatch that increased cognitive load.
2. Visual clutter from always-visible bulk actions and repetitive state labels.
3. Weak scanability in dense alert lists.
4. Timestamp readability and metadata noise.

## Implemented Decisions
1. **Filter bar vs selection toolbar split**
- No selection: show filter/search controls only.
- 1+ selection: replace filter row with contextual bulk action bar.

2. **Selection-state workflow**
- `n_selected > 0` reveals `Mark Read`, `Acknowledge`, `Export`.
- Row-level `Investigate` is suppressed while selection mode is active.

3. **Scannability improvements**
- Unread rows: tinted background + stronger title weight + dot marker.
- Read rows: neutral background + regular title weight.
- Acknowledgement/read states shown through compact icon/badge language.

4. **Temporal readability**
- Relative “Last fired” in row body.
- Exact ISO timestamp available on hover.

## Acceptance Checklist
- Bulk action visibility follows `n_selected` logic exactly.
- Filter controls are never mixed with mutating actions.
- Keyboard navigation works for row checkboxes and action buttons.
- Severity badges remain high-contrast and visually distinct.
- Selection mode clears and restores default toolbar after action completion.

## Next UX Iterations
1. Add persistent saved searches (server-backed).
2. Add undo affordances for bulk state mutations.
3. Run contrast tooling pass for WCAG AA confirmation across all severity/read variants.

