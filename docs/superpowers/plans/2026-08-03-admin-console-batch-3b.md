# Admin Console Batch 3b — shared templates

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the templates the repo owner originally asked for — "create templates so user can just send them" and "service definitions and stuff should have templates" — as one shared, persistent, team-visible collection rather than per-feature special cases.

**Architecture:** A single `admin_feature_templates` collection keyed by feature, served by the existing `crudRouter` with a **typed** wrapper schema. One picker component reused by the Operations CRUD form (which covers five screens at once) and by the broadcast composer.

**Tech Stack:** Backend — Next.js 16, Hono, `@hono/zod-openapi`, MongoDB, Vitest. Frontend — Next.js 15, React 18, TanStack Query v5, shadcn/ui, Vitest, Playwright.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-02-admin-console-api-integration-and-ui-design.md` §B, and `2026-08-02-broadcasts-and-templates-addendum.md`.
- **Two repos.** Frontend `C:\Users\Mr Dashi\Downloads\Marcus-cleaning-admin-frontend\.claude\worktrees\api-integration-ui-fixes-47640b`; backend `C:\Users\Mr Dashi\Downloads\Marcus-cleaning-backend\app`. Both are on a branch named `claude/admin-feature-templates`, off their respective merged mainlines. Each task names its repo; never edit the other.
- **Backend commits must NOT carry a Claude/Anthropic co-author trailer** (`app/CLAUDE.md`). The frontend repo DOES use `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`. Opposite conventions, deliberately.
- Backend layering: `routes → services → repositories → schemas`. Only repositories import `mongodb`.
- Envelope is always `{ success, message, data, requestId }`.
- No `--no-verify`. Backend gates: `npm run typecheck && npm run lint && npm test`. Frontend gates: `npm test && npm run lint && npm run build`.

## The design decision that matters most

`payload` holds a feature's field values, which differ per feature — a service-definition template and a promo template have nothing in common. So `payload` is `z.record(z.string(), z.unknown())`: **arbitrary by design**.

That is NOT a repeat of the mistake this whole effort has been unwinding. The original sin was that the *wrapper* was untyped — nothing validated anything, and a typo'd field silently vanished. Here the wrapper is strictly typed (`feature` constrained to a known set, `name` required and bounded), and only the inner blob is open, because it genuinely must be.

**Consequence to design around:** a template's payload is a snapshot taken at save time. A template saved before a schema tightened may carry fields the current schema rejects. **Applying a template must populate the form and then let the normal validation run** — it must never bypass validation or write directly. Task 5 tests this explicitly.

## Feature keys (authoritative)

Templates are scoped by a `feature` string. Constrain it to exactly these, matching the screens that will offer templates:

```
service-definitions, add-ons, pricing-rules, service-areas, promo-codes, broadcasts
```

An unconstrained `feature` would let a typo orphan a template where no screen ever lists it.

---

### Task 1: Backend — the templates schema

**Repo:** backend. **Files:** modify `server/schemas/admin-features.ts`; test `tests/admin-template-schema.test.ts` (create).

**Produces:** `TEMPLATE_FEATURES` (runtime array), `TemplateFeature` (type), `FeatureTemplateCreate`, `FeatureTemplateUpdate`.

- [ ] **Step 1: Read how the existing canonical schemas are written**

Run: `grep -n "export const ServiceDefinitionCreate" -A 30 server/schemas/admin-features.ts`

Match that style exactly — plain `z.object` (unknown keys stripped, not `.passthrough()`, not `.strict()`), a doc comment explaining the reasoning, `.openapi('...')` tags, `Update = Create.partial()`.

- [ ] **Step 2: Write the failing test**

Create `tests/admin-template-schema.test.ts` covering:
- a valid template parses (`feature: 'promo-codes'`, `name`, `payload: { code: 'X' }`)
- an unknown `feature` is REJECTED
- an empty `name` is rejected; a name over 120 chars is rejected
- `description` is optional
- `payload` accepts an arbitrary object, including nested values and numbers — this is deliberate, assert it rather than leaving it implied
- `payload` is REQUIRED (a template with no payload is useless)
- unknown top-level keys are stripped, not stored
- `FeatureTemplateUpdate` makes everything optional

- [ ] **Step 3: Run it and confirm it fails**

Run: `npx vitest run tests/admin-template-schema.test.ts`

- [ ] **Step 4: Implement**

```ts
export const TEMPLATE_FEATURES = [
  'service-definitions', 'add-ons', 'pricing-rules',
  'service-areas', 'promo-codes', 'broadcasts',
] as const
export type TemplateFeature = (typeof TEMPLATE_FEATURES)[number]

/**
 * A saved, reusable starting point for one admin feature's form.
 *
 * The WRAPPER is strictly typed — `feature` is constrained so a typo cannot
 * orphan a template under a key no screen lists, and `name` is required so a
 * template is always pickable by a human. `payload` is deliberately open: it
 * holds one feature's field values, and a service definition and a promo code
 * share no shape. That openness is scoped to the blob, unlike the historical
 * `FeatureCreate` passthrough where nothing at all was validated.
 *
 * A payload is a snapshot from save time and may predate a schema change, so
 * applying a template must fill the form and let normal validation run — never
 * write straight through.
 */
export const FeatureTemplateCreate = z
  .object({
    feature: z.enum(TEMPLATE_FEATURES),
    name: z.string().min(1).max(120),
    description: z.string().max(500).optional(),
    payload: z.record(z.string(), z.unknown()),
  })
  .openapi('FeatureTemplateCreate')
export type FeatureTemplateCreate = z.infer<typeof FeatureTemplateCreate>

export const FeatureTemplateUpdate = FeatureTemplateCreate.partial().openapi('FeatureTemplateUpdate')
export type FeatureTemplateUpdate = z.infer<typeof FeatureTemplateUpdate>
```

- [ ] **Step 5: Verify and commit**

Run: `npx vitest run tests/admin-template-schema.test.ts` → PASS. Then `npm run typecheck && npm run lint && npm test`.

```bash
git add server/schemas/admin-features.ts tests/admin-template-schema.test.ts
git commit -m "feat(admin-features): typed schema for shared feature templates

The wrapper is strictly typed; only the payload blob is open, because a
service-definition template and a promo template share no shape."
```

---

### Task 2: Backend — mount the templates router

**Repo:** backend. **Files:** modify `server/routes/admin-features/index.ts`; test `tests/admin-template-route.test.ts` (create).

- [ ] **Step 1: Read how an existing feature is wired**

Run: `sed -n '1,60p' server/routes/admin-features/index.ts`

- [ ] **Step 2: Write the failing test**

Assert the router builds with the template schemas attached, and — following the pattern already used by `tests/admin-feature-crud-schema.test.ts` — introspect the generated OpenAPI document to confirm the POST body is `FeatureTemplateCreate` and the PATCH body is `FeatureTemplateUpdate`, and that the two differ. A `toBeDefined()`-only assertion is not acceptable; that exact weakness was found and fixed earlier in this project.

- [ ] **Step 3: Implement**

```ts
const featureTemplates = crudRouter({
  collection: 'admin_feature_templates',
  tag: 'FeatureTemplates',
  noun: 'template',
  createSchema: FeatureTemplateCreate,
  updateSchema: FeatureTemplateUpdate,
})
...
adminFeatures.route('/feature-templates', featureTemplates)
```

**Note the list endpoint has no feature filter.** `crudRouter`'s GET takes only `limit`/`skip`. The frontend will fetch all templates and filter client-side. Templates are few and admin-only, so this is acceptable — **say so in your report** rather than silently adding a query param the factory does not support.

- [ ] **Step 4: Verify and commit**

Gates, then commit (no Claude trailer).

---

### Task 3: Frontend — templates API client

**Repo:** frontend. **Files:** create `src/lib/api/template-types.ts`; modify `src/lib/api/admin-api.ts`; test `src/test/template-api.test.ts` (create).

**Produces:** `TEMPLATE_FEATURES`, `FeatureTemplate`, and `listFeatureTemplates()`, `createFeatureTemplate(payload)`, `deleteFeatureTemplate(id)`.

- [ ] **Step 1: Read the backend schema you are mirroring** (READ ONLY) at `C:\Users\Mr Dashi\Downloads\Marcus-cleaning-backend\app\server\schemas\admin-features.ts`. If it disagrees with this plan, the file wins — report it.

- [ ] **Step 2: Write the failing test**

Assert full request URLs (`/v1/admins/feature-templates`), that the list unwraps to a usable array consistent with the other `listAdminResource`-style helpers in the file, and that create POSTs the exact body.

- [ ] **Step 3: Implement, then run the path-parity audit**

Run: `npx vitest run src/test/api-path-parity.test.ts`. Adding paths raises the count — **raise the floor to match**, and report before/after.

- [ ] **Step 4: Gates and commit** (frontend trailer).

---

### Task 4: Frontend — the template picker

**Repo:** frontend. **Files:** create `src/features/admin/templates/TemplatePicker.tsx`; test `src/test/template-picker.test.tsx`.

**Produces:** `TemplatePicker({ feature, onApply })` and `SaveAsTemplateButton({ feature, payload })`.

- [ ] **Step 1: Write the failing test**

Cover:
- lists only templates whose `feature` matches the prop — a promo template must never appear on the service-definitions screen
- picking one calls `onApply` with that template's `payload`
- an empty list renders a clear empty state, not a broken dropdown
- a failed fetch degrades: the rest of the form still works and the failure is stated, not silent
- Save-as-template requires a non-empty name and blocks a duplicate submit

- [ ] **Step 2: Run, confirm failure, implement**

Use existing shadcn components. Follow this codebase's established conventions: a synchronous `useRef` in-flight guard on save (a `disabled` prop from `useState` does not commit until re-render — this exact race was found three times in the previous batch), and `TableSkeleton` or a simple inline skeleton for loading.

- [ ] **Step 3: Gates and commit.**

---

### Task 5: Frontend — wire the picker into the Operations CRUD form

**Repo:** frontend. **Files:** modify `src/features/admin/screens/operations/OperationsCrudPage.tsx`; test `src/test/operations-crud-templates.test.tsx`.

This one change reaches five screens at once. `OperationsCrudPage` is shared by **12** pages, so scope carefully.

- [ ] **Step 1: Write the failing test — the safety property first**

**Applying a template must populate the form and then run normal validation. It must never bypass validation or submit directly.** A template saved before a schema tightened can carry a field the current schema rejects; if applying wrote straight through, the admin would get an opaque 422 from data they never typed.

Assert:
- applying a template fills the form fields
- a template payload with an INVALID value (e.g. a required field empty) leaves submit DISABLED, exactly as if typed
- a template payload containing a key not in this feature's `fields` is ignored rather than injected into the payload
- a page that passes no `feature` prop shows no picker at all — the other seven consumers must be completely unaffected

That last one is the regression guard: seven pages share this component and must not change.

- [ ] **Step 2: Implement**

Add an OPTIONAL `templateFeature?: TemplateFeature` prop. Absent ⇒ no picker, no fetch, byte-identical behaviour. Pass it from the five Operations pages only.

- [ ] **Step 3: Gates and commit.**

---

### Task 6: Frontend — templates in the broadcast composer

**Repo:** frontend. **Files:** modify `src/features/admin/screens/governance/BroadcastComposer.tsx`; test `src/test/broadcast-composer-templates.test.tsx`.

This is the "so user can just send them" half of the original request.

- [ ] **Step 1: Write the failing test — and mind the send gate**

**Applying a template must NOT satisfy the send gate.** The gate requires a fresh recipient preview; a template can carry an audience, and if applying one left a stale preview considered valid, an admin could send to an audience they never previewed. That is the exact hazard the whole previous batch was built to prevent.

Assert:
- applying a template fills title, body, type and audience
- after applying, send is **disabled** until a new preview is taken
- saving a template captures title, body, type and audience — and does NOT capture the preview result, which is a transient fact about a moment, not part of a reusable template

- [ ] **Step 2: Implement**

Applying a template must route through the same handlers that latch `dirtySincePreview`, not set state directly behind their backs.

- [ ] **Step 3: Gates and commit.**

---

### Task 7: E2E — a template round-trip in a real browser

**Repo:** frontend. **Files:** create `e2e/admin-templates.spec.ts`.

- [ ] **Step 1: Reuse the existing pattern** in `e2e/admin-broadcast-composer.spec.ts` — `page.route` stubs, Playwright boots the dev server, no backend needed.

- [ ] **Step 2: Assert**

- save a composed broadcast as a template, and the POST body carries title/body/type/audience
- apply a template on a fresh load, the fields populate, and **send is disabled until a preview is taken**

- [ ] **Step 3: Run**

Run: `npx playwright test --workers=1` — the suite is flaky at default parallelism (dev-server contention, pre-existing and unrelated). It must remain green serially. If the browser cannot run here, say so plainly and leave assertions intact; do not add `test.skip`.

---

## Completion checklist

- [ ] Backend `npm run typecheck && npm run lint && npm test` pass; no Claude trailer on any backend commit.
- [ ] Frontend `npm test && npm run lint && npm run build` pass; `npx playwright test --workers=1` green.
- [ ] Applying a template never bypasses validation, and never satisfies the broadcast send gate.
- [ ] The seven non-Operations consumers of `OperationsCrudPage` are provably unaffected.
- [ ] Path-parity floor raised to match the new count.

## Explicitly NOT in this batch

- Template editing (create/apply/delete only — editing is a later nicety).
- Per-feature server-side filtering of the template list; the factory's GET takes only `limit`/`skip`, and client-side filtering is honest for a small admin-only collection.
- The seven governance/support forms.
