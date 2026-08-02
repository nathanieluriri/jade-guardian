# Admin Console Batch 3a Implementation Plan — make Broadcasts actually send

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Point the Broadcasts screen at the notification API that actually delivers, replacing a form whose "send" wrote a database row and reached nobody.

**Architecture:** A bespoke composer replaces the generic CRUD form — the shared `OperationsCrudPage` cannot express an audience whose fields change with its type, nor a mandatory preview gate. Frontend-only; the backend already has everything.

**Tech Stack:** Next.js 15 App Router, React 18, TanStack Query v5, Tailwind, shadcn/ui, Vitest + Testing Library, Playwright.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-02-broadcasts-and-templates-addendum.md`.
- **Frontend repo only.** `C:\Users\Mr Dashi\Downloads\Marcus-cleaning-admin-frontend\.claude\worktrees\api-integration-ui-fixes-47640b`, branch `claude/api-integration-ui-fixes-47640b`. The backend needs no change — do not touch `Marcus-cleaning-backend`. Read it for contract reference only.
- This repo USES the trailer `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- No `--no-verify`. Gates: `npm test`, `npm run lint`, `npm run build`.
- Tests in `src/test/`, Vitest + jsdom, `@` aliased to `./src`. Fetch mocked per `src/test/admin-api-lists.test.ts` (`jsonResponse`, `envelope`, `vi.stubGlobal`).
- Backend envelope is always `{ success, message, data, requestId }`.

## The contract (authoritative — read the backend source, do not guess)

Source of truth: `Marcus-cleaning-backend/app/server/schemas/broadcast.ts` and
`server/routes/admin-broadcasts.ts`. Read both before Task 1.

| Method | Path | Body → Response |
|---|---|---|
| GET | `/v1/admins/notifications/types` | → `string[]` |
| POST | `/v1/admins/notifications/broadcasts/preview` | `BroadcastAudience` → `AudiencePreviewOut` |
| POST | `/v1/admins/notifications/broadcasts` | `BroadcastCreateRequest` → `BroadcastOut` (201) |
| GET | `/v1/admins/notifications/broadcasts?cursor&pageSize` | → `BroadcastListOut` |
| GET | `/v1/admins/notifications/broadcasts/{id}` | → `BroadcastOut` |
| POST | `/v1/admins/notifications/broadcasts/{id}/resume` | → `BroadcastOut` |
| POST | `/v1/admins/notifications/broadcasts/{id}/cancel` | → `BroadcastOut` |

**Two traps, both of which will silently produce wrong behaviour:**

1. **This list is cursor-paginated.** Query is `cursor` + `pageSize`; the response is
   `{ items, nextCursor, pageSize }` — *not* the `{ items, total }` with `limit`/`skip`
   that every other admin list uses. The existing `listAdminResource` helper is wrong
   here. Do not reuse it, and do not send `limit`/`skip`.
2. **`audience` is a nested object with conditional requirements**, validated by
   `superRefine` server-side. It is not a flat string.

### Audience types and their conditional fields

```
ALL, ALL_CUSTOMERS, ALL_CLEANERS   → no extra fields
USER_IDS                           → REQUIRES userIds (string[], max 10000) AND role ('customer' | 'cleaner')
CUSTOMERS_INACTIVE                 → REQUIRES inactiveDays (int 1..3650)
CUSTOMERS_WITH_BOOKINGS            → no extra fields
CUSTOMERS_NEVER_BOOKED             → no extra fields
CLEANERS_BY_ONBOARDING             → REQUIRES onboardingStatus
                                     ('NOT_STARTED'|'IN_PROGRESS'|'PENDING_REVIEW'|'APPROVED'|'REJECTED')
```

### Create request

`title` (1..120), `body` (1..500), `audience`, `type` (string, defaults `'promo.broadcast'`),
`promoId?`, `promoCode?`, `data?` (`Record<string,string>`).

### Status lifecycle

`DRAFT | QUEUED | SENDING | SENT | FAILED | CANCELLED`, with `recipientCount`,
`processedCount`, `sentCount`, `failedCount`.

## The safety property this batch exists to create

**An admin must not be able to send without having previewed.** This screen reaches every
user of the platform at once. The preview returns `suppressedByOptOut` and
`reachableByPush`; sending blind is how a marketing blast goes to an audience nobody
intended. Tasks 4, 5 and 8 all enforce this, and Task 8 verifies it in a real browser.

---

### Task 1: Domain types for broadcasts

**Files:**
- Create: `src/lib/api/broadcast-types.ts`
- Test: none (types only; Task 2's tests exercise them)

**Interfaces:**
- Produces: `AudienceType`, `BroadcastAudience`, `AudiencePreviewOut`, `BroadcastOut`, `BroadcastListOut`, `BroadcastCreateRequest`, `BroadcastStatus`, plus `AUDIENCE_TYPES`, `ONBOARDING_STATUSES` and `AUDIENCE_REQUIREMENTS` as runtime values. Tasks 2-7 all consume these.

- [ ] **Step 1: Read the backend schema first**

Open READ ONLY `C:\Users\Mr Dashi\Downloads\Marcus-cleaning-backend\app\server\schemas\broadcast.ts`.
Mirror it exactly. If anything in this plan's summary disagrees with that file, **the file wins** — say so in your report.

- [ ] **Step 2: Write the types**

Create `src/lib/api/broadcast-types.ts`. Mirror the backend, and additionally export a
machine-readable description of the conditional requirements so the audience builder and
its validation cannot drift from each other:

```ts
export const AUDIENCE_TYPES = [
  "ALL", "ALL_CUSTOMERS", "ALL_CLEANERS", "USER_IDS",
  "CUSTOMERS_INACTIVE", "CUSTOMERS_WITH_BOOKINGS",
  "CUSTOMERS_NEVER_BOOKED", "CLEANERS_BY_ONBOARDING",
] as const;
export type AudienceType = (typeof AUDIENCE_TYPES)[number];

export const ONBOARDING_STATUSES = [
  "NOT_STARTED", "IN_PROGRESS", "PENDING_REVIEW", "APPROVED", "REJECTED",
] as const;

/** Which extra fields each audience type requires — mirrors the backend superRefine. */
export const AUDIENCE_REQUIREMENTS: Record<AudienceType, ReadonlyArray<"userIds" | "role" | "inactiveDays" | "onboardingStatus">> = {
  ALL: [],
  ALL_CUSTOMERS: [],
  ALL_CLEANERS: [],
  USER_IDS: ["userIds", "role"],
  CUSTOMERS_INACTIVE: ["inactiveDays"],
  CUSTOMERS_WITH_BOOKINGS: [],
  CUSTOMERS_NEVER_BOOKED: [],
  CLEANERS_BY_ONBOARDING: ["onboardingStatus"],
};
```

Then `BroadcastAudience`, `AudiencePreviewOut`, `BroadcastOut`, `BroadcastListOut`,
`BroadcastCreateRequest` and `BroadcastStatus` as TypeScript interfaces mirroring the Zod
shapes. Give `AudiencePreviewOut` all six numeric fields — `total`, `customers`,
`cleaners`, `reachableByPush`, `matchedBeforeOptOut`, `suppressedByOptOut`.

- [ ] **Step 3: Verify and commit**

Run: `npm run build` → succeeds.

```bash
git add src/lib/api/broadcast-types.ts
git commit -m "feat(admin-web): domain types for the real notification broadcast API

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: API client functions

**Files:**
- Modify: `src/lib/api/admin-api.ts`
- Test: `src/test/broadcast-api.test.ts` (create)

**Interfaces:**
- Produces: `fetchNotificationTypes()`, `previewBroadcastAudience(audience)`, `createBroadcast_v2(payload)`, `listNotificationBroadcasts({ cursor?, pageSize? })`, `fetchNotificationBroadcast(id)`, `resumeBroadcast(id)`, `cancelBroadcast(id)`.

**Naming note:** `createBroadcast` already exists for the legacy collection and is still
used by the old page until Task 7 removes it. Pick a non-colliding name and say what you
chose. Do not delete the legacy functions in this task.

- [ ] **Step 1: Write the failing test**

Create `src/test/broadcast-api.test.ts`. Follow `src/test/admin-api-lists.test.ts` for the
mock helpers. Cover at minimum:

- `listNotificationBroadcasts()` sends `pageSize` and `cursor` as query params and sends **neither `limit` nor `skip`** — assert on the exact URL.
- `listNotificationBroadcasts()` returns `{ items, nextCursor, pageSize }` intact; it must NOT be flattened to a bare array (the cursor is needed for paging).
- `previewBroadcastAudience()` POSTs the audience object as the body.
- `createBroadcast_v2()` POSTs to `/v1/admins/notifications/broadcasts` — assert the path, since the legacy path differs by one segment.
- `resumeBroadcast(id)` / `cancelBroadcast(id)` POST to the right sub-paths.

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run src/test/broadcast-api.test.ts`

- [ ] **Step 3: Implement**

Add the seven functions to `admin-api.ts`, following the file's existing style (unwrap
`response.data`). Build the list query with `URLSearchParams`, omitting absent params.

- [ ] **Step 4: Run the path-parity audit**

Run: `npx vitest run src/test/api-path-parity.test.ts`

This audit pins every client path against the OpenAPI spec, and its floor assertion is
currently `> 81`. Adding paths should raise the count. **Raise the floor to match** — that
is the mechanism that catches a future silent drop.

- [ ] **Step 5: Full gates and commit**

Run: `npm test && npm run lint && npm run build`

```bash
git add src/lib/api/admin-api.ts src/test/broadcast-api.test.ts src/test/api-path-parity.test.ts
git commit -m "feat(admin-web): client for the notification broadcast API

Cursor-paginated, unlike every other admin list.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Audience builder

**Files:**
- Create: `src/features/admin/screens/governance/AudienceBuilder.tsx`
- Test: `src/test/audience-builder.test.tsx` (create)

**Interfaces:**
- Consumes: `AUDIENCE_TYPES`, `ONBOARDING_STATUSES`, `AUDIENCE_REQUIREMENTS`, `BroadcastAudience` from Task 1.
- Produces: `AudienceBuilder({ value, onChange })`, and a pure `validateAudience(audience): string | null` exported from the same module — Tasks 4-5 use the validator without rendering.

- [ ] **Step 1: Write the failing test**

Create `src/test/audience-builder.test.tsx`. Test `validateAudience` directly for the
rules, and render only for the conditional-field behaviour:

- `{ type: "ALL" }` is valid.
- `{ type: "USER_IDS" }` is invalid; adding only `userIds` is still invalid (needs `role`); with both it is valid.
- `{ type: "CUSTOMERS_INACTIVE" }` is invalid without `inactiveDays`; `inactiveDays: 0` and `3651` are invalid; `30` is valid.
- `{ type: "CLEANERS_BY_ONBOARDING" }` is invalid without `onboardingStatus`.
- Rendering with `type: "ALL"` shows no conditional inputs; switching to `CUSTOMERS_INACTIVE` reveals an inactive-days input; switching to `CLEANERS_BY_ONBOARDING` reveals a status picker and **hides** the inactive-days input.
- Switching type **clears** fields that no longer apply — a stale `inactiveDays` must not be submitted with `CLEANERS_BY_ONBOARDING`.

That last one matters: the backend does not reject extra keys here, so a stale field would ride along silently.

- [ ] **Step 2: Run it and confirm it fails**

- [ ] **Step 3: Implement**

Drive the conditional fields from `AUDIENCE_REQUIREMENTS` rather than a hand-written
switch, so the UI cannot drift from the validator. Use the existing shadcn `select.tsx`,
`radio-group.tsx` and `input.tsx`. `userIds` is a textarea parsed as newline- or
comma-separated, trimmed, with blanks dropped.

- [ ] **Step 4: Verify and commit**

Run: `npm test && npm run lint && npm run build`

```bash
git add src/features/admin/screens/governance/AudienceBuilder.tsx src/test/audience-builder.test.tsx
git commit -m "feat(admin-web): audience builder with conditional fields per audience type

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Preview panel and the send gate

**Files:**
- Create: `src/features/admin/screens/governance/BroadcastPreview.tsx`
- Test: `src/test/broadcast-preview.test.tsx` (create)

**Interfaces:**
- Consumes: `previewBroadcastAudience` (Task 2), `AudiencePreviewOut` (Task 1), `validateAudience` (Task 3).
- Produces: `BroadcastPreview({ audience, onPreviewed })`, plus a pure `canSend({ preview, audience, dirtySincePreview }): boolean`.

**This is the safety-critical task.** `canSend` must be pure and directly testable —
Task 5 wires it to the button and Task 8 verifies it in a browser.

- [ ] **Step 1: Write the failing test**

Cover `canSend` exhaustively; it is the gate:

- no preview yet → `false`
- preview present, audience unchanged since → `true`
- preview present but the audience was edited afterwards (`dirtySincePreview`) → **`false`** (the count is now stale and must be re-previewed)
- audience invalid → `false` even if a preview exists

And for the panel: it renders `total`, `reachableByPush` and `suppressedByOptOut`, and
shows a clear warning when `suppressedByOptOut > 0` so an admin understands the gap
between matched and reached.

- [ ] **Step 2: Run it and confirm it fails**

- [ ] **Step 3: Implement**

Preview is an explicit button, not automatic on every keystroke — it hits the database.
Editing the audience after previewing must invalidate the preview.

- [ ] **Step 4: Verify and commit**

Run: `npm test && npm run lint && npm run build`

```bash
git add src/features/admin/screens/governance/BroadcastPreview.tsx src/test/broadcast-preview.test.tsx
git commit -m "feat(admin-web): recipient preview with a send gate

Editing the audience after previewing invalidates the count, so nobody
sends against a stale number.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: The composer

**Files:**
- Create: `src/features/admin/screens/governance/BroadcastComposer.tsx`
- Test: `src/test/broadcast-composer.test.tsx` (create)

**Interfaces:**
- Consumes: everything from Tasks 1-4, plus `fetchNotificationTypes` and `createBroadcast_v2`.
- Produces: `BroadcastComposer()`.

- [ ] **Step 1: Write the failing test**

- Title and body are required; body is capped at 500 and title at 120 — assert the caps, since the server rejects beyond them.
- The type picker is populated from `fetchNotificationTypes()`, defaulting to `promo.broadcast` when present.
- **Send is disabled until a successful preview**, and re-disables when the audience changes.
- A successful send calls `createBroadcast_v2` once with the exact payload shape (nested `audience`, not flattened) and shows a confirmation.
- Send failure surfaces an error and does NOT clear the composed message — an admin must not lose a drafted blast to a transient failure.

- [ ] **Step 2: Run it and confirm it fails**

- [ ] **Step 3: Implement**

Compose the type picker, `AudienceBuilder`, `BroadcastPreview` and the send action. Use
the pending/double-submit conventions already in this codebase.

- [ ] **Step 4: Verify and commit**

Run: `npm test && npm run lint && npm run build`

```bash
git add src/features/admin/screens/governance/BroadcastComposer.tsx src/test/broadcast-composer.test.tsx
git commit -m "feat(admin-web): broadcast composer gated on a fresh recipient preview

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Broadcast list with progress, resume and cancel

**Files:**
- Create: `src/features/admin/screens/governance/BroadcastList.tsx`
- Test: `src/test/broadcast-list.test.tsx` (create)

**Interfaces:**
- Consumes: `listNotificationBroadcasts`, `resumeBroadcast`, `cancelBroadcast`, `BroadcastOut`.
- Produces: `BroadcastList()`.

- [ ] **Step 1: Write the failing test**

- Renders status and progress (`processedCount` of `recipientCount`, plus `sentCount` / `failedCount`).
- **Resume is offered only for a resumable status** and Cancel only for an in-flight one — a `SENT` broadcast must offer neither. Decide the exact mapping from the `BroadcastStatus` union and state it in your report; `SENT`, `CANCELLED` and `FAILED` are terminal.
- Cancel asks for confirmation before firing — it stops a send mid-flight and cannot be undone.
- `nextCursor` drives a "Load more" affordance; absent `nextCursor` means no more pages.

- [ ] **Step 2: Run it and confirm it fails**

- [ ] **Step 3: Implement**

Use `TableSkeleton` for loading, per the codebase convention.

- [ ] **Step 4: Verify and commit**

Run: `npm test && npm run lint && npm run build`

```bash
git add src/features/admin/screens/governance/BroadcastList.tsx src/test/broadcast-list.test.tsx
git commit -m "feat(admin-web): broadcast list with progress, resume and cancel

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: Swap the route and fix the permission requirement

**Files:**
- Modify: `src/features/admin/screens/governance/BroadcastsPage.tsx`
- Modify: `src/lib/admin-access.ts` (line ~113)
- Test: `src/test/broadcasts-route.test.tsx` (create)

- [ ] **Step 1: Read the current permission wiring**

Run: `grep -n "governance/broadcasts" src/lib/admin-access.ts`

It currently requires `GET /v1/admins/broadcasts` — the legacy path. The page will no
longer call that, so the requirement must move to
`GET /v1/admins/notifications/broadcasts` or an admin with the right permission is
gated out of a page they can use (or worse, let into one they cannot).

- [ ] **Step 2: Write the failing test**

Assert `ADMIN_ROUTE_REQUIREMENTS["/admin/governance/broadcasts"]` names the notifications
path, and that `BroadcastsPage` renders the composer and the list.

- [ ] **Step 3: Implement**

Rewrite `BroadcastsPage` to compose `BroadcastComposer` + `BroadcastList`. Update the
requirement. Remove the legacy `OperationsCrudPage` usage from this page.

Leave the legacy `listBroadcasts`/`createBroadcast`/`updateBroadcast`/`deleteBroadcast`
client functions in `admin-api.ts` if anything still imports them — check with grep and
report what you found. Removing a still-used export breaks the build; removing an unused
one is fine and preferable.

- [ ] **Step 4: Verify and commit**

Run: `npm test && npm run lint && npm run build`

```bash
git add src/features/admin/screens/governance/BroadcastsPage.tsx src/lib/admin-access.ts src/test/broadcasts-route.test.tsx
git commit -m "fix(admin-web): point Broadcasts at the API that actually delivers

The legacy /broadcasts dispatch wrote a row labelled DISPATCHED and sent
nothing. Also moves the route's permission requirement, which still
named the legacy path.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: E2E — prove the send gate holds in a browser

**Files:**
- Create: `e2e/admin-broadcast-composer.spec.ts`

**Interfaces:**
- Consumes: the `page.route` stubbing and auth preamble from `e2e/admin-repaired-pages.spec.ts`.

- [ ] **Step 1: Read the existing e2e pattern**

Run: `cat e2e/admin-repaired-pages.spec.ts`

No backend is needed — every `/api/**` call is stubbed and Playwright boots the dev
server itself. Reuse that preamble, granting the profile the notifications-broadcasts
GET permission.

- [ ] **Step 2: Write the spec**

Three assertions, in priority order:

1. **Send is disabled before previewing.** Fill title, body and an audience; assert the send control is disabled and that no POST to `/notifications/broadcasts` occurred.
2. **Send enables after a successful preview**, which displays the recipient count.
3. **Editing the audience after previewing disables send again.** This is the stale-count case and the one most likely to regress.

Stub `/notifications/types`, `/notifications/broadcasts/preview` and
`/notifications/broadcasts`. Assert on request interception for the "no POST happened"
case rather than on UI state alone.

- [ ] **Step 3: Run it**

Run: `npx playwright test e2e/admin-broadcast-composer.spec.ts`

If the browser cannot be installed, say so plainly and leave the assertions intact. Do NOT
add `test.skip` or loosen a selector to force a green run.

- [ ] **Step 4: Commit**

```bash
git add e2e/admin-broadcast-composer.spec.ts
git commit -m "test(admin-web): e2e proof that a broadcast cannot be sent unpreviewed

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Batch 3a Completion Checklist

- [ ] `npm test`, `npm run lint`, `npm run build` all pass.
- [ ] `npx playwright test` passes.
- [ ] The path-parity floor assertion was raised to match the new count.
- [ ] Sending without a preview is impossible, verified in a real browser.
- [ ] `admin-access.ts` names the notifications path, not the legacy one.
- [ ] No change was made to the `Marcus-cleaning-backend` repo.

## Explicitly NOT done

- **Scheduling.** The real API has no schedule field. The old form's `schedule_epoch` is dropped rather than faked.
- The legacy `/broadcasts` backend router is untouched, per contract parity.
- Templates — Batch 3b, which now has a working send path to attach to.
