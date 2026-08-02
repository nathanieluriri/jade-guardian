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

describe("admin-api path parity with the OpenAPI spec", () => {
  const knownPaths = new Set(Object.keys(spec.paths).map(normalize));

  // Every literal `/v1/...` path passed to `apiRequest`, plus the four CRUD helpers
  // (`listAdminResource` / `createAdminResource` / `updateAdminResource` /
  // `deleteAdminResource`) that ~30 of the file's 63 `apiRequest` call sites route
  // through indirectly. A regex matching only `apiRequest<T>(` literals (the brief's
  // starting point) finds just 47 of the 63 occurrences and misses every resource
  // CRUD path entirely, since those pass their literal path to the helper, not
  // directly to `apiRequest`. Matching the helpers' call sites too closes that gap.
  const pathRegex =
    /(?:apiRequest(?:<[^>]*>)?|listAdminResource|createAdminResource|updateAdminResource|deleteAdminResource)\(\s*[`"](\/v1\/[^`"]+)[`"]/g;
  const clientPaths = Array.from(new Set(Array.from(source.matchAll(pathRegex), (match) => match[1])));

  it("finds the client's request paths", () => {
    expect(clientPaths.length).toBeGreaterThan(20);
  });

  const checkedPaths = clientPaths.filter((clientPath) => !EXPECTED_MISSING.includes(clientPath));

  it.each(checkedPaths)("%s exists in the spec", (clientPath) => {
    expect(knownPaths).toContain(normalize(toSpecPath(clientPath)));
  });
});
