import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const spec = JSON.parse(readFileSync(resolve(__dirname, "fixtures/openapi.json"), "utf8")) as {
  paths: Record<string, unknown>;
};

const source = readFileSync(resolve(__dirname, "../lib/api/admin-api.ts"), "utf8");

/**
 * Turns a client-side request path into the OpenAPI document's path shape:
 * `/v1/admins/x/${id}/y` -> `/api/v1/admins/x/{param}/y`.
 *
 * Two refinements beyond a literal `${...}` -> `{param}` swap were needed:
 *  - Query strings are stripped first (`split("?")[0]`). Several call sites build a
 *    literal path as `` `/v1/admins?${query.toString()}` ``; without stripping, the
 *    query portion survives as a bogus trailing `{param}` segment that can never match
 *    an OpenAPI path key (OpenAPI keys never include a query string).
 *  - Adjacent placeholders collapse to one (`getAuditEventById` builds
 *    `` `/v1/admins/monitoring/audit/history/${eventId}${suffix}` `` where `suffix` is
 *    itself a pre-built `?...` query string with no literal separator before it in the
 *    template). Two placeholders back-to-back with no path separator between them never
 *    represents two real path segments in this codebase, so collapsing is safe and does
 *    not paper over a genuine mismatch.
 */
function toSpecPath(clientPath: string): string {
  const withoutQuery = clientPath.split("?")[0];
  const withParams = withoutQuery.replace(/\$\{[^}]+\}/g, "{param}");
  const collapsed = withParams.replace(/(?:\{param\})+/g, "{param}");
  return `/api${collapsed}`;
}

function normalize(specPath: string): string {
  return specPath.replace(/\{[^}]+\}/g, "{param}");
}

/**
 * The spec has no client-side endpoint for these — confirmed absent by grepping
 * `admin-api.ts` for any call referencing them. Recorded here (not silently
 * dropped) so a future run of this test still catches a regression if one is
 * ever wired up with a typo'd path. Currently empty: the audit below found
 * every literal path the client calls already present in the spec.
 */
const EXPECTED_MISSING: string[] = [];

// NOTE: this suite checks path *existence* only. It does not check that the
// HTTP verb (GET/POST/PATCH/DELETE) the client uses for a given path matches
// a verb the spec actually documents for that path — a client call using the
// wrong method against an otherwise-known path would not be caught here.
describe("admin-api path parity with the OpenAPI spec (path existence only, not HTTP verb parity)", () => {
  const knownPaths = new Set(Object.keys(spec.paths).map(normalize));

  // Every literal `/v1/...` path passed to `apiRequest`, plus the four CRUD helpers
  // (`listAdminResource` / `createAdminResource` / `updateAdminResource` /
  // `deleteAdminResource`) that ~30 of the file's 63 `apiRequest` call sites route
  // through indirectly. A regex matching only `apiRequest<T>(` literals (the brief's
  // starting point) finds just 47 of the 63 occurrences and misses every resource
  // CRUD path entirely, since those pass their literal path to the helper, not
  // directly to `apiRequest`. Matching the helpers' call sites too closes that gap.
  //
  // The generic-type portion is matched with `<(?:[^<>]|<[^<>]*>)*>`, which allows
  // one level of nesting (e.g. `apiRequest<Partial<SessionAnomalies> | null>(...)`
  // or `apiRequest<RoleTemplate | Record<string, unknown>>(...)`) rather than
  // stopping at the first `>`, which previously truncated the match and made the
  // whole call site invisible to this audit. `\s*` between the generic and the
  // opening `(...)"` already matches newlines, so a call where the path literal
  // sits on a line after `apiRequest<...>(` (e.g. `fetchSessionAnomalies`) is
  // still found.
  const pathRegex =
    /(?:apiRequest(?:<(?:[^<>]|<[^<>]*>)*>)?|listAdminResource|createAdminResource|updateAdminResource|deleteAdminResource)\(\s*[`"](\/v1\/[^`"]+)[`"]/g;
  const clientPaths = Array.from(new Set(Array.from(source.matchAll(pathRegex), (match) => match[1])));

  // Before the nested-generic fix (Finding 2), this regex found 79 unique paths and
  // silently dropped 3 call sites whose generic argument itself contained a `>`
  // (`apiRequest<Record<string, never>>`, `apiRequest<Partial<SessionAnomalies> |
  // null>`, `apiRequest<RoleTemplate | Record<string, unknown>>`) plus the
  // multi-line `fetchSessionAnomalies` call. The fixed regex found 82. Task 2 of the
  // 2026-08-02 admin-console-batch-3a added the notification broadcast API client
  // (`fetchNotificationTypes`, `previewBroadcastAudience`, `createBroadcast_v2`,
  // `listNotificationBroadcasts`, `fetchNotificationBroadcast`, `resumeBroadcast`,
  // `cancelBroadcast`), which contributes 6 new distinct literal paths — the true
  // count is now 88. This floor is set just below that true count so a future
  // regression that silently drops call sites (e.g. a new nesting depth the
  // balanced-bracket pattern can't handle) fails the test instead of passing
  // unnoticed.
  it("finds the client's request paths", () => {
    expect(clientPaths.length).toBeGreaterThan(87);
  });

  const checkedPaths = clientPaths.filter((clientPath) => !EXPECTED_MISSING.includes(clientPath));

  it.each(checkedPaths)("%s exists in the spec", (clientPath) => {
    expect(knownPaths).toContain(normalize(toSpecPath(clientPath)));
  });
});
