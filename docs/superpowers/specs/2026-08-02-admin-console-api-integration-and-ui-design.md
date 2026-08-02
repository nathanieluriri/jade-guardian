# Admin Console: API Integration, Typed Forms, and UI Responsiveness

Date: 2026-08-02
Status: Approved (design)
Repos touched: `Marcus-cleaning-admin-frontend` (this worktree), `Marcus-cleaning-backend`

## Problem

The admin console has three classes of problem, reported together but with different root causes.

**1. Broken pages.** `/admin/security/sessions` renders a client-side exception white
screen. `/admin/permissions/templates` renders a bare "Failed to load role templates."
string with no retry and no way to pick a different role.

**2. Forms are not proper.** Free-text inputs where a constrained picker belongs, raw
`all` sentinel values leaking into filter dropdowns, single-select where multi-select is
needed, and records rendered as untyped key/value blobs.

**3. The UI feels slow.** Clicks have no immediate feedback, navigation blocks on data,
and revisiting a page refetches from scratch.

## Root cause of problem 2

Nine admin features — service definitions, add-ons, pricing rules, service areas,
cleaner tags, availability overrides, promo codes, payout adjustments, chat
interventions — are served by a single **schemaless generic CRUD factory**.

`server/schemas/admin-features.ts` defines the request bodies as:

```ts
export const FeatureCreate = z.object({}).passthrough().openapi('AdminFeatureCreate')
export const FeatureUpdate = z.object({}).passthrough().openapi('AdminFeatureUpdate')
```

with an explicit `TODO: replace the passthrough shapes with the exact ported Pydantic
models`. `server/routes/admin-features/_crud.ts` builds every route from those shapes,
and `server/routes/admin-features/index.ts` wires all nine collections through it.

The backend therefore accepts arbitrary JSON for all nine features. The frontend mirrors
that: `OperationsCrudPage` supports exactly five field types — `text`, `number`,
`textarea`, `boolean`, `array_csv` — because there is no contract telling it that
`channel` is an enum or that `base_price` is a bounded number.

**Typed forms require typed contracts. This cannot be fixed in the frontend alone.**

## Design

### A. Backend: per-feature Zod schemas

Extend `CrudOptions` with optional `createSchema` / `updateSchema`. When absent,
`crudRouter` keeps today's passthrough behavior, so features migrate one at a time and
nothing breaks mid-migration.

Author concrete Zod schemas per feature: enums for `channel` / `audience` / `status`,
bounded numbers for prices and durations, required-field enforcement, date-range
validation. Because the project uses `@hono/zod-openapi`, these schemas propagate into
the OpenAPI document automatically — the enums become discoverable contract rather than
frontend guesswork.

**Contract-parity note.** The backend's `CLAUDE.md` requires preserving request/response
shapes, and tightening a schemaless endpoint is technically breaking. The two mobile
clients do not consume these admin endpoints, so the blast radius is the admin console
only. Each tightened endpoint must be recorded in
`docs/migration/07-domain-endpoints.md` under "Deliberate changes."

### B. Backend: shared templates collection

Add a tenth CRUD collection, `admin_feature_templates`, with documents shaped:

```json
{ feature: string, name: string, description?: string, payload: object }
```

One router serves templates for every feature. This is deliberately *not* per-feature
template endpoints: broadcasts, service definitions, and all other Operations screens
reuse the same collection and the same frontend picker, so the cost is paid once and
templates are shared across the team and persistent.

### C. Frontend: richer field types

Extend `CrudField["type"]` beyond the current five with `select`, `radio`,
`multiselect`, `date`, and `money`, and have each feature declare its real fields.
Mapping to the reported symptoms:

- `radio` — 2-4 fixed choices render as a segmented control, all options visible.
- `select` — constrained pickers replace free-text `audience` / `channel` / `status`.
- `multiselect` — permissions, tags, and service areas accept several values.
- Filter selects get proper labels ("All statuses") instead of a raw `all` sentinel.

### D. Frontend: API integration audit

`src/lib/api/admin-api.ts` (976 lines) is the single integration surface against a spec
with 223 paths. Audit it against `api-1.json` for the failure modes that produce exactly
the reported symptoms:

- **Path drift** — a client path that no longer matches any spec path (produces 404s
  surfacing as "Failed to load", the Role Templates symptom).
- **Shape drift** — response fields the client destructures that the spec does not
  declare (produces render-time crashes, the Sessions symptom).
- **Envelope handling** — every backend response is
  `{ success, message, data, requestId }`; confirm the client unwraps consistently.
- **Naming aliases** — the spec carries both snake_case and camelCase in places; confirm
  the client tolerates both rather than silently reading `undefined`.

Output is a defect list. Confirmed defects are fixed in Batch 1; anything requiring a
contract change moves to Batch 2. The audit is mechanical (client call sites diffed
against the spec), not a rewrite of the integration layer.

### E. Frontend: broken-page fixes

- `SessionsPage` — guard `active_sessions_by_admin` before `Object.entries`; the field
  being absent from the response currently throws during render.
- `RoleTemplatesPage` — replace the bare error string with a retry affordance, so a
  failure for one role is recoverable. Implemented as two independent sections (one
  per role) rendered side by side, each with its own loading/error/retry state --
  deliberately no role selector, since both role templates are shown at once.

### F. Frontend: responsiveness

- Optimistic mutations with rollback on error.
- Skeleton rows matching final layout, replacing centered spinners.
- Route-level `loading.tsx` per admin route so navigation paints immediately.
- Sidebar links prefetch on hover; React Query `staleTime` / `placeholderData` tuned so
  revisits are instant.
- Every action button shows a pending state immediately and blocks double-submit.

### G. Frontend: visual fixes

- **Scrollbar.** `.scrollbar-thin` in `src/index.css` is applied only to the sidebar.
  Promote a modern slim scrollbar to the global default across the app.
- **Sidebar Overview icon.** All sidebar icons render at `h-[22px] w-[22px]`, but
  `LayoutDashboard`'s glyph reads optically off-center against the single-shape icons
  beside it. Fix by rendering icons in a consistent fixed-size centered box and swapping
  `LayoutDashboard` for the symmetric `LayoutGrid`. Verify visually, not by inspection.

## Batching

**Batch 1 — frontend only, no backend dependency.** API integration audit, sessions crash guard, role-templates
error/retry (two independent role sections, no role selector), global slim scrollbar,
sidebar icon alignment, route-level `loading.tsx`, skeletons, optimistic mutations,
hover prefetch and query-cache tuning, pending/no-double-submit button states.

**Batch 2 — backend and frontend.** Per-feature Zod schemas, the `admin_feature_templates`
collection and picker, the richer `CrudField` types, and the Operations Core deep pass.

Batch 1 ships independently because broken pages are visible to every admin today and
none of those fixes wait on a contract change.

## Verification

- Backend: `npm run typecheck` and `npm run lint` must pass; `npm test` for touched areas.
- Frontend: `npm test` (Vitest); Playwright e2e for the previously-crashing routes.
- Visual claims (scrollbar, icon centering, perceived responsiveness) are verified in a
  browser, not by reading the diff.

## Out of scope

- Any change to customer or cleaner endpoints.
- Refactoring admin screens unrelated to the reported problems.
- Porting the full original Pydantic models for features outside the nine listed above.
