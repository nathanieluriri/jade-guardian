# Addendum: Broadcasts send nothing, and templates need somewhere real to attach

Date: 2026-08-02
Status: Approved (design)
Amends: `2026-08-02-admin-console-api-integration-and-ui-design.md` (section B, templates)
Repos: `Marcus-cleaning-admin-frontend`, `Marcus-cleaning-backend`

## Why this addendum exists

The original request asked for notification templates "so user can just send them".
Planning that surfaced a prerequisite: **the Broadcasts page cannot send anything.**

Building a template picker on it would produce a button that fills a form that saves a
row that reaches nobody — and looks like it worked. Templates need a working send path
underneath them first.

## Evidence

Two broadcast families exist. The console is wired to the wrong one.

**What the console uses — `/v1/admins/broadcasts`.** Its dispatch endpoint
(`server/routes/admin-features/broadcasts.ts:38-51`) is:

```ts
const record = await repo.insertRaw(COLL, {
  ...body, status: 'DISPATCHED', dispatchedBy: p.userId, dispatchedAt: ts,
})
```

It writes a row labelled `DISPATCHED`. No push, no email, no fan-out. The frontend does
not even call it — `admin-api.ts` has list/create/update/delete for broadcasts and **no
dispatch function at all**. The frontend has **zero** functions against
`/notifications/*`.

**What actually sends — `/v1/admins/notifications/broadcasts`.** The source says so
plainly (`server/routes/admin-broadcasts.ts:20-22`): *"The legacy `/broadcasts` CRUD
router over `system_broadcast` is left in place for contract parity; these live under
`/notifications/broadcasts` and are the ones with real fan-out behind them."*

That family is a complete, production-grade system that nothing uses:

| Endpoint | Purpose |
|---|---|
| `GET /notifications/types` | Catalogue a broadcast picks its type from |
| `POST /notifications/broadcasts/preview` | Dry run — how many people would this reach |
| `POST /notifications/broadcasts` | Queue a real send |
| `GET /notifications/broadcasts` | List with status and progress |
| `GET /notifications/broadcasts/{id}` | One broadcast |
| `POST /notifications/broadcasts/{id}/resume` | Process the next batch without waiting for cron |
| `POST /notifications/broadcasts/{id}/cancel` | Stop an in-flight send |

`server/schemas/broadcast.ts` backs it with:

- **8 audience types** with conditional validation — `USER_IDS` requires `role`,
  `CUSTOMERS_INACTIVE` requires `inactiveDays`, `CLEANERS_BY_ONBOARDING` requires
  `onboardingStatus`.
- **Recipient preview with opt-out accounting** — `total`, `customers`, `cleaners`,
  `reachableByPush`, `matchedBeforeOptOut`, `suppressedByOptOut`.
- **Resumable batched fan-out** — recipients frozen at dispatch so a serverless timeout
  cannot double-send or lose the remainder.
- **A real status lifecycle** — `DRAFT | QUEUED | SENDING | SENT | FAILED | CANCELLED`
  with `recipientCount` / `processedCount` / `sentCount` / `failedCount`.

The console's current form offers `audience` (free text), `channel`, `title`, `message`,
`schedule_epoch`, `status` — none of which map onto that contract.

## Decisions (approved)

1. **Rewire Broadcasts to the real notification API before adding templates.** Rejected:
   adding templates to the current page (decorative — composes messages the platform never
   delivers), and skipping notification templates entirely.
2. **Templates live in a shared backend `admin_feature_templates` collection**, as
   originally approved — one router, one picker, reused by broadcasts and every
   Operations screen, shared across the team and persistent.

## Scope

Split, because the send path must work before templates mean anything.

### Batch 3a — make Broadcasts actually send

- API client functions for all six `/notifications/*` endpoints.
- Replace the generic CRUD form with a real composer. The shared `OperationsCrudPage` is
  the wrong vehicle: this needs a type picker, an audience builder whose fields depend on
  the chosen audience type, and a preview step.
- **Preview before send is mandatory, not optional.** An admin must see the recipient
  count — including how many were suppressed by marketing opt-out — before the send
  button becomes available. This is the one screen in the console that can reach every
  user at once.
- A list showing status and progress, with resume and cancel.
- Update the route's permission requirement in `admin-access.ts`, which still points at
  the legacy `/v1/admins/broadcasts`.
- The legacy `/broadcasts` CRUD router stays untouched on the backend for contract
  parity. Only the console moves.

### Batch 3b — shared templates

- Backend `admin_feature_templates` collection: `{ feature, name, description?, payload }`,
  with a typed schema (not passthrough — that mistake is what this whole effort has been
  unwinding).
- A "Start from template" picker, and "Save as template" from a filled form.
- Wired to broadcasts and the five Operations Core screens.

## Out of scope

- The seven governance/support CRUD forms.
- Scheduling. The real API has no schedule field; the console's current `schedule_epoch`
  has no counterpart and is dropped rather than faked.
- Any change to the legacy `/broadcasts` backend router.

## Constraints

- Nothing in this addendum requires the data migration to have run.
- Deploy order from the previous addendum still holds: console before backend schemas.
