# Addendum: the admin console writes fields nothing reads

Date: 2026-08-02
Status: Approved (design)
Amends: `2026-08-02-admin-console-api-integration-and-ui-design.md`
Repos: `Marcus-cleaning-admin-frontend`, `Marcus-cleaning-backend`

## Why this addendum exists

The parent spec said the schemaless CRUD produced bad *forms*. Reading the backend's
consumers while planning Batch 2 showed it produced something worse: the admin console
invented a snake_case field vocabulary, and **no consumer reads it**. Batch 1's path audit
found zero drift because the paths were never the problem. The payloads are.

This is a live correctness bug affecting pricing, discounts, and visibility — not a
cosmetic one.

## Evidence

Traced in backend source, not inferred:

| Admin console writes | Consumer reads | Effect |
|---|---|---|
| `display_name` | `title ?? name`, fallback `'Service'` — `catalog-service.ts:77` | Admin-created services show to customers as literally "Service" |
| `display_name` | `title ?? name`, fallback `'Cleaning'` — `availability-service.ts:95` | Cleaner app shows those jobs as "Cleaning" |
| `price_minor` | `num(d.price) ?? 0` — `catalog-service.ts:139` | **Add-ons price at 0** |
| `discount_value` | `discountValue ?? value ?? percentage` else `0` — `promotion-service.ts:44` | **Promo codes apply 0% discount** |
| `is_active` | `isAvailable ?? active` (absent ⇒ `true`) — `catalog-service.ts:71` | **Active toggle is inert**; deactivated items stay live |
| `is_active` | `active ?? isActive ?? enabled` (absent ⇒ `true`) — `promotion-service.ts:54` | Same for promos, by explicit design comment |
| `base_duration_minutes` | `minimumHours` / `hourIncrement` | Duration config ignored; hourly services unpriceable |

Additionally: **`service_area_boundary` and `dynamic_pricing_rule` have no consumers at
all.** Service areas and pricing rules configured in the admin console affect nothing
anywhere in the platform. That is a product gap, not a field-drift bug, and is out of
scope here beyond being recorded.

## Root cause

`FeatureCreate`/`FeatureUpdate` are `z.object({}).passthrough()`, so the backend accepts
any JSON. Consumers defend with alias chains (`basePrice ?? price`,
`hourlyRate ?? ratePerHour ?? pricePerHour`). Those chains encode a canonical camelCase
vocabulary that the admin console never adopted, and nothing ever failed loudly.

## Decisions (approved)

1. **Canonicalise the admin console to the camelCase names consumers already read, and
   migrate existing documents onto those names.** Rejected: teaching the backend to also
   read snake_case, which would entrench two vocabularies and grow the alias chains
   indefinitely. Rejected: canonicalise-forward-only, which leaves current records
   mispriced.
2. **Money is captured in MAJOR units**, matching `pricing-service.ts` ("Money is in major
   units here"). The migration divides existing `price_minor` values by 100. The backend's
   quote path is authoritative, so the admin console conforms to it rather than the
   reverse.

## Scope of this batch (Batch 2a)

One deliverable: *the admin console writes what the platform reads.*

- `crudRouter` gains optional `createSchema` / `updateSchema`. Absent ⇒ today's passthrough
  behaviour, so untouched features keep working.
- Canonical Zod schemas for the three drifting collections: `service_definitions`,
  `addon_catalog`, `promo_code`.
- Validation-only schemas for `service_area_boundary` and `dynamic_pricing_rule` — no
  renaming, since with no consumers there is no canonical vocabulary to match.
- A one-off migration mapping existing snake_case documents onto canonical names,
  including `price_minor / 100`.
- Frontend `CrudField` gains `select`, `radio`, `multiselect`, `date`, `money`.
- The five Operations Core pages declare canonical fields with real controls.
- An integration test asserting an admin-created service appears correctly in the customer
  catalog — the regression guard that would have caught this.

Deferred to Batch 3: the shared `admin_feature_templates` collection and picker; the four
governance/support features; wiring service areas and pricing rules to a consumer.

## Constraints

- Tightening these endpoints is a deliberate contract change and must be recorded in
  `docs/migration/07-domain-endpoints.md` under "Deliberate changes", per the backend's
  `CLAUDE.md`.
- The migration must be idempotent and must not clobber a document that already carries
  canonical fields.
- No customer or cleaner endpoint changes.
