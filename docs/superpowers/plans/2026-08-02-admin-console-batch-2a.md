# Admin Console Batch 2a Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the admin console write the field names the platform actually reads, so add-ons stop pricing at 0, promo codes stop discounting 0%, and the Active toggle stops being inert.

**Architecture:** Give the generic CRUD factory optional per-feature Zod schemas (absent ⇒ today's passthrough, so untouched features keep working), author canonical schemas for the three collections that have consumers, migrate existing documents onto those names, then rebuild the five Operations Core forms against the canonical vocabulary with real controls.

**Tech Stack:** Backend — Next.js 16 (App Router), Hono, `@hono/zod-openapi`, MongoDB driver, Vitest. Frontend — Next.js 15, React 18, TanStack Query v5, Tailwind, shadcn/ui, Vitest.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-02-admin-payload-drift-addendum.md` (frontend repo).
- **This batch touches BOTH repos.** Frontend: `C:\Users\Mr Dashi\Downloads\Marcus-cleaning-admin-frontend\.claude\worktrees\api-integration-ui-fixes-47640b`. Backend: `C:\Users\Mr Dashi\Downloads\Marcus-cleaning-backend\app`. Each task names which one it works in; never edit the other.
- **Backend commit policy (`app/CLAUDE.md`, non-negotiable):** NEVER add a Claude/Anthropic co-author trailer or "Generated with Claude Code" line to backend commits. The frontend repo does use a `Co-Authored-By: Claude Opus 5` trailer. Follow each repo's own convention.
- Backend layering is strict: `routes → services → repositories → schemas`. No DB access in routes; only repositories import `mongodb`.
- Backend response envelope is always `{ success, message, data, requestId }`.
- **Money is in MAJOR units** everywhere (25.00, not 2500). This is the approved ruling; `pricing-service.ts` is the authority.
- Backend gates: `npm run typecheck`, `npm run lint`, `npm test` (Vitest, `tests/**/*.test.ts`, node env).
- Frontend gates: `npm test`, `npm run lint`, `npm run build`.
- Do not use `git commit --no-verify` in either repo. Commit after every task.

## Canonical vocabulary (authoritative — copy exactly)

Derived from what backend consumers actually read. The alias chains stay in place for
legacy documents; these are the names new writes must use.

**`service_definitions`** — read by `catalog-service.ts`, `pricing-service.ts`, `availability-service.ts`, `cleaner-jobs-service.ts`:
`title`, `description`, `basePrice`, `hourlyRate`, `minimumHours`, `maximumHours`, `hourIncrement`, `priceUnit` (`'HOURLY' | 'FLAT'`), `currency`, `isAvailable`, `checklist`

**`addon_catalog`** — read by `catalog-service.ts`, `pricing-service.ts`, `checklist-service.ts`:
`title`, `price`, `currency`, `isAvailable`, `serviceId` (optional; absent ⇒ global add-on), `checklist`

**`promo_code`** — read by `promotion-service.ts`:
`code`, `title`, `description`, `discountType` (`'PERCENT' | 'FIXED'`), `discountValue`, `minimumSpend`, `maximumDiscount`, `currency`, `imageUrl`, `startsAt`, `expiresAt`, `active`, `applicableServices`

**`service_area_boundary`, `dynamic_pricing_rule`** — **no consumers exist**. Keep their current field names; add validation only. Do NOT rename them: with nothing reading them there is no canonical vocabulary to match, and renaming would be churn.

## Legacy → canonical mapping (used by the migration and nowhere else)

| Legacy | Canonical | Note |
|---|---|---|
| `display_name` | `title` | |
| `is_active` | `isAvailable` (services, add-ons) / `active` (promos) | |
| `price_minor` | `price` | **divide by 100** |
| `discount_type` | `discountType` | uppercase the value |
| `discount_value` | `discountValue` | |
| `max_redemptions` | `maxRedemptions` | no consumer; carried for completeness |
| `valid_from_epoch` | `startsAt` | |
| `valid_to_epoch` | `expiresAt` | |
| `base_duration_minutes` | `minimumHours` | **divide by 60** |
| `notes` | `description` | only when `description` is absent |
| `service_key`, `addon_key`, `zone_code` | *(retained as-is)* | internal keys, no consumer reads them |

---

### Task 1: Let `crudRouter` accept per-feature schemas

**Repo:** backend (`Marcus-cleaning-backend/app`)

**Files:**
- Modify: `server/routes/admin-features/_crud.ts` (the `CrudOptions` interface and the POST/PATCH route bodies)
- Test: `tests/admin-feature-crud-schema.test.ts` (create)

**Interfaces:**
- Consumes: `FeatureCreate`, `FeatureUpdate` from `server/schemas/admin-features.ts`.
- Produces: `CrudOptions` gains `createSchema?: z.ZodTypeAny` and `updateSchema?: z.ZodTypeAny`. When omitted, the router uses `FeatureCreate` / `FeatureUpdate` exactly as today. Tasks 2-5 depend on this signature.

- [ ] **Step 1: Write the failing test**

Create `tests/admin-feature-crud-schema.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { z } from '@hono/zod-openapi'
import { crudRouter } from '@/server/routes/admin-features/_crud'

/**
 * The factory must stay backwards compatible: nine features still call it with no
 * schema and must keep their passthrough behaviour. Only the two new options change
 * anything.
 */
describe('crudRouter schema options', () => {
  it('builds a router when no schemas are supplied', () => {
    const router = crudRouter({ collection: 'x', tag: 'X', noun: 'x' })
    expect(router).toBeDefined()
  })

  it('builds a router when schemas are supplied', () => {
    const Create = z.object({ title: z.string() })
    const router = crudRouter({
      collection: 'x',
      tag: 'X',
      noun: 'x',
      createSchema: Create,
      updateSchema: Create.partial(),
    })
    expect(router).toBeDefined()
  })
})
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run tests/admin-feature-crud-schema.test.ts`

Expected: FAIL — `createSchema` / `updateSchema` are not valid `CrudOptions` properties (TypeScript error).

- [ ] **Step 3: Extend `CrudOptions`**

In `server/routes/admin-features/_crud.ts`, add to the interface:

```ts
export interface CrudOptions {
  collection: string
  /** Human tag for OpenAPI grouping, e.g. 'ServiceDefinitions'. */
  tag: string
  /** Singular noun for messages, e.g. 'service definition'. */
  noun?: string
  /**
   * Per-feature request schemas. When omitted the router keeps the historical
   * `.passthrough()` behaviour, so features migrate one at a time without a
   * flag day. See docs/superpowers/specs/2026-08-02-admin-payload-drift-addendum.md.
   */
  createSchema?: z.ZodTypeAny
  updateSchema?: z.ZodTypeAny
}
```

- [ ] **Step 4: Use them in the route definitions**

Inside `crudRouter`, immediately after the existing destructuring, add:

```ts
  const createBody = opts.createSchema ?? FeatureCreate
  const updateBody = opts.updateSchema ?? FeatureUpdate
```

Then replace `schema: FeatureCreate` in the POST route's `request.body.content['application/json']` with `schema: createBody`, and `schema: FeatureUpdate` in the PATCH route with `schema: updateBody`.

Leave the handler bodies untouched — they already read `c.req.valid('json')`.

- [ ] **Step 5: Run the test and the full suite**

Run: `npx vitest run tests/admin-feature-crud-schema.test.ts`
Expected: PASS, 2 tests.

Run: `npm run typecheck && npm test`
Expected: PASS. All nine existing features still build with no schema supplied.

- [ ] **Step 6: Commit**

```bash
git add server/routes/admin-features/_crud.ts tests/admin-feature-crud-schema.test.ts
git commit -m "feat(admin-features): allow per-feature create/update schemas in crudRouter

Absent schemas keep the historical passthrough behaviour so the nine
existing features migrate one at a time."
```

---

### Task 2: Canonical schema for `service_definitions`

**Repo:** backend

**Files:**
- Modify: `server/schemas/admin-features.ts` (add the new schema; leave `FeatureCreate`/`FeatureUpdate` in place)
- Modify: `server/routes/admin-features/index.ts` (wire it into the `serviceDefinitions` router)
- Test: `tests/admin-service-definition-schema.test.ts` (create)

**Interfaces:**
- Produces: `ServiceDefinitionCreate` and `ServiceDefinitionUpdate` (`= ServiceDefinitionCreate.partial()`) exported from `server/schemas/admin-features.ts`.

**Design note — why plain objects, not `.strict()` or `.passthrough()`:** Zod's default
behaviour strips unknown keys. That is deliberate here. `.passthrough()` would let the
snake_case drift straight back in; `.strict()` would 422 any client still sending legacy
fields during a rolling deploy. Stripping quietly discards the legacy names while
accepting the canonical ones. Do not change this without a reason.

- [ ] **Step 1: Write the failing test**

Create `tests/admin-service-definition-schema.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { ServiceDefinitionCreate, ServiceDefinitionUpdate } from '@/server/schemas/admin-features'

describe('ServiceDefinitionCreate', () => {
  it('accepts a canonical flat-priced service', () => {
    const parsed = ServiceDefinitionCreate.parse({
      title: 'Deep Clean',
      description: 'Top to bottom.',
      basePrice: 120,
      priceUnit: 'FLAT',
      currency: 'NGN',
      isAvailable: true,
    })
    expect(parsed.title).toBe('Deep Clean')
    expect(parsed.basePrice).toBe(120)
  })

  it('accepts a canonical hourly service', () => {
    const parsed = ServiceDefinitionCreate.parse({
      title: 'Hourly Clean',
      hourlyRate: 40,
      minimumHours: 2,
      maximumHours: 8,
      hourIncrement: 0.5,
      priceUnit: 'HOURLY',
      currency: 'NGN',
      isAvailable: true,
    })
    expect(parsed.hourlyRate).toBe(40)
  })

  it('requires a title', () => {
    expect(() => ServiceDefinitionCreate.parse({ basePrice: 10 })).toThrow()
  })

  it('rejects a negative price', () => {
    expect(() => ServiceDefinitionCreate.parse({ title: 'X', basePrice: -1 })).toThrow()
  })

  it('rejects an unknown price unit', () => {
    expect(() => ServiceDefinitionCreate.parse({ title: 'X', priceUnit: 'WEEKLY' })).toThrow()
  })

  it('strips legacy snake_case fields instead of storing them', () => {
    const parsed = ServiceDefinitionCreate.parse({
      title: 'X',
      display_name: 'X',
      is_active: false,
      base_duration_minutes: 120,
    }) as Record<string, unknown>
    expect(parsed.display_name).toBeUndefined()
    expect(parsed.is_active).toBeUndefined()
    expect(parsed.base_duration_minutes).toBeUndefined()
  })

  it('update schema makes every field optional', () => {
    expect(() => ServiceDefinitionUpdate.parse({})).not.toThrow()
    expect(ServiceDefinitionUpdate.parse({ title: 'Y' }).title).toBe('Y')
  })
})
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run tests/admin-service-definition-schema.test.ts`
Expected: FAIL — the exports do not exist.

- [ ] **Step 3: Author the schema**

Append to `server/schemas/admin-features.ts`:

```ts
/** How a service is priced. Mirrors `PriceUnit` in `server/schemas/catalog.ts`. */
export const AdminPriceUnit = z.enum(['HOURLY', 'FLAT'])

/**
 * Canonical create body for `service_definitions`.
 *
 * Field names are the ones the consumers actually read — see `catalog-service.ts`
 * (`title ?? name`, `basePrice ?? price`, `isAvailable ?? active`) and
 * `pricing-service.ts`. The admin console previously wrote `display_name` /
 * `is_active` / `base_duration_minutes`, which no consumer reads, so services
 * rendered as "Service" with no price and could not be deactivated.
 *
 * Plain object (not `.passthrough()`, not `.strict()`): unknown keys are stripped,
 * which drops legacy snake_case without 422-ing a client mid-deploy.
 */
export const ServiceDefinitionCreate = z
  .object({
    title: z.string().min(1),
    description: z.string().optional(),
    /** Major units. `pricing-service.ts` is the authority on this. */
    basePrice: z.number().nonnegative().optional(),
    hourlyRate: z.number().nonnegative().optional(),
    minimumHours: z.number().positive().optional(),
    maximumHours: z.number().positive().optional(),
    hourIncrement: z.number().positive().optional(),
    priceUnit: AdminPriceUnit.optional(),
    currency: z.string().min(1).optional(),
    isAvailable: z.boolean().optional(),
    checklist: z.array(z.string()).optional(),
    /** Internal key, no consumer reads it; retained so admins keep their handle. */
    service_key: z.string().optional(),
  })
  .openapi('ServiceDefinitionCreate')
export type ServiceDefinitionCreate = z.infer<typeof ServiceDefinitionCreate>

export const ServiceDefinitionUpdate = ServiceDefinitionCreate.partial().openapi(
  'ServiceDefinitionUpdate',
)
export type ServiceDefinitionUpdate = z.infer<typeof ServiceDefinitionUpdate>
```

- [ ] **Step 4: Wire it into the router**

In `server/routes/admin-features/index.ts`, import the two schemas and change the `serviceDefinitions` line to:

```ts
const serviceDefinitions = crudRouter({
  collection: 'service_definitions',
  tag: 'ServiceDefinitions',
  noun: 'service definition',
  createSchema: ServiceDefinitionCreate,
  updateSchema: ServiceDefinitionUpdate,
})
```

- [ ] **Step 5: Verify and commit**

Run: `npx vitest run tests/admin-service-definition-schema.test.ts` → PASS, 7 tests.
Run: `npm run typecheck && npm run lint && npm test` → PASS.

```bash
git add server/schemas/admin-features.ts server/routes/admin-features/index.ts tests/admin-service-definition-schema.test.ts
git commit -m "feat(admin-features): canonical schema for service definitions

Admin writes now use the field names catalog/pricing/availability actually
read. Legacy snake_case keys are stripped rather than stored."
```

---

### Task 3: Canonical schema for `addon_catalog`

**Repo:** backend

**Files:**
- Modify: `server/schemas/admin-features.ts`
- Modify: `server/routes/admin-features/index.ts` (the `addOns` router)
- Test: `tests/admin-addon-schema.test.ts` (create)

**Interfaces:**
- Produces: `AddOnCreate`, `AddOnUpdate` (`= AddOnCreate.partial()`).

- [ ] **Step 1: Write the failing test**

Create `tests/admin-addon-schema.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { AddOnCreate, AddOnUpdate } from '@/server/schemas/admin-features'

describe('AddOnCreate', () => {
  it('accepts a canonical add-on', () => {
    const parsed = AddOnCreate.parse({
      title: 'Inside oven',
      price: 20,
      currency: 'NGN',
      isAvailable: true,
    })
    expect(parsed.price).toBe(20)
  })

  it('accepts an add-on linked to a service', () => {
    expect(AddOnCreate.parse({ title: 'X', price: 5, serviceId: 'svc1' }).serviceId).toBe('svc1')
  })

  it('accepts a global add-on with no service link', () => {
    expect(AddOnCreate.parse({ title: 'X', price: 5 }).serviceId).toBeUndefined()
  })

  it('requires a title', () => {
    expect(() => AddOnCreate.parse({ price: 5 })).toThrow()
  })

  it('requires a price — a priceless add-on is the bug this fixes', () => {
    expect(() => AddOnCreate.parse({ title: 'X' })).toThrow()
  })

  it('rejects a negative price', () => {
    expect(() => AddOnCreate.parse({ title: 'X', price: -1 })).toThrow()
  })

  it('strips the legacy price_minor key so it cannot shadow price', () => {
    const parsed = AddOnCreate.parse({ title: 'X', price: 25, price_minor: 2500 }) as Record<string, unknown>
    expect(parsed.price).toBe(25)
    expect(parsed.price_minor).toBeUndefined()
  })

  it('update schema makes every field optional', () => {
    expect(() => AddOnUpdate.parse({})).not.toThrow()
  })
})
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run tests/admin-addon-schema.test.ts`

- [ ] **Step 3: Author the schema**

Append to `server/schemas/admin-features.ts`:

```ts
/**
 * Canonical create body for `addon_catalog`.
 *
 * `price` is REQUIRED and in major units. `catalog-service.ts:139` reads
 * `num(d.price) ?? 0`, so the admin console's old `price_minor` meant every
 * admin-created add-on was free.
 *
 * `serviceId` is optional: `listServiceExtras` treats an unlinked add-on as
 * global (applies to every service).
 */
export const AddOnCreate = z
  .object({
    title: z.string().min(1),
    price: z.number().nonnegative(),
    currency: z.string().min(1).optional(),
    isAvailable: z.boolean().optional(),
    // NOTE: shipped as `z.string().min(1).nullable().optional()`, not string-or-omitted.
    // The frontend must be able to send `serviceId: null` to un-scope an add-on back to
    // "all services" -- a PATCH that simply omits the field (`delete payload.serviceId`)
    // never clears an existing value server-side, it just leaves it untouched. Allowing
    // `null` is what makes that clear-the-scope case possible.
    serviceId: z.string().min(1).nullable().optional(),
    description: z.string().optional(),
    checklist: z.array(z.string()).optional(),
    /** Internal key, no consumer reads it. */
    addon_key: z.string().optional(),
  })
  .openapi('AddOnCreate')
export type AddOnCreate = z.infer<typeof AddOnCreate>

export const AddOnUpdate = AddOnCreate.partial().openapi('AddOnUpdate')
export type AddOnUpdate = z.infer<typeof AddOnUpdate>
```

- [ ] **Step 4: Wire it**

In `server/routes/admin-features/index.ts`:

```ts
const addOns = crudRouter({
  collection: 'addon_catalog',
  tag: 'AddOns',
  noun: 'add-on',
  createSchema: AddOnCreate,
  updateSchema: AddOnUpdate,
})
```

- [ ] **Step 5: Verify and commit**

Run: `npx vitest run tests/admin-addon-schema.test.ts` → PASS, 8 tests.
Run: `npm run typecheck && npm run lint && npm test` → PASS.

```bash
git add server/schemas/admin-features.ts server/routes/admin-features/index.ts tests/admin-addon-schema.test.ts
git commit -m "feat(admin-features): canonical schema for add-ons

price is now required and in major units; the old price_minor key meant
every admin-created add-on priced at zero."
```

---

### Task 4: Canonical schema for `promo_code`

**Repo:** backend

**Files:**
- Modify: `server/schemas/admin-features.ts`
- Modify: `server/routes/admin-features/index.ts` (the `promoCodes` router)
- Test: `tests/admin-promo-schema.test.ts` (create)

**Interfaces:**
- Produces: `PromoCodeCreate`, `PromoCodeUpdate` (`= PromoCodeCreate.partial()`).

- [ ] **Step 1: Read the consumer first**

Run: `sed -n '30,60p' server/services/promotion-service.ts`

Confirm the exact names and the `isActive` default before writing the schema. In
particular note that a missing active flag means **active**, which is why the admin's
`is_active: false` was inert.

- [ ] **Step 2: Write the failing test**

Create `tests/admin-promo-schema.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { PromoCodeCreate, PromoCodeUpdate } from '@/server/schemas/admin-features'

describe('PromoCodeCreate', () => {
  it('accepts a canonical percent promo', () => {
    const parsed = PromoCodeCreate.parse({
      code: 'CLEANM10',
      discountType: 'PERCENT',
      discountValue: 10,
      active: true,
    })
    expect(parsed.discountValue).toBe(10)
  })

  it('uppercases the code', () => {
    expect(PromoCodeCreate.parse({ code: 'cleanm10', discountType: 'PERCENT', discountValue: 5 }).code).toBe('CLEANM10')
  })

  it('requires a discount value — a 0%% promo is the bug this fixes', () => {
    expect(() => PromoCodeCreate.parse({ code: 'X', discountType: 'PERCENT' })).toThrow()
  })

  it('rejects a percent discount above 100', () => {
    expect(() => PromoCodeCreate.parse({ code: 'X', discountType: 'PERCENT', discountValue: 150 })).toThrow()
  })

  it('allows a fixed discount above 100', () => {
    expect(PromoCodeCreate.parse({ code: 'X', discountType: 'FIXED', discountValue: 150 }).discountValue).toBe(150)
  })

  it('rejects an expiry before the start', () => {
    expect(() =>
      PromoCodeCreate.parse({ code: 'X', discountType: 'FIXED', discountValue: 5, startsAt: 200, expiresAt: 100 }),
    ).toThrow()
  })

  it('strips legacy keys', () => {
    const parsed = PromoCodeCreate.parse({
      code: 'X',
      discountType: 'PERCENT',
      discountValue: 5,
      discount_value: 99,
      is_active: false,
    }) as Record<string, unknown>
    expect(parsed.discount_value).toBeUndefined()
    expect(parsed.is_active).toBeUndefined()
  })

  it('update schema makes every field optional', () => {
    expect(() => PromoCodeUpdate.parse({})).not.toThrow()
  })
})
```

- [ ] **Step 3: Run it and confirm it fails**

Run: `npx vitest run tests/admin-promo-schema.test.ts`

- [ ] **Step 4: Author the schema**

Append to `server/schemas/admin-features.ts`:

```ts
export const AdminDiscountType = z.enum(['PERCENT', 'FIXED'])

/**
 * Canonical create body for `promo_code`.
 *
 * `promotion-service.ts:44` reads `discountValue ?? value ?? percentage` and falls
 * back to 0, so the admin console's `discount_value` produced promos that applied
 * no discount. `active` (not `is_active`) is the flag `isActive()` reads; a missing
 * flag is treated as ACTIVE by design there, which made deactivation inert.
 */
export const PromoCodeCreate = z
  .object({
    code: z.string().min(1).transform((v) => v.trim().toUpperCase()),
    title: z.string().optional(),
    description: z.string().optional(),
    discountType: AdminDiscountType,
    discountValue: z.number().positive(),
    minimumSpend: z.number().nonnegative().optional(),
    maximumDiscount: z.number().nonnegative().optional(),
    currency: z.string().min(1).optional(),
    imageUrl: z.string().optional(),
    /** Epoch seconds. */
    startsAt: z.number().int().optional(),
    expiresAt: z.number().int().optional(),
    active: z.boolean().optional(),
    applicableServices: z.array(z.string()).optional(),
    maxRedemptions: z.number().int().positive().optional(),
  })
  .refine((v) => v.discountType !== 'PERCENT' || v.discountValue <= 100, {
    message: 'A percent discount cannot exceed 100',
    path: ['discountValue'],
  })
  .refine((v) => v.startsAt == null || v.expiresAt == null || v.expiresAt > v.startsAt, {
    message: 'expiresAt must be after startsAt',
    path: ['expiresAt'],
  })
  .openapi('PromoCodeCreate')
export type PromoCodeCreate = z.infer<typeof PromoCodeCreate>
```

**`.partial()` does not exist on a `ZodEffects`** (the `.refine()` calls wrap the object), so build the update schema from the inner object instead:

```ts
const PromoCodeFields = z.object({
  code: z.string().min(1).transform((v) => v.trim().toUpperCase()),
  title: z.string().optional(),
  description: z.string().optional(),
  discountType: AdminDiscountType,
  discountValue: z.number().positive(),
  minimumSpend: z.number().nonnegative().optional(),
  maximumDiscount: z.number().nonnegative().optional(),
  currency: z.string().min(1).optional(),
  imageUrl: z.string().optional(),
  startsAt: z.number().int().optional(),
  expiresAt: z.number().int().optional(),
  active: z.boolean().optional(),
  applicableServices: z.array(z.string()).optional(),
  maxRedemptions: z.number().int().positive().optional(),
})

export const PromoCodeUpdate = PromoCodeFields.partial().openapi('PromoCodeUpdate')
export type PromoCodeUpdate = z.infer<typeof PromoCodeUpdate>
```

Define `PromoCodeFields` **once**, above `PromoCodeCreate`, and build `PromoCodeCreate` as `PromoCodeFields.refine(...).refine(...)` rather than duplicating the field list. The duplication above is shown only to make the constraint explicit — do not ship two copies.

- [ ] **Step 5: Wire it**

```ts
const promoCodes = crudRouter({
  collection: 'promo_code',
  tag: 'PromoCodes',
  noun: 'promo code',
  createSchema: PromoCodeCreate,
  updateSchema: PromoCodeUpdate,
})
```

- [ ] **Step 6: Verify and commit**

Run: `npx vitest run tests/admin-promo-schema.test.ts` → PASS, 8 tests.
Run: `npm run typecheck && npm run lint && npm test` → PASS.

```bash
git add server/schemas/admin-features.ts server/routes/admin-features/index.ts tests/admin-promo-schema.test.ts
git commit -m "feat(admin-features): canonical schema for promo codes

discountValue is required and bounded; `active` replaces the inert
`is_active`, which promotion-service never read."
```

---

### Task 5: Validation-only schemas for service areas and pricing rules

**Repo:** backend

These two collections have **no consumers anywhere in the backend** — verified by grep.
There is therefore no canonical vocabulary to migrate toward, so **do not rename their
fields**. Add validation only, so the forms can be typed and bad data rejected.

**Files:**
- Modify: `server/schemas/admin-features.ts`
- Modify: `server/routes/admin-features/index.ts` (`serviceAreas`, `pricingRules`)
- Test: `tests/admin-area-and-rule-schema.test.ts` (create)

**Interfaces:**
- Produces: `ServiceAreaCreate` / `ServiceAreaUpdate`, `PricingRuleCreate` / `PricingRuleUpdate`.

- [ ] **Step 1: Re-confirm there are no consumers**

Run from `Marcus-cleaning-backend/app`:
`grep -rn "service_area_boundary\|dynamic_pricing_rule" --include=*.ts --exclude-dir=node_modules --exclude-dir=.next server/ | grep -v "admin-features/index.ts"`

Expected: no output. If anything IS found, STOP and report — the no-rename decision rests on this.

- [ ] **Step 2: Write the failing test**

Create `tests/admin-area-and-rule-schema.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  PricingRuleCreate,
  ServiceAreaCreate,
} from '@/server/schemas/admin-features'

describe('ServiceAreaCreate', () => {
  it('accepts a canonical area', () => {
    const parsed = ServiceAreaCreate.parse({
      zone_code: 'LA-VI',
      display_name: 'Victoria Island',
      zip_codes: ['101001', '101002'],
      is_active: true,
    })
    expect(parsed.zip_codes).toHaveLength(2)
  })

  it('requires a zone code', () => {
    expect(() => ServiceAreaCreate.parse({ display_name: 'X' })).toThrow()
  })

  it('rejects boundary_geojson that is not valid JSON', () => {
    expect(() =>
      ServiceAreaCreate.parse({ zone_code: 'A', display_name: 'B', boundary_geojson: '{not json' }),
    ).toThrow()
  })
})

describe('PricingRuleCreate', () => {
  it('accepts a canonical rule', () => {
    const parsed = PricingRuleCreate.parse({
      rule_name: 'Weekend Surge',
      rule_type: 'time_window',
      multiplier: 1.2,
      priority: 10,
      start_hour: 18,
      end_hour: 22,
      is_active: true,
    })
    expect(parsed.multiplier).toBe(1.2)
  })

  it('rejects an hour outside 0-23', () => {
    expect(() =>
      PricingRuleCreate.parse({ rule_name: 'X', rule_type: 'time_window', multiplier: 1, priority: 1, start_hour: 24 }),
    ).toThrow()
  })

  it('rejects a non-positive multiplier', () => {
    expect(() =>
      PricingRuleCreate.parse({ rule_name: 'X', rule_type: 'time_window', multiplier: 0, priority: 1 }),
    ).toThrow()
  })

  it('rejects an unknown rule type', () => {
    expect(() =>
      PricingRuleCreate.parse({ rule_name: 'X', rule_type: 'made_up', multiplier: 1, priority: 1 }),
    ).toThrow()
  })
})
```

- [ ] **Step 3: Author the schemas**

Append to `server/schemas/admin-features.ts`:

```ts
/**
 * `service_area_boundary` and `dynamic_pricing_rule` have NO backend consumers —
 * nothing reads them today. Field names are therefore left exactly as the admin
 * console already writes them: with no reader there is no canonical vocabulary to
 * match, and renaming would be pure churn. These schemas add validation only.
 */
export const ServiceAreaCreate = z
  .object({
    zone_code: z.string().min(1),
    display_name: z.string().min(1),
    zip_codes: z.array(z.string()).optional(),
    boundary_geojson: z
      .string()
      .optional()
      .refine((v) => {
        if (v == null || v === '') return true
        try {
          JSON.parse(v)
          return true
        } catch {
          return false
        }
      }, { message: 'boundary_geojson must be valid JSON' }),
    is_active: z.boolean().optional(),
  })
  .openapi('ServiceAreaCreate')
export type ServiceAreaCreate = z.infer<typeof ServiceAreaCreate>

export const ServiceAreaUpdate = ServiceAreaCreate.partial().openapi('ServiceAreaUpdate')
export type ServiceAreaUpdate = z.infer<typeof ServiceAreaUpdate>

export const PricingRuleType = z.enum(['time_window', 'day_of_week', 'zone', 'demand'])

export const PricingRuleCreate = z
  .object({
    rule_name: z.string().min(1),
    rule_type: PricingRuleType,
    multiplier: z.number().positive(),
    priority: z.number().int(),
    zone_codes: z.array(z.string()).optional(),
    day_of_week: z.array(z.string()).optional(),
    start_hour: z.number().int().min(0).max(23).optional(),
    end_hour: z.number().int().min(0).max(23).optional(),
    is_active: z.boolean().optional(),
  })
  .openapi('PricingRuleCreate')
export type PricingRuleCreate = z.infer<typeof PricingRuleCreate>

export const PricingRuleUpdate = PricingRuleCreate.partial().openapi('PricingRuleUpdate')
export type PricingRuleUpdate = z.infer<typeof PricingRuleUpdate>
```

`ServiceAreaUpdate` uses `.partial()` on a plain object — fine, since neither schema uses `.refine()` at the object level (the `boundary_geojson` refine is on the field, which `.partial()` preserves).

- [ ] **Step 4: Wire both routers**

In `server/routes/admin-features/index.ts`, pass `createSchema`/`updateSchema` to the `serviceAreas` and `pricingRules` factory calls, in the same shape as Tasks 2-4.

- [ ] **Step 5: Verify and commit**

Run: `npx vitest run tests/admin-area-and-rule-schema.test.ts` → PASS, 7 tests.
Run: `npm run typecheck && npm run lint && npm test` → PASS.

```bash
git add server/schemas/admin-features.ts server/routes/admin-features/index.ts tests/admin-area-and-rule-schema.test.ts
git commit -m "feat(admin-features): validation schemas for service areas and pricing rules

Field names left as-is: neither collection has a backend consumer, so
there is no canonical vocabulary to migrate toward."
```

---

### Task 6: Regression test — an admin-created service reaches the customer correctly

**Repo:** backend

This is the guard that would have caught the whole bug class. It asserts that a document
shaped like what the **new** admin console writes produces correct customer-facing output,
and that a **legacy** document still degrades the old way (documenting the damage the
migration in Task 7 then repairs).

**Files:**
- Test: `tests/admin-payload-reaches-consumers.test.ts` (create)

**Interfaces:**
- Consumes: `listServices`, `getServicePricing`, `listServiceExtras` from `server/services/catalog-service.ts`; `computeQuote` from `server/services/pricing-service.ts`. Mocks `_generic-repo` with the `vi.mock` pattern from `tests/booking-hours.test.ts`.

- [ ] **Step 1: Read the existing mocking pattern**

Run: `sed -n '1,35p' tests/booking-hours.test.ts`

Note how `vi.mock('@/server/repositories/admin-features/_generic-repo', ...)` is declared **before** the service imports — hoisting matters.

- [ ] **Step 2: Write the test**

Create `tests/admin-payload-reaches-consumers.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'

/**
 * The regression guard for the admin payload drift.
 *
 * CANONICAL docs are what the admin console writes after Batch 2a. LEGACY docs are
 * what it wrote before — kept here deliberately, so the damage is pinned down and
 * the Task 7 migration has an executable definition of what it must repair.
 */
const CANONICAL_SERVICE = {
  id: 'svc-canonical',
  title: 'Deep Clean',
  description: 'Top to bottom.',
  basePrice: 120,
  priceUnit: 'FLAT',
  currency: 'NGN',
  isAvailable: true,
}

const LEGACY_SERVICE = {
  id: 'svc-legacy',
  display_name: 'Deep Clean',
  base_duration_minutes: 120,
  is_active: false,
  notes: 'Top to bottom.',
}

const CANONICAL_ADDON = { id: 'addon-canonical', title: 'Inside oven', price: 20, isAvailable: true }
const LEGACY_ADDON = { id: 'addon-legacy', display_name: 'Inside oven', price_minor: 2000, is_active: true }

vi.mock('@/server/repositories/admin-features/_generic-repo', () => ({
  listDocs: vi.fn(async (collection: string) => {
    if (collection === 'service_definitions') return { items: [CANONICAL_SERVICE, LEGACY_SERVICE], total: 2 }
    if (collection === 'addon_catalog') return { items: [CANONICAL_ADDON, LEGACY_ADDON], total: 2 }
    return { items: [], total: 0 }
  }),
  getDocById: vi.fn(async (collection: string, id: string) => {
    if (collection === 'service_definitions') {
      return [CANONICAL_SERVICE, LEGACY_SERVICE].find((d) => d.id === id) ?? null
    }
    if (collection === 'addon_catalog') {
      return [CANONICAL_ADDON, LEGACY_ADDON].find((d) => d.id === id) ?? null
    }
    return null
  }),
}))

import { listServices, listServiceExtras } from '@/server/services/catalog-service'

describe('canonical admin payloads reach the customer correctly', () => {
  it('a canonical service keeps its real title and price', async () => {
    const services = await listServices()
    const svc = services.find((s) => s.id === 'svc-canonical')
    expect(svc?.title).toBe('Deep Clean')
    expect(svc?.basePrice).toBe(120)
    expect(svc?.startingPrice).toBe(120)
  })

  it('a canonical add-on carries its real price', async () => {
    const extras = await listServiceExtras('svc-canonical')
    const addon = extras.find((e) => e.id === 'addon-canonical')
    expect(addon?.title).toBe('Inside oven')
    expect(addon?.price).toBe(20)
  })
})

describe('legacy admin payloads are broken — this documents the damage', () => {
  it('a legacy service shows as the literal fallback "Service" with no price', async () => {
    const services = await listServices()
    const svc = services.find((s) => s.id === 'svc-legacy')
    expect(svc?.title).toBe('Service')
    expect(svc?.basePrice).toBeNull()
    expect(svc?.startingPrice).toBeNull()
  })

  it('a legacy service marked is_active:false is still shown to customers', async () => {
    const services = await listServices()
    expect(services.some((s) => s.id === 'svc-legacy')).toBe(true)
  })

  it('a legacy add-on prices at zero', async () => {
    const extras = await listServiceExtras('svc-canonical')
    const addon = extras.find((e) => e.id === 'addon-legacy')
    expect(addon?.price).toBe(0)
  })
})
```

- [ ] **Step 3: Run it**

Run: `npx vitest run tests/admin-payload-reaches-consumers.test.ts`

Expected: **PASS immediately, all 5 tests.** This test does not drive new code — it pins
current behaviour. If the "canonical" cases fail, the canonical vocabulary in this plan is
wrong and you must STOP and report rather than adjusting the expectations.

- [ ] **Step 4: Commit**

```bash
git add tests/admin-payload-reaches-consumers.test.ts
git commit -m "test(admin-features): pin admin payload -> customer output

Canonical payloads render correctly; legacy snake_case payloads render as
'Service' with null price, stay visible when deactivated, and price add-ons
at zero. The legacy cases define what the migration must repair."
```

---

### Task 7: Idempotent migration for existing documents

**Repo:** backend

**Files:**
- Create: `server/services/admin-feature-migration.ts`
- Create: `scripts/migrate-admin-feature-fields.ts` (check whether a `scripts/` directory exists first; if the repo has no such convention, put the runner under `server/scripts/` and say so in your report)
- Test: `tests/admin-feature-migration.test.ts` (create)

**Interfaces:**
- Produces: `migrateServiceDefinition(doc)`, `migrateAddOn(doc)`, `migratePromoCode(doc)` — each takes a raw document and returns `{ changed: boolean; patch: Record<string, unknown> }`. Pure functions, no DB access, so they are unit-testable; the runner applies the patches.

**Two rules the tests below enforce:**
1. **Idempotent** — running twice must produce no second change.
2. **Never clobber** — if a canonical field is already present, the legacy value must not overwrite it.

- [ ] **Step 1: Write the failing test**

Create `tests/admin-feature-migration.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  migrateAddOn,
  migratePromoCode,
  migrateServiceDefinition,
} from '@/server/services/admin-feature-migration'

describe('migrateServiceDefinition', () => {
  it('maps display_name to title', () => {
    const { changed, patch } = migrateServiceDefinition({ display_name: 'Deep Clean' })
    expect(changed).toBe(true)
    expect(patch.title).toBe('Deep Clean')
  })

  it('maps is_active to isAvailable, preserving false', () => {
    expect(migrateServiceDefinition({ is_active: false }).patch.isAvailable).toBe(false)
  })

  it('converts base_duration_minutes to minimumHours', () => {
    expect(migrateServiceDefinition({ base_duration_minutes: 120 }).patch.minimumHours).toBe(2)
  })

  it('maps notes to description only when description is absent', () => {
    expect(migrateServiceDefinition({ notes: 'n' }).patch.description).toBe('n')
    expect(migrateServiceDefinition({ notes: 'n', description: 'd' }).patch.description).toBeUndefined()
  })

  it('never clobbers an existing canonical title', () => {
    const { patch } = migrateServiceDefinition({ display_name: 'Legacy', title: 'Canonical' })
    expect(patch.title).toBeUndefined()
  })

  it('is idempotent — an already-migrated doc reports no change', () => {
    expect(migrateServiceDefinition({ title: 'X', isAvailable: true }).changed).toBe(false)
  })
})

describe('migrateAddOn', () => {
  it('converts price_minor to major-unit price', () => {
    expect(migrateAddOn({ price_minor: 2500 }).patch.price).toBe(25)
  })

  it('handles a price_minor that is not a whole number of major units', () => {
    expect(migrateAddOn({ price_minor: 2550 }).patch.price).toBe(25.5)
  })

  it('never clobbers an existing canonical price', () => {
    expect(migrateAddOn({ price_minor: 2500, price: 30 }).patch.price).toBeUndefined()
  })

  it('is idempotent', () => {
    expect(migrateAddOn({ title: 'X', price: 25 }).changed).toBe(false)
  })
})

describe('migratePromoCode', () => {
  it('maps discount_value to discountValue', () => {
    expect(migratePromoCode({ discount_value: 10 }).patch.discountValue).toBe(10)
  })

  it('uppercases discount_type', () => {
    expect(migratePromoCode({ discount_type: 'percent' }).patch.discountType).toBe('PERCENT')
  })

  it('maps is_active to active, preserving false', () => {
    expect(migratePromoCode({ is_active: false }).patch.active).toBe(false)
  })

  it('maps the epoch window fields', () => {
    const { patch } = migratePromoCode({ valid_from_epoch: 100, valid_to_epoch: 200 })
    expect(patch.startsAt).toBe(100)
    expect(patch.expiresAt).toBe(200)
  })

  it('is idempotent', () => {
    expect(migratePromoCode({ code: 'X', discountType: 'PERCENT', discountValue: 5 }).changed).toBe(false)
  })
})
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run tests/admin-feature-migration.test.ts`

- [ ] **Step 3: Implement the pure migration functions**

Create `server/services/admin-feature-migration.ts`. Write one small helper that maps a
legacy key to a canonical key only when the canonical key is absent, and build the three
functions on top of it. Requirements the tests pin:

- `changed` is `false` when the patch is empty.
- `is_active: false` must survive as `false` — do not use `||` to default it.
- `base_duration_minutes` → `minimumHours` is `minutes / 60`.
- `price_minor` → `price` is `minor / 100`, and must handle non-round values (2550 → 25.5).
- `discount_type` is uppercased.
- A present canonical key always wins; the legacy key is not copied.

No `mongodb` import here — this file is pure, per the layering rule.

- [ ] **Step 4: Run the test**

Run: `npx vitest run tests/admin-feature-migration.test.ts` → PASS, 15 tests.

- [ ] **Step 5: Write the runner**

Create the runner script. It must:
- Iterate each of the three collections via the existing repo helpers (do NOT open a second Mongo client — reuse `server/core/mongo.ts`'s cached client, per `CLAUDE.md`).
- Apply only non-empty patches.
- Support a `--dry-run` flag that reports counts and changes nothing. **Default to dry-run** so an accidental invocation cannot mutate production; require an explicit `--apply` to write.
- Print a per-collection summary: scanned, would-change / changed, skipped-already-canonical.

- [ ] **Step 6: Verify the dry run is genuinely read-only**

Confirm by reading the code that the `--dry-run` path performs no writes. State in your report how you verified it. Do NOT run it against a live database as part of this task.

- [ ] **Step 7: Full gate and commit**

Run: `npm run typecheck && npm run lint && npm test` → PASS.

```bash
git add server/services/admin-feature-migration.ts scripts/migrate-admin-feature-fields.ts tests/admin-feature-migration.test.ts
git commit -m "feat(admin-features): idempotent legacy -> canonical field migration

Pure mapping functions plus a dry-run-by-default runner. Never clobbers a
document that already carries canonical fields."
```

---

### Task 8: Record the deliberate contract change

**Repo:** backend

The backend's `CLAUDE.md` requires intentional contract changes to be recorded. Tasks 2-5
tightened five previously-passthrough endpoints; that must appear in the migration doc or
the next person will read it as an accident.

**Files:**
- Modify: `../docs/migration/07-domain-endpoints.md` (the "Deliberate changes" list, currently 5 numbered entries ending at line ~267)

- [ ] **Step 1: Read the existing section**

Run: `sed -n '255,275p' ../docs/migration/07-domain-endpoints.md`

Match the existing numbered-entry style exactly.

- [ ] **Step 2: Add entry 6**

Append a sixth numbered entry recording:
- Which five endpoints changed (`service-definitions`, `add-ons`, `promo-codes`, `service-areas`, `pricing-rules`) and that they now validate their request bodies instead of accepting arbitrary JSON.
- That unknown keys are **stripped, not rejected**, so a client sending legacy fields gets a 200 with those fields dropped rather than a 422.
- That `service_definitions`, `addon_catalog` and `promo_code` moved to the canonical camelCase names their consumers already read, and why (add-ons priced at 0, promos discounted 0%, Active was inert).
- That `service_area_boundary` and `dynamic_pricing_rule` kept their existing field names because they have no consumers.
- That money is in major units.
- A pointer to the migration script from Task 7 and to the spec addendum.

- [ ] **Step 3: Commit**

```bash
git add ../docs/migration/07-domain-endpoints.md
git commit -m "docs(migration): record admin-feature schema tightening as a deliberate change"
```

---

### Task 9: Richer field types for the admin CRUD form

**Repo:** frontend

**Files:**
- Modify: `src/features/admin/screens/operations/OperationsCrudPage.tsx`
- Test: `src/test/crud-field-types.test.tsx` (create)

**Interfaces:**
- Consumes: the existing `CrudField` type at `OperationsCrudPage.tsx:35-45`, and `mapFormToPayload` / `mapItemToFormValues` / `initialValues` / `validateRequired` in the same file.
- Produces: `CrudFieldType` extended to `"text" | "number" | "textarea" | "boolean" | "array_csv" | "select" | "radio" | "multiselect" | "date" | "money"`. `CrudField` gains `options?: Array<{ value: string; label: string }>` (required for `select`/`radio`/`multiselect`) and `helpText?: string`. Tasks 10-12 depend on these.

**Behaviour each new type must have:**
- `select` — a shadcn `Select`; the empty choice must render a real label (e.g. "None"), never a bare `all` sentinel leaking into the UI.
- `radio` — a `RadioGroup` rendering every option inline. Use this for 2-4 choices so all options are visible without opening a menu.
- `multiselect` — several values at once, serialised to a `string[]` in the payload.
- `date` — an `<input type="date">` in the form, serialised to **epoch seconds** in the payload (the backend's `startsAt`/`expiresAt` are epoch ints), and rendered back from epoch when editing.
- `money` — a number input constrained to two decimals, serialised as a `number` in **major units**.

- [ ] **Step 1: Write the failing test**

Create `src/test/crud-field-types.test.tsx`. Test the pure mapping functions directly where possible rather than driving the whole dialog — they are the part that can silently corrupt a payload. Export `mapFormToPayload` and `mapItemToFormValues` from `OperationsCrudPage.tsx` if they are not already exported.

Cover at minimum:
- `money` maps `"25.50"` to the number `25.5`, not a string and not `2550`.
- `date` maps a `"2026-08-02"` form value to epoch seconds, and `mapItemToFormValues` maps that epoch back to `"2026-08-02"`.
- `multiselect` maps to a `string[]`.
- `select` with no value omits the key entirely rather than sending `""`.
- `radio` maps to the chosen option's `value`.

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run src/test/crud-field-types.test.tsx`

- [ ] **Step 3: Implement**

Extend the type union, then handle each new case in `initialValues`, `mapItemToFormValues`, `mapFormToPayload`, `validateRequired`, and the field-rendering switch in the dialog. Use the existing shadcn components already in `src/components/ui/` (`select.tsx`, `radio-group.tsx`) — do not add dependencies.

Keep the form-state value type simple: widen `Record<string, string | boolean>` to `Record<string, string | boolean | string[]>` and handle the array case explicitly.

- [ ] **Step 4: Verify and commit**

Run: `npx vitest run src/test/crud-field-types.test.tsx` → PASS.
Run: `npm test && npm run lint && npm run build` → PASS.

```bash
git add src/features/admin/screens/operations/OperationsCrudPage.tsx src/test/crud-field-types.test.tsx
git commit -m "feat(admin-web): select, radio, multiselect, date and money field types

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 10: Rebuild the Service Definitions form on canonical fields

**Repo:** frontend

**Files:**
- Modify: `src/features/admin/screens/operations/ServiceDefinitionsPage.tsx`
- Test: `src/test/service-definitions-fields.test.tsx` (create)

**Interfaces:**
- Consumes: `CrudField` and the new field types from Task 9.

- [ ] **Step 1: Write the failing test**

Assert on the exported field list, so the canonical vocabulary is pinned:
- every field `key` is in the canonical set (`title`, `description`, `basePrice`, `hourlyRate`, `minimumHours`, `maximumHours`, `hourIncrement`, `priceUnit`, `currency`, `isAvailable`, `service_key`)
- **no field key contains an underscore-cased legacy name** — specifically assert `display_name`, `is_active`, `base_duration_minutes` are absent
- `priceUnit` is a `radio` with exactly the options `HOURLY` and `FLAT`
- `basePrice` and `hourlyRate` are `money`

Export the field array from the page as a named const so the test can import it.

- [ ] **Step 2: Run it and confirm it fails**

- [ ] **Step 3: Rewrite the field list**

Replace the current five legacy fields with the canonical set. Use `money` for prices, `radio` for `priceUnit`, `boolean` for `isAvailable`, `number` for the hour fields, and keep `service_key` as a plain text field with help text explaining it is an internal handle.

- [ ] **Step 4: Verify and commit**

Run: `npm test && npm run lint && npm run build` → PASS.

```bash
git add src/features/admin/screens/operations/ServiceDefinitionsPage.tsx src/test/service-definitions-fields.test.tsx
git commit -m "fix(admin-web): service definitions form writes canonical fields

display_name/is_active/base_duration_minutes were read by nothing, so
admin-created services showed as 'Service' with no price and could not be
deactivated.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 11: Rebuild the Add-ons form on canonical fields

**Repo:** frontend

**Files:**
- Modify: `src/features/admin/screens/operations/AddOnsPage.tsx`
- Test: `src/test/add-ons-fields.test.tsx` (create)

- [ ] **Step 1: Write the failing test**

Assert: keys are within `title`, `price`, `currency`, `isAvailable`, `serviceId`, `description`, `addon_key`; `price_minor` and `display_name` and `is_active` are absent; `price` is `money` and `required`; `serviceId` has help text making clear that leaving it empty makes the add-on global.

- [ ] **Step 2: Run it and confirm it fails**

- [ ] **Step 3: Rewrite the field list**

`price` must be `money` and required — a priceless add-on is the exact bug being fixed. Because the backend treats an unlinked add-on as applying to every service, `serviceId`'s help text must say so explicitly; an admin who leaves it blank by accident makes the add-on global.

- [ ] **Step 4: Verify and commit**

Run: `npm test && npm run lint && npm run build` → PASS.

```bash
git add src/features/admin/screens/operations/AddOnsPage.tsx src/test/add-ons-fields.test.tsx
git commit -m "fix(admin-web): add-ons form writes canonical price in major units

price_minor was read by nothing, so every admin-created add-on was free.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 12: Rebuild the Promo Codes, Service Areas and Pricing Rules forms

**Repo:** frontend

Grouped because Service Areas and Pricing Rules only gain better controls — their field
names are unchanged, since those collections have no consumers.

**Files:**
- Modify: `src/features/admin/screens/operations/PromoCodesPage.tsx`, `ServiceAreasPage.tsx`, `PricingRulesPage.tsx`
- Test: `src/test/promo-and-config-fields.test.tsx` (create)

- [ ] **Step 1: Write the failing test**

For **Promo Codes**, assert the canonical keys (`code`, `title`, `description`, `discountType`, `discountValue`, `minimumSpend`, `maximumDiscount`, `currency`, `startsAt`, `expiresAt`, `active`, `maxRedemptions`), that `discount_type`/`discount_value`/`is_active`/`valid_from_epoch`/`valid_to_epoch` are all absent, that `discountType` is a `radio` with `PERCENT` and `FIXED`, and that `startsAt`/`expiresAt` are `date`.

For **Service Areas** and **Pricing Rules**, assert the field names are UNCHANGED from today (`zone_code`, `display_name`, `is_active`, `rule_name`, `rule_type`, …) and that `rule_type` is now a `select` with exactly the four backend enum values (`time_window`, `day_of_week`, `zone`, `demand`).

- [ ] **Step 2: Run it and confirm it fails**

- [ ] **Step 3: Rewrite the three field lists**

Promo Codes moves to canonical names with `radio` for `discountType` and `date` for the window. Service Areas keeps its names; Pricing Rules keeps its names but `rule_type` becomes a `select` constrained to the backend enum, and `day_of_week` becomes a `multiselect` of the seven days.

- [ ] **Step 4: Verify and commit**

Run: `npm test && npm run lint && npm run build` → PASS.

```bash
git add src/features/admin/screens/operations/PromoCodesPage.tsx src/features/admin/screens/operations/ServiceAreasPage.tsx src/features/admin/screens/operations/PricingRulesPage.tsx src/test/promo-and-config-fields.test.tsx
git commit -m "fix(admin-web): canonical promo fields; typed pickers for areas and rules

Promo discount_value was read by nothing, so admin promos applied 0%.
Service areas and pricing rules keep their field names - neither has a
backend consumer - and gain constrained pickers.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Batch 2a Completion Checklist

- [ ] Backend: `npm run typecheck`, `npm run lint`, `npm test` all pass.
- [ ] Frontend: `npm test`, `npm run lint`, `npm run build` all pass.
- [ ] Frontend e2e still passes: `npx playwright test`.
- [ ] No backend commit carries a Claude/Anthropic co-author trailer.
- [ ] `docs/migration/07-domain-endpoints.md` records the deliberate change.
- [ ] The migration runner defaults to dry-run and requires `--apply` to write.
- [ ] `tests/admin-payload-reaches-consumers.test.ts` passes, pinning both the canonical and the legacy behaviour.

## Explicitly NOT done in this batch

- **The migration has not been RUN against any real database.** Task 7 ships the script and its tests; executing it against production data is a human decision requiring a backup, and is deliberately outside this plan.
- Service areas and pricing rules still have no backend consumer — they remain configuration that affects nothing. Fixing that is a product decision, not a bug fix.
- The shared `admin_feature_templates` collection and its picker: Batch 3.
- The four governance/support CRUD features (cleaner tags, availability overrides, payout adjustments, chat interventions): Batch 3.
