# Admin Console Batch 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the two crashing/erroring admin pages, harden the client against untyped API responses, and make navigation and clicks feel instant — all frontend-only, shipping independently of the Batch 2 backend schema work.

**Architecture:** Runtime response normalization at the `admin-api.ts` boundary (never trust a hand-written TypeScript interface against a `passthrough` contract), plus React Query cache tuning and route-level loading boundaries. No new dependencies.

**Tech Stack:** Next.js 15 App Router, React 18, TanStack Query v5, Tailwind, shadcn/ui, framer-motion, Vitest + Testing Library, Playwright.

## Global Constraints

- Design spec: `docs/superpowers/specs/2026-08-02-admin-console-api-integration-and-ui-design.md`.
- Batch 1 is **frontend-only**. Do not modify the `Marcus-cleaning-backend` repo in any task here.
- All API requests are same-origin relative `/api/...` paths proxied by the Next rewrite. Never point the client at an absolute cross-origin URL (see `src/lib/api/client.ts`).
- The backend envelope is always `{ success, message, data, requestId }`.
- Tests live in `src/test/` and run with `npm test` (Vitest, jsdom, globals enabled, `@` aliased to `./src`).
- Follow the existing fetch-mocking pattern in `src/test/admin-api-lists.test.ts`: `jsonResponse()`, `envelope()`, `vi.stubGlobal("fetch", vi.fn())`.
- Commit after every task. Do not use `--no-verify`.

---

### Task 1: Normalize `SessionAnomalies` at the API boundary

The Sessions page renders a white screen. `SessionsPage.tsx:82` calls
`Object.entries(sessionsQuery.data.active_sessions_by_admin)`, which throws when that
field is absent. The field is absent because the spec declares this endpoint's `data` as
`AdminGenericObject` (`{"type":"object","properties":{},"additionalProperties":{}}`) —
a passthrough object. The `SessionAnomalies` interface in `types.ts:220` is a hand-written
fiction the compiler trusts and the runtime does not honor.

Fixing this in the component would leave the same trap for every other consumer, so the
normalization belongs in `admin-api.ts` where the untyped envelope is unwrapped.

**Files:**
- Modify: `src/lib/api/admin-api.ts:413-416`
- Test: `src/test/session-anomalies.test.ts` (create)

**Interfaces:**
- Consumes: `apiRequest<T>` from `src/lib/api/client.ts`; `SessionAnomalies` from `src/lib/api/types.ts`.
- Produces: `fetchSessionAnomalies(): Promise<SessionAnomalies>` — same signature as today, but every field is now guaranteed present. `active_sessions_by_admin` is always an object, the three scalars always have a defined value. Task 2 relies on this guarantee.

- [ ] **Step 1: Write the failing test**

Create `src/test/session-anomalies.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchSessionAnomalies } from "@/lib/api/admin-api";

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

function envelope(data: unknown) {
  return { success: true, message: "ok", data, requestId: "req_test" };
}

describe("fetchSessionAnomalies", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("defaults every field when the backend returns an empty object", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(jsonResponse(envelope({})));

    const result = await fetchSessionAnomalies();

    expect(result.active_sessions_by_admin).toEqual({});
    expect(result.global_active_sessions).toBe(0);
    expect(result.long_lived_session_count).toBe(0);
    expect(result.recent_session_spike_detected).toBe(false);
  });

  it("drops non-numeric session counts instead of passing them through", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      jsonResponse(envelope({ active_sessions_by_admin: { a1: 3, a2: "many", a3: null } })),
    );

    const result = await fetchSessionAnomalies();

    expect(result.active_sessions_by_admin).toEqual({ a1: 3 });
  });

  it("preserves a well-formed payload", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      jsonResponse(
        envelope({
          active_sessions_by_admin: { a1: 5 },
          global_active_sessions: 12,
          long_lived_session_count: 2,
          recent_session_spike_detected: true,
        }),
      ),
    );

    const result = await fetchSessionAnomalies();

    expect(result).toEqual({
      active_sessions_by_admin: { a1: 5 },
      global_active_sessions: 12,
      long_lived_session_count: 2,
      recent_session_spike_detected: true,
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/test/session-anomalies.test.ts`

Expected: FAIL. The first case throws or reports `undefined` for `active_sessions_by_admin`, because `fetchSessionAnomalies` currently returns `response.data` verbatim.

- [ ] **Step 3: Write the implementation**

In `src/lib/api/admin-api.ts`, replace the existing `fetchSessionAnomalies` (lines 413-416) with:

```ts
/**
 * The spec types this endpoint's `data` as a passthrough `AdminGenericObject`, so the
 * `SessionAnomalies` interface is a claim the runtime does not honor. Normalizing here
 * rather than in the component keeps every consumer safe: SessionsPage previously white-
 * screened on `Object.entries(undefined)`.
 */
export async function fetchSessionAnomalies(): Promise<SessionAnomalies> {
  const response = await apiRequest<Partial<SessionAnomalies> | null>(
    "/v1/admins/monitoring/sessions/anomalies",
  );
  const data = (response.data ?? {}) as Partial<SessionAnomalies>;

  const rawCounts = data.active_sessions_by_admin;
  const active_sessions_by_admin: Record<string, number> = {};
  if (rawCounts && typeof rawCounts === "object") {
    for (const [adminId, count] of Object.entries(rawCounts)) {
      if (typeof count === "number" && Number.isFinite(count)) {
        active_sessions_by_admin[adminId] = count;
      }
    }
  }

  return {
    active_sessions_by_admin,
    global_active_sessions: typeof data.global_active_sessions === "number" ? data.global_active_sessions : 0,
    long_lived_session_count: typeof data.long_lived_session_count === "number" ? data.long_lived_session_count : 0,
    recent_session_spike_detected: data.recent_session_spike_detected === true,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/test/session-anomalies.test.ts`

Expected: PASS, 3 tests.

- [ ] **Step 5: Run the full suite for regressions**

Run: `npm test`

Expected: PASS. No existing test asserts the old passthrough behavior.

- [ ] **Step 6: Commit**

```bash
git add src/lib/api/admin-api.ts src/test/session-anomalies.test.ts
git commit -m "fix(admin-web): normalize session anomaly response at the API boundary

The spec types this endpoint's data as a passthrough object, so the
SessionAnomalies interface was unenforced at runtime and SessionsPage
white-screened on Object.entries(undefined)."
```

---

### Task 2: Render the Sessions page with an empty-state instead of a bare error

With Task 1 in place the page no longer throws, but an empty `active_sessions_by_admin`
renders an empty div with no explanation, and any request failure still renders a bare
`<p>` with no retry.

**Files:**
- Modify: `src/features/admin/screens/SessionsPage.tsx:88-94` (error branch) and the `Active Sessions by Admin` card body
- Test: `src/test/sessions-page.test.tsx` (create)

**Interfaces:**
- Consumes: `fetchSessionAnomalies()` from Task 1, guaranteed to return fully-populated fields.
- Produces: no new exports. `SessionsPage` remains the default export.

- [ ] **Step 1: Write the failing test**

Create `src/test/sessions-page.test.tsx`:

```tsx
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import SessionsPage from "@/features/admin/screens/SessionsPage";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }));
vi.mock("@/hooks/use-admin-auth", () => ({ useAdminProfile: () => ({ data: undefined }) }));

const fetchSessionAnomalies = vi.fn();
vi.mock("@/lib/api/admin-api", () => ({
  fetchSessionAnomalies: (...args: unknown[]) => fetchSessionAnomalies(...args),
  revokeAllSessions: vi.fn(),
  revokeCurrentSession: vi.fn(),
  revokeOtherSessions: vi.fn(),
}));

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <SessionsPage />
    </QueryClientProvider>,
  );
}

describe("SessionsPage", () => {
  beforeEach(() => {
    fetchSessionAnomalies.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("shows an empty state when no admin has active sessions", async () => {
    fetchSessionAnomalies.mockResolvedValue({
      active_sessions_by_admin: {},
      global_active_sessions: 0,
      long_lived_session_count: 0,
      recent_session_spike_detected: false,
    });

    renderPage();

    expect(await screen.findByText(/no active admin sessions/i)).toBeInTheDocument();
  });

  it("offers a retry when the request fails", async () => {
    fetchSessionAnomalies.mockRejectedValue(new Error("boom"));

    renderPage();

    expect(await screen.findByRole("button", { name: /retry/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/test/sessions-page.test.tsx`

Expected: FAIL. Neither the empty-state copy nor a Retry button exists.

- [ ] **Step 3: Implement the error branch**

In `src/features/admin/screens/SessionsPage.tsx`, replace the error branch:

```tsx
  if (sessionsQuery.isError || !sessionsQuery.data) {
    return (
      <div className="space-y-3 max-w-[1000px]">
        <p className="font-mono-data text-destructive">Failed to load session anomaly metrics.</p>
        <Button variant="outline" size="sm" onClick={() => sessionsQuery.refetch()} disabled={sessionsQuery.isFetching}>
          {sessionsQuery.isFetching ? "Retrying..." : "Retry"}
        </Button>
      </div>
    );
  }
```

- [ ] **Step 4: Implement the empty state**

In the same file, inside the `Active Sessions by Admin` card, replace the bare
`{sortedEntries.map(...)}` body with a guarded version:

```tsx
          {sortedEntries.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">
              No active admin sessions to report.
            </p>
          ) : (
            sortedEntries.map(([adminId, count]) => (
              <motion.div key={adminId} variants={fadeUp} className="flex items-center justify-between px-4 py-3 hover:bg-accent/50 transition-colors duration-150">
                <div className="space-y-1">
                  <span className="font-mono-data text-foreground">{adminId}</span>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CircleAlert className="h-3.5 w-3.5" />
                    Risk score inferred from active session volume only.
                  </div>
                </div>
                <Badge variant={count > 3 ? "high" : "info"}>{count} sessions</Badge>
              </motion.div>
            ))
          )}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/test/sessions-page.test.tsx`

Expected: PASS, 2 tests.

- [ ] **Step 6: Commit**

```bash
git add src/features/admin/screens/SessionsPage.tsx src/test/sessions-page.test.tsx
git commit -m "fix(admin-web): add empty state and retry to the session risk panel"
```

---

### Task 3: Make Role Templates recoverable

`/admin/permissions/templates` renders `Failed to load role templates.` with no retry and
no way to select a different role, so one failing role dead-ends the page.

**Files:**
- Modify: `src/features/admin/screens/RoleTemplatesPage.tsx`
- Test: `src/test/role-templates-page.test.tsx` (create)

**Interfaces:**
- Consumes: `fetchRoleTemplate(role)` and `fetchPermissionCatalog()` from `src/lib/api/admin-api.ts`.
- Produces: no new exports.

- [ ] **Step 1: Read the current error branch**

Run: `grep -n "Failed to load role templates" -B 12 -A 4 src/features/admin/screens/RoleTemplatesPage.tsx`

Note the exact surrounding JSX and the name of the query variable holding the role
template request, and the state variable holding the currently selected role. The steps
below refer to them as `templateQuery` and `selectedRole`; use the real names.

- [ ] **Step 2: Write the failing test**

Create `src/test/role-templates-page.test.tsx`:

```tsx
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import RoleTemplatesPage from "@/features/admin/screens/RoleTemplatesPage";

vi.mock("@/hooks/use-admin-auth", () => ({ useAdminProfile: () => ({ data: undefined }) }));

const fetchRoleTemplate = vi.fn();
vi.mock("@/lib/api/admin-api", () => ({
  fetchRoleTemplate: (...args: unknown[]) => fetchRoleTemplate(...args),
  fetchPermissionCatalog: vi.fn().mockResolvedValue([]),
  getRoleRolloutImpact: vi.fn().mockResolvedValue({}),
  previewRoleTemplate: vi.fn(),
  rolloutRoleTemplate: vi.fn(),
  updateRoleTemplate: vi.fn(),
}));

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <RoleTemplatesPage />
    </QueryClientProvider>,
  );
}

describe("RoleTemplatesPage", () => {
  beforeEach(() => {
    fetchRoleTemplate.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("keeps the role selector reachable when the template request fails", async () => {
    fetchRoleTemplate.mockRejectedValue(new Error("boom"));

    renderPage();

    expect(await screen.findByRole("button", { name: /retry/i })).toBeInTheDocument();
    expect(screen.getByTestId("role-template-role-selector")).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/test/role-templates-page.test.tsx`

Expected: FAIL — no Retry button and no `role-template-role-selector` test id.

- [ ] **Step 4: Implement**

Two changes in `src/features/admin/screens/RoleTemplatesPage.tsx`:

First, add `data-testid="role-template-role-selector"` to the wrapper element around the
existing role-selection control.

Second, hoist that selector above the error branch so it renders in both states, and give
the error branch a retry:

```tsx
  if (templateQuery.isError) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tighter">Role Permission Templates</h1>
        <div data-testid="role-template-role-selector">{roleSelector}</div>
        <div className="space-y-3">
          <p className="font-mono-data text-destructive">
            Failed to load the template for “{selectedRole}”. Pick another role or retry.
          </p>
          <Button variant="outline" size="sm" onClick={() => templateQuery.refetch()} disabled={templateQuery.isFetching}>
            {templateQuery.isFetching ? "Retrying..." : "Retry"}
          </Button>
        </div>
      </div>
    );
  }
```

Extract the existing role-selection JSX into a `const roleSelector = (...)` above the
early returns so both the error branch and the success branch render the same control.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/test/role-templates-page.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/admin/screens/RoleTemplatesPage.tsx src/test/role-templates-page.test.tsx
git commit -m "fix(admin-web): keep role selector and add retry when a role template fails to load"
```

---

### Task 4: Promote the slim scrollbar to a global default

`.scrollbar-thin` exists in `src/index.css:286` but is applied only to the sidebar
(`AdminSidebar.tsx:519`), so every other scroll container falls back to the platform's
chunky default scrollbar.

**Files:**
- Modify: `src/index.css:285-302`
- Test: manual visual verification (CSS defaults are not meaningfully unit-testable)

**Interfaces:**
- Consumes: the `--border` and `--muted-foreground` CSS custom properties already defined in `src/index.css`.
- Produces: a global slim scrollbar. The `.scrollbar-thin` utility class stays exported so existing call sites keep working.

- [ ] **Step 1: Implement the global default**

In `src/index.css`, replace the `/* Custom scrollbar */` block with:

```css
  /* Custom scrollbar — global default, slim and themed. `.scrollbar-thin` is
     retained as an explicit opt-in for call sites that already reference it. */
  * {
    scrollbar-width: thin;
    scrollbar-color: hsl(var(--border)) transparent;
  }

  *::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  *::-webkit-scrollbar-track {
    background: transparent;
  }

  *::-webkit-scrollbar-thumb {
    background-color: hsl(var(--border));
    border-radius: 9999px;
  }

  *::-webkit-scrollbar-thumb:hover {
    background-color: hsl(var(--muted-foreground));
  }

  *::-webkit-scrollbar-corner {
    background: transparent;
  }

  .scrollbar-thin::-webkit-scrollbar {
    width: 4px;
    height: 4px;
  }
```

Note the width is 8px globally rather than the sidebar's 4px: a 4px thumb is difficult to
grab with a mouse on long content pages. The sidebar keeps its narrower 4px via the
retained `.scrollbar-thin` override.

- [ ] **Step 2: Verify `--muted-foreground` exists**

Run: `grep -n "\-\-muted-foreground" src/index.css | head -3`

Expected: at least one definition in both the light and dark theme blocks. If it is
missing from either, use `hsl(var(--border))` for the hover color instead.

- [ ] **Step 3: Verify visually**

Run `npm run dev`, open an admin page with overflowing content, and confirm in both light
and dark mode that the scrollbar is slim, rounded, and track-less. Do not mark this step
done by reading the diff.

- [ ] **Step 4: Commit**

```bash
git add src/index.css
git commit -m "style(admin-web): slim themed scrollbars app-wide"
```

---

### Task 5: Fix the sidebar Overview icon alignment

All sidebar icons render at `h-[22px] w-[22px]` (`AdminSidebar.tsx:550,573`), so the
Overview icon's misalignment is optical, not a sizing bug: `LayoutDashboard`'s four
unequal rectangles read off-center beside the single-shape icons around it.

**Files:**
- Modify: `src/components/AdminSidebar.tsx` (the `lucide-react` import block and line 97)
- Test: manual visual verification

**Interfaces:**
- Consumes: `lucide-react` icon components.
- Produces: no API change. `NavItem["icon"]` keeps its `typeof LayoutDashboard` type, which is structurally identical for every lucide icon.

- [ ] **Step 1: Swap the icon**

In `src/components/AdminSidebar.tsx`, add `LayoutGrid` to the existing `lucide-react`
import, then change the Overview nav entry at line 97 from `icon: LayoutDashboard,` to
`icon: LayoutGrid,`.

`LayoutGrid` draws four equal squares on a symmetric grid, so it optically centers against
the neighboring icons.

- [ ] **Step 2: Check whether `LayoutDashboard` is still referenced**

Run: `grep -n "LayoutDashboard" src/components/AdminSidebar.tsx`

The type annotations at lines 71 and 85 (`icon: typeof LayoutDashboard`) still reference
it, so the import must stay. If those are the only remaining hits, leave the import in
place — do not remove it.

- [ ] **Step 3: Verify visually**

Run `npm run dev` and confirm the Overview icon sits on the same optical vertical axis as
User Management, Security, and Access Control, in both the expanded and collapsed sidebar.

- [ ] **Step 4: Commit**

```bash
git add src/components/AdminSidebar.tsx
git commit -m "fix(admin-web): optically center the sidebar Overview icon"
```

---

### Task 6: Tune the query cache so revisits are instant

`src/app/providers.tsx:106-112` sets only `retry: 1` and `refetchOnWindowFocus: false`.
With `staleTime` at its default of 0, every navigation back to a page refetches from
scratch and shows a loading state, which is the main source of the "slow" feel.

**Files:**
- Modify: `src/app/providers.tsx:106-112`
- Test: `src/test/query-defaults.test.ts` (create)

**Interfaces:**
- Consumes: `QueryClient` from `@tanstack/react-query`.
- Produces: `createAdminQueryClient(): QueryClient` — a new named export from `src/app/providers.tsx`, so the defaults are testable without rendering the provider tree. `Providers` calls it internally.

- [ ] **Step 1: Write the failing test**

Create `src/test/query-defaults.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createAdminQueryClient } from "@/app/providers";

describe("admin query defaults", () => {
  it("keeps data fresh long enough that revisiting a page does not refetch", () => {
    const defaults = createAdminQueryClient().getDefaultOptions().queries;

    expect(defaults?.staleTime).toBeGreaterThanOrEqual(30_000);
    expect(defaults?.refetchOnWindowFocus).toBe(false);
    expect(defaults?.retry).toBe(1);
  });

  it("keeps unmounted page data cached for longer than it stays fresh", () => {
    const defaults = createAdminQueryClient().getDefaultOptions().queries;

    expect(defaults?.gcTime).toBeGreaterThan(defaults?.staleTime as number);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/test/query-defaults.test.ts`

Expected: FAIL with "createAdminQueryClient is not exported" or similar.

- [ ] **Step 3: Implement**

In `src/app/providers.tsx`, extract the client construction into an exported factory above
the `Providers` component. It takes the two cache callbacks as arguments so the error
handling stays wired exactly as it is today:

```tsx
/**
 * Query defaults tuned for an admin console: pages are revisited constantly via the
 * sidebar, and a 0ms staleTime meant every revisit refetched and flashed a loading
 * state. 60s of freshness with a 5min cache makes back-navigation instant while
 * keeping data current enough for operational screens.
 */
export function createAdminQueryClient(
  onQueryError?: (error: unknown) => void,
  onMutationError?: (error: unknown) => void,
): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: 1,
        refetchOnWindowFocus: false,
        staleTime: 60_000,
        gcTime: 5 * 60_000,
      },
    },
    queryCache: new QueryCache({ onError: (error) => onQueryError?.(error) }),
    mutationCache: new MutationCache({ onError: (error) => onMutationError?.(error) }),
  });
}
```

Then change the `useState` initializer in `Providers` to:

```tsx
  const [queryClient] = useState(() =>
    createAdminQueryClient(
      (error) => handleAdminQueryError(error, router, currentPathname()),
      (error) => handleAdminQueryError(error, router, currentPathname()),
    ),
  );
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/test/query-defaults.test.ts`

Expected: PASS, 2 tests.

- [ ] **Step 5: Run the full suite**

Run: `npm test`

Expected: PASS. Confirm `src/test/auth-gate.test.tsx` still passes — it exercises the error-handling path being rewired here.

- [ ] **Step 6: Commit**

```bash
git add src/app/providers.tsx src/test/query-defaults.test.ts
git commit -m "perf(admin-web): tune query staleTime and gcTime so page revisits are instant"
```

---

### Task 7: Prefetch sidebar routes on hover

Next's `<Link>` prefetches the route bundle, but not the data. Prefetching the underlying
query on hover means the page often has data before the click lands.

**Files:**
- Modify: `src/components/AdminSidebar.tsx`
- Test: `src/test/sidebar-prefetch.test.tsx` (create)

**Interfaces:**
- Consumes: `useQueryClient()` from `@tanstack/react-query`; the `NavItem` shape already defined in `AdminSidebar.tsx:71-90`.
- Produces: an optional `prefetch?: { queryKey: unknown[]; queryFn: () => Promise<unknown> }` property on nav items. Items without it behave exactly as today.

- [ ] **Step 1: Write the failing test**

Create `src/test/sidebar-prefetch.test.tsx`:

```tsx
import { describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { prefetchNavItem } from "@/components/AdminSidebar";

describe("prefetchNavItem", () => {
  it("populates the cache for an item that declares a prefetch", async () => {
    const client = new QueryClient();
    const queryFn = vi.fn().mockResolvedValue({ ok: true });

    await prefetchNavItem(client, { prefetch: { queryKey: ["service-definitions"], queryFn } });

    expect(queryFn).toHaveBeenCalledTimes(1);
    expect(client.getQueryData(["service-definitions"])).toEqual({ ok: true });
  });

  it("is a no-op for an item with no prefetch declared", async () => {
    const client = new QueryClient();

    await expect(prefetchNavItem(client, {})).resolves.toBeUndefined();
  });

  it("does not refetch data that is already fresh", async () => {
    const client = new QueryClient();
    const queryFn = vi.fn().mockResolvedValue({ ok: true });
    client.setQueryData(["service-definitions"], { ok: true });

    await prefetchNavItem(client, { prefetch: { queryKey: ["service-definitions"], queryFn } });

    expect(queryFn).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/test/sidebar-prefetch.test.tsx`

Expected: FAIL — `prefetchNavItem` is not exported.

- [ ] **Step 3: Implement the helper**

In `src/components/AdminSidebar.tsx`, add near the top-level helpers:

```tsx
import type { QueryClient } from "@tanstack/react-query";

export type NavPrefetch = { queryKey: unknown[]; queryFn: () => Promise<unknown> };

/**
 * Warms a nav item's data on hover so the click lands on a populated cache instead of a
 * loading state. `staleTime` here mirrors the global 60s default: hovering a link whose
 * data is still fresh must not trigger a network request.
 */
export async function prefetchNavItem(
  client: QueryClient,
  item: { prefetch?: NavPrefetch },
): Promise<void> {
  if (!item.prefetch) return;
  await client.prefetchQuery({
    queryKey: item.prefetch.queryKey,
    queryFn: item.prefetch.queryFn,
    staleTime: 60_000,
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/test/sidebar-prefetch.test.tsx`

Expected: PASS, 3 tests.

- [ ] **Step 5: Wire it to the nav items**

Add `prefetch` to the `NavItem` and sub-item type definitions (lines 71 and 85 area) as an
optional `prefetch?: NavPrefetch`.

Then, on the sub-item link element around line 617, add the hover handler. Obtain the
client once in the component body with `const queryClient = useQueryClient();`:

```tsx
                                  onMouseEnter={() => void prefetchNavItem(queryClient, sub)}
                                  onFocus={() => void prefetchNavItem(queryClient, sub)}
```

Declare `prefetch` on the five Operations Core sub-items, importing the list functions
from `@/lib/api/admin-api`. Their query keys must match the `queryKey` prop each page
passes to `OperationsCrudPage` — verify each against the page file before writing it:

```tsx
prefetch: { queryKey: ["service-definitions"], queryFn: () => listServiceDefinitions({ skip: 0, limit: 100 }) },
prefetch: { queryKey: ["add-ons"], queryFn: () => listAddOns({ skip: 0, limit: 100 }) },
prefetch: { queryKey: ["pricing-rules"], queryFn: () => listPricingRules({ skip: 0, limit: 100 }) },
prefetch: { queryKey: ["service-areas"], queryFn: () => listServiceAreas({ skip: 0, limit: 100 }) },
prefetch: { queryKey: ["promo-codes"], queryFn: () => listPromoCodes({ skip: 0, limit: 100 }) },
```

- [ ] **Step 6: Verify the query keys match**

Run: `grep -rn "queryKey=" src/features/admin/screens/operations/`

Every key above must appear verbatim. A mismatch means the prefetch warms a cache entry
the page never reads — silently useless. Fix any mismatch before continuing.

- [ ] **Step 7: Run the full suite**

Run: `npm test`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/components/AdminSidebar.tsx src/test/sidebar-prefetch.test.tsx
git commit -m "perf(admin-web): prefetch Operations Core data on sidebar hover"
```

---

### Task 8: Give CRUD mutations instant feedback and block double-submit

`OperationsCrudPage` is the shared surface for all nine CRUD features. Its save and delete
buttons have no pending state, so a slow request looks like a dead click and can be
submitted twice.

**Files:**
- Modify: `src/features/admin/screens/operations/OperationsCrudPage.tsx`
- Test: `src/test/operations-crud-page.test.tsx` (create)

**Interfaces:**
- Consumes: the `OperationsCrudPageProps` contract already defined at `OperationsCrudPage.tsx:47-60`.
- Produces: no prop changes. Behavior only.

- [ ] **Step 1: Write the failing test**

Create `src/test/operations-crud-page.test.tsx`:

```tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { OperationsCrudPage } from "@/features/admin/screens/operations/OperationsCrudPage";

vi.mock("@/hooks/use-admin-auth", () => ({ useAdminProfile: () => ({ data: undefined }) }));
vi.mock("@/lib/admin-access", () => ({ canAccessAdminAction: () => true }));

function renderPage(createFn: () => Promise<unknown>) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <OperationsCrudPage
        title="Service Definitions"
        description="test"
        queryKey="service-definitions"
        readRequirement={{ method: "GET", path: "/x" }}
        createRequirement={{ method: "POST", path: "/x" }}
        updateRequirement={{ method: "PATCH", path: "/x" }}
        deleteRequirement={{ method: "DELETE", path: "/x" }}
        fields={[{ key: "display_name", label: "Display Name", type: "text", required: true }]}
        listFn={async () => []}
        createFn={createFn}
        updateFn={async () => ({})}
        deleteFn={async () => ({})}
      />
    </QueryClientProvider>,
  );
}

describe("OperationsCrudPage submit feedback", () => {
  it("disables the submit button while the create request is in flight", async () => {
    const user = userEvent.setup();
    let release: () => void = () => {};
    const createFn = vi.fn(() => new Promise<unknown>((resolve) => { release = () => resolve({}); }));

    renderPage(createFn);

    await user.click(await screen.findByRole("button", { name: /new|create|add/i }));
    await user.type(await screen.findByLabelText(/display name/i), "Home Cleaning");
    const submit = screen.getByTestId("crud-submit");
    await user.click(submit);

    await waitFor(() => expect(submit).toBeDisabled());
    expect(createFn).toHaveBeenCalledTimes(1);

    await user.click(submit);
    expect(createFn).toHaveBeenCalledTimes(1);

    release();
  });
});
```

- [ ] **Step 2: Install the interaction library if absent**

Run: `node -e "require.resolve('@testing-library/user-event')" || npm install -D @testing-library/user-event`

`@testing-library/user-event` is not currently in `package.json`. Install it as a dev
dependency and commit the lockfile change with this task.

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/test/operations-crud-page.test.tsx`

Expected: FAIL — no `crud-submit` test id, and the button is not disabled while pending.

- [ ] **Step 4: Implement**

In `src/features/admin/screens/operations/OperationsCrudPage.tsx`, add
`data-testid="crud-submit"` to the dialog's submit button, and derive its disabled and
label state from the mutation. Using the create/update mutation objects already defined in
the component:

```tsx
              <Button
                data-testid="crud-submit"
                onClick={handleSubmit}
                disabled={createMutation.isPending || updateMutation.isPending || !isValid}
              >
                {createMutation.isPending || updateMutation.isPending ? "Saving..." : "Save"}
              </Button>
```

Apply the same treatment to the delete confirmation action:

```tsx
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? "Deleting..." : "Delete"}
              </AlertDialogAction>
```

Use the real mutation variable names from the file; the names above are indicative.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/test/operations-crud-page.test.tsx`

Expected: PASS.

- [ ] **Step 6: Run the full suite**

Run: `npm test`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/admin/screens/operations/OperationsCrudPage.tsx src/test/operations-crud-page.test.tsx package.json package-lock.json
git commit -m "feat(admin-web): pending states and double-submit guards on CRUD mutations"
```

---

### Task 9: Replace the CRUD list spinner with the existing table skeleton

`OperationsCrudPage` shows a centered loader while listing, which gives no sense of the
shape of what is loading.

Do **not** write a new skeleton component. `src/components/feedback/table-skeleton.tsx`
already solves this, and solves it better than a fresh implementation would: it uses
deterministic cell widths (random widths would mismatch between server and client render),
honours `motion-reduce`, and is correctly marked `aria-hidden` because the surrounding
region owns the loading announcement.

**Files:**
- Modify: `src/features/admin/screens/operations/OperationsCrudPage.tsx` (list-loading branch)
- Test: `src/test/operations-crud-skeleton.test.tsx` (create)

**Interfaces:**
- Consumes: `TableSkeleton` from `@/components/feedback/table-skeleton`, signature `TableSkeleton({ rows?: number; columns?: number; className?: string })`.
- Produces: no new exports.

- [ ] **Step 1: Locate the loading branch**

Run: `grep -n "isLoading" src/features/admin/screens/operations/OperationsCrudPage.tsx`

Note the exact JSX currently rendered while the list query is pending.

- [ ] **Step 2: Write the failing test**

Create `src/test/operations-crud-skeleton.test.tsx`:

```tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { OperationsCrudPage } from "@/features/admin/screens/operations/OperationsCrudPage";

vi.mock("@/hooks/use-admin-auth", () => ({ useAdminProfile: () => ({ data: undefined }) }));
vi.mock("@/lib/admin-access", () => ({ canAccessAdminAction: () => true }));

describe("OperationsCrudPage loading state", () => {
  it("renders a skeleton shaped like the list while loading", () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { container } = render(
      <QueryClientProvider client={client}>
        <OperationsCrudPage
          title="Service Definitions"
          description="test"
          queryKey="service-definitions"
          readRequirement={{ method: "GET", path: "/x" }}
          createRequirement={{ method: "POST", path: "/x" }}
          updateRequirement={{ method: "PATCH", path: "/x" }}
          deleteRequirement={{ method: "DELETE", path: "/x" }}
          fields={[{ key: "display_name", label: "Display Name", type: "text", required: true }]}
          listFn={() => new Promise(() => {})}
          createFn={async () => ({})}
          updateFn={async () => ({})}
          deleteFn={async () => ({})}
        />
      </QueryClientProvider>,
    );

    // TableSkeleton is aria-hidden by design, so query the DOM rather than the a11y tree.
    expect(container.querySelector('[aria-hidden="true"]')).toBeTruthy();
    expect(screen.queryByText(/loading\.\.\./i)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/test/operations-crud-skeleton.test.tsx`

Expected: FAIL — the current branch renders a spinner, not a skeleton.

- [ ] **Step 4: Implement**

Import the existing component in `OperationsCrudPage.tsx`:

```tsx
import { TableSkeleton } from "@/components/feedback/table-skeleton";
```

and replace the list-loading branch located in Step 1 with:

```tsx
        <TableSkeleton rows={5} columns={3} />
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/test/operations-crud-skeleton.test.tsx`

Expected: PASS.

- [ ] **Step 6: Run the full suite**

Run: `npm test`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/admin/screens/operations/OperationsCrudPage.tsx src/test/operations-crud-skeleton.test.tsx
git commit -m "feat(admin-web): use the shared table skeleton for CRUD list loading"
```

---

### Task 10: Audit `admin-api.ts` paths against the OpenAPI spec

Section D of the spec calls for a mechanical audit. Task 1 already proved one shape-drift
defect exists; this task finds the rest of the path-drift class systematically rather than
by inspection, and locks the result in as a regression test.

**Files:**
- Create: `src/test/api-path-parity.test.ts`
- Modify: `src/lib/api/admin-api.ts` (only if the audit finds a genuine mismatch)

**Interfaces:**
- Consumes: the OpenAPI document at `C:/Users/Mr Dashi/Downloads/api-1.json`.
- Produces: a checked-in copy at `src/test/fixtures/openapi.json` so the test does not depend on a file outside the repo.

- [ ] **Step 1: Vendor the spec as a fixture**

```bash
mkdir -p src/test/fixtures
cp "C:/Users/Mr Dashi/Downloads/api-1.json" src/test/fixtures/openapi.json
```

Vendoring matters: a test reading from a user's Downloads folder passes on one machine and
fails in CI.

- [ ] **Step 2: Write the audit test**

Create `src/test/api-path-parity.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const spec = JSON.parse(readFileSync(resolve(__dirname, "fixtures/openapi.json"), "utf8")) as {
  paths: Record<string, unknown>;
};

const source = readFileSync(resolve(__dirname, "../lib/api/admin-api.ts"), "utf8");

/** Turns `/v1/admins/x/${id}/y` into the spec's `/api/v1/admins/x/{id}/y` shape. */
function toSpecPath(clientPath: string): string {
  return `/api${clientPath.replace(/\$\{[^}]+\}/g, "{param}")}`;
}

function normalize(specPath: string): string {
  return specPath.replace(/\{[^}]+\}/g, "{param}");
}

describe("admin-api path parity with the OpenAPI spec", () => {
  const knownPaths = new Set(Object.keys(spec.paths).map(normalize));

  // Every apiRequest("/v1/...") / apiRequest(`/v1/...`) literal in the client.
  const clientPaths = Array.from(
    source.matchAll(/apiRequest<[^>]*>\(\s*[`"](\/v1\/[^`"]+)[`"]/g),
    (match) => match[1],
  );

  it("finds the client's request paths", () => {
    expect(clientPaths.length).toBeGreaterThan(20);
  });

  it.each(clientPaths)("%s exists in the spec", (clientPath) => {
    expect(knownPaths).toContain(normalize(toSpecPath(clientPath)));
  });
});
```

- [ ] **Step 3: Run the audit**

Run: `npx vitest run src/test/api-path-parity.test.ts`

This is a discovery step, not a pass/fail gate. Record every failing path.

- [ ] **Step 4: Triage each failure**

For each failing path, decide which it is and act accordingly:

- **Client typo or stale path** — fix `admin-api.ts` to match the spec.
- **Endpoint genuinely absent from the backend** — leave the client unchanged, and add the
  path to an `EXPECTED_MISSING` array in the test with an inline comment naming the reason.
  This becomes Batch 2 input.
- **Regex artifact** (the matcher caught a non-path string) — refine the regex, do not
  weaken the assertion.

Do not make the test pass by deleting assertions.

- [ ] **Step 5: Re-run until green**

Run: `npx vitest run src/test/api-path-parity.test.ts`

Expected: PASS, with every exemption documented by an inline comment.

- [ ] **Step 6: Run the full suite**

Run: `npm test`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/test/api-path-parity.test.ts src/test/fixtures/openapi.json src/lib/api/admin-api.ts
git commit -m "test(admin-web): pin admin-api request paths against the OpenAPI spec"
```

---

### Task 11: End-to-end verification of the repaired pages

The two pages this batch exists to fix were broken at runtime, not at type-check time.
Unit tests alone would not have caught either. This task verifies them in a real browser.

**Files:**
- Create: `e2e/admin-repaired-pages.spec.ts`
- Reference: `e2e/admin-login.spec.ts`, `playwright.config.ts`

**Interfaces:**
- Consumes: the auth setup pattern already established in `e2e/admin-login.spec.ts`.
- Produces: no exports.

- [ ] **Step 1: Read the existing e2e auth pattern**

Run: `cat e2e/admin-login.spec.ts && cat playwright.config.ts`

Note how authentication is established and what `baseURL` is configured. Reuse that
mechanism rather than inventing a second one.

- [ ] **Step 2: Write the spec**

Create `e2e/admin-repaired-pages.spec.ts`. Adapt the authentication preamble to match what
Step 1 revealed:

```ts
import { test, expect } from "@playwright/test";

/**
 * Both pages below shipped broken: /admin/security/sessions white-screened on an
 * undefined field, and /admin/permissions/templates dead-ended on a bare error
 * string. Both failed only at runtime, so they need a real browser to verify.
 */

test("the sessions page renders without a client-side exception", async ({ page }) => {
  const pageErrors: Error[] = [];
  page.on("pageerror", (error) => pageErrors.push(error));

  await page.goto("/admin/security/sessions");

  await expect(page.getByRole("heading", { name: /session risk panel/i })).toBeVisible();
  await expect(page.getByText(/application error/i)).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});

test("the role templates page keeps the role selector reachable", async ({ page }) => {
  await page.goto("/admin/permissions/templates");

  await expect(page.getByRole("heading", { name: /role permission templates/i })).toBeVisible();
  await expect(page.getByTestId("role-template-role-selector")).toBeVisible();
});
```

- [ ] **Step 3: Run the e2e suite**

Run: `npx playwright test e2e/admin-repaired-pages.spec.ts`

Expected: PASS. If the run cannot authenticate against a live backend, note that
explicitly in the task handoff rather than deleting the assertions — a skipped test that
reports as passing is worse than no test.

- [ ] **Step 4: Commit**

```bash
git add e2e/admin-repaired-pages.spec.ts
git commit -m "test(admin-web): e2e coverage for the two repaired admin pages"
```

---

### Task 12: Optimistic delete with rollback

Deleting a CRUD record currently waits for the round trip before the row disappears. An
optimistic removal with rollback on error makes the action feel instant while staying
honest when the server rejects it.

The optimistic logic is extracted into a pure factory rather than written inline in the
mutation. Inline handlers can only be reached by driving a confirmation dialog, which
tests the dialog rather than the rollback; a factory taking an explicit `QueryClient`
lets the cache transitions be asserted directly.

**Files:**
- Create: `src/features/admin/screens/operations/optimistic-delete.ts`
- Modify: `src/features/admin/screens/operations/OperationsCrudPage.tsx` (the delete mutation)
- Test: `src/test/optimistic-delete.test.ts` (create)

**Interfaces:**
- Consumes: `QueryClient` from `@tanstack/react-query`; `AdminResourceItem` from `@/lib/api/types`; `itemId(item)` currently defined at `OperationsCrudPage.tsx:62`.
- Produces: `optimisticDeleteHandlers(client: QueryClient, queryKey: string)` returning `{ onMutate(id: string): Promise<{ previous?: AdminResourceItem[] }>, onError(error: unknown, id: string, context?: { previous?: AdminResourceItem[] }): void, onSettled(): void }`. Also exports `itemId(item: AdminResourceItem): string`, moved here so both modules share one definition.

- [ ] **Step 1: Write the failing test**

Create `src/test/optimistic-delete.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { optimisticDeleteHandlers } from "@/features/admin/screens/operations/optimistic-delete";
import type { AdminResourceItem } from "@/lib/api/types";

const ITEMS: AdminResourceItem[] = [
  { id: "1", display_name: "Home Cleaning" },
  { id: "2", display_name: "Deep Cleaning" },
];

function seededClient() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(["service-definitions"], ITEMS);
  return client;
}

describe("optimisticDeleteHandlers", () => {
  it("removes the row from cache before the request resolves", async () => {
    const client = seededClient();
    const handlers = optimisticDeleteHandlers(client, "service-definitions");

    await handlers.onMutate("1");

    const cached = client.getQueryData<AdminResourceItem[]>(["service-definitions"]);
    expect(cached).toHaveLength(1);
    expect(cached?.[0].id).toBe("2");
  });

  it("returns the pre-delete list so a failure can roll back", async () => {
    const client = seededClient();
    const handlers = optimisticDeleteHandlers(client, "service-definitions");

    const context = await handlers.onMutate("1");

    expect(context.previous).toHaveLength(2);
  });

  it("restores the removed row when the request fails", async () => {
    const client = seededClient();
    const handlers = optimisticDeleteHandlers(client, "service-definitions");

    const context = await handlers.onMutate("1");
    handlers.onError(new Error("boom"), "1", context);

    const cached = client.getQueryData<AdminResourceItem[]>(["service-definitions"]);
    expect(cached).toHaveLength(2);
    expect(cached?.map((item) => item.id)).toEqual(["1", "2"]);
  });

  it("leaves the cache untouched when the id matches nothing", async () => {
    const client = seededClient();
    const handlers = optimisticDeleteHandlers(client, "service-definitions");

    await handlers.onMutate("does-not-exist");

    expect(client.getQueryData<AdminResourceItem[]>(["service-definitions"])).toHaveLength(2);
  });

  it("tolerates an unseeded cache without throwing", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const handlers = optimisticDeleteHandlers(client, "service-definitions");

    const context = await handlers.onMutate("1");

    expect(context.previous).toBeUndefined();
    expect(client.getQueryData(["service-definitions"])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/test/optimistic-delete.test.ts`

Expected: FAIL — the module does not exist.

- [ ] **Step 3: Implement the factory**

Create `src/features/admin/screens/operations/optimistic-delete.ts`:

```ts
import type { QueryClient } from "@tanstack/react-query";
import type { AdminResourceItem } from "@/lib/api/types";

/** A record's id, tolerating both the `id` and Mongo `_id` spellings the API returns. */
export function itemId(item: AdminResourceItem): string {
  const candidate = item.id || item._id;
  return typeof candidate === "string" ? candidate : "";
}

export interface OptimisticDeleteContext {
  previous?: AdminResourceItem[];
}

/**
 * Cache transitions for an optimistic delete, as a factory rather than inline mutation
 * handlers: inline handlers can only be reached by driving the confirmation dialog,
 * which tests the dialog instead of the rollback.
 */
export function optimisticDeleteHandlers(client: QueryClient, queryKey: string) {
  const key = [queryKey];

  return {
    async onMutate(id: string): Promise<OptimisticDeleteContext> {
      // Stop an in-flight list refetch from overwriting the optimistic removal.
      await client.cancelQueries({ queryKey: key });
      const previous = client.getQueryData<AdminResourceItem[]>(key);
      client.setQueryData<AdminResourceItem[]>(key, (current) =>
        (current ?? []).filter((item) => itemId(item) !== id),
      );
      return { previous };
    },

    onError(_error: unknown, _id: string, context?: OptimisticDeleteContext): void {
      // The server still has the record; put it back.
      if (context?.previous) client.setQueryData(key, context.previous);
    },

    onSettled(): void {
      void client.invalidateQueries({ queryKey: key });
    },
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/test/optimistic-delete.test.ts`

Expected: PASS, 5 tests.

- [ ] **Step 5: Wire the factory into the CRUD page**

In `OperationsCrudPage.tsx`, import the factory and remove the now-duplicated local
`itemId` definition at line 62, importing it from the new module instead:

```tsx
import { itemId, optimisticDeleteHandlers } from "@/features/admin/screens/operations/optimistic-delete";
```

Then wire the handlers into the delete mutation, keeping the existing toasts and dialog
dismissal. Build the handlers once so `onError` closes over the same instance:

```tsx
  const deleteCache = optimisticDeleteHandlers(queryClient, queryKey);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteFn(id),
    onMutate: deleteCache.onMutate,
    onSettled: deleteCache.onSettled,
    onError: (error, id, context) => {
      deleteCache.onError(error, id, context);
      toast.error("Failed to delete record.");
    },
    onSuccess: () => toast.success("Record deleted."),
  });
```

The `onError` wrapper is deliberate: assigning the factory's `onError` directly would
drop the toast, and assigning only the toast would silently drop the rollback.

- [ ] **Step 6: Verify no duplicate `itemId` remains**

Run: `grep -rn "function itemId" src/features/admin/screens/operations/`

Expected: exactly one definition, in `optimistic-delete.ts`.

- [ ] **Step 7: Run the full suite**

Run: `npm test`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/features/admin/screens/operations/optimistic-delete.ts src/features/admin/screens/operations/OperationsCrudPage.tsx src/test/optimistic-delete.test.ts
git commit -m "perf(admin-web): optimistic CRUD delete with rollback on failure"
```

---

### Task 13: Route-level loading boundaries for every admin section

`loading.tsx` exists for `admin`, `admin/access`, `admin/governance`, `admin/operations`
and `admin/support`, but not for `security`, `permissions`, `users`, `team`,
`institutions`, `onboarding`, or `settings`. Those sections fall back to the nearest
ancestor boundary, so navigation into them blocks longer than it needs to.

**Files:**
- Create: `src/app/admin/security/loading.tsx`, `src/app/admin/permissions/loading.tsx`, `src/app/admin/users/loading.tsx`, `src/app/admin/team/loading.tsx`, `src/app/admin/institutions/loading.tsx`, `src/app/admin/onboarding/loading.tsx`, `src/app/admin/settings/loading.tsx`
- Test: `src/test/loading-boundaries.test.ts` (create)

**Interfaces:**
- Consumes: `PageSkeleton` from `@/components/feedback/page-skeleton`, used by the existing boundaries.
- Produces: no exports.

- [ ] **Step 1: Confirm the existing boundary pattern**

Run: `cat src/app/admin/operations/loading.tsx`

Every new file mirrors this exactly, changing only the `label`.

- [ ] **Step 2: Write the failing test**

Create `src/test/loading-boundaries.test.ts`:

```ts
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Every admin section needs its own loading boundary; without one, navigation falls
 * back to an ancestor and the section blocks longer than necessary before painting.
 */
const SECTIONS = [
  "access",
  "governance",
  "institutions",
  "onboarding",
  "operations",
  "permissions",
  "security",
  "settings",
  "support",
  "team",
  "users",
];

describe("admin route loading boundaries", () => {
  it.each(SECTIONS)("src/app/admin/%s has a loading.tsx", (section) => {
    expect(existsSync(resolve(__dirname, `../app/admin/${section}/loading.tsx`))).toBe(true);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/test/loading-boundaries.test.ts`

Expected: FAIL for the seven sections listed in **Files** above.

- [ ] **Step 4: Create the seven boundaries**

Each file follows the same shape. For `src/app/admin/security/loading.tsx`:

```tsx
import { PageSkeleton } from "@/components/feedback/page-skeleton";

export default function Loading() {
  return <PageSkeleton label="Loading security" />;
}
```

Repeat for the remaining six, with labels: `Loading permissions`, `Loading users`,
`Loading team`, `Loading institutions`, `Loading onboarding`, `Loading settings`.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/test/loading-boundaries.test.ts`

Expected: PASS, 11 cases.

- [ ] **Step 6: Verify the build still compiles**

Run: `npm run build`

Expected: success. A malformed `loading.tsx` is a build-time error in the App Router.

- [ ] **Step 7: Commit**

```bash
git add src/app/admin/*/loading.tsx src/test/loading-boundaries.test.ts
git commit -m "perf(admin-web): route-level loading boundaries for every admin section"
```

---

## Batch 1 Completion Checklist

- [ ] `npm test` passes.
- [ ] `npm run lint` passes.
- [ ] `npm run build` succeeds.
- [ ] `/admin/security/sessions` renders in a browser with no console errors.
- [ ] `/admin/permissions/templates` renders with a reachable role selector.
- [ ] Scrollbars are slim in both light and dark mode.
- [ ] The sidebar Overview icon is optically centered.
- [ ] Navigating away from and back to an Operations page does not flash a loading state.

## Deferred to Batch 2

Everything requiring a backend contract change: per-feature Zod schemas, the
`admin_feature_templates` collection and its picker, the richer `CrudField` types
(`select` / `radio` / `multiselect` / `date` / `money`), filter-dropdown `all` sentinel
cleanup, and the Operations Core deep pass. Any endpoint recorded as `EXPECTED_MISSING`
in Task 10 is also Batch 2 input.
