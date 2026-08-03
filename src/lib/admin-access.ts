import type { AdminProfile } from "@/lib/api/types";

export interface PermissionRequirement {
  key?: string;
  method: string;
  path: string;
}

export const ACCESS_HUB_ROUTE = "/admin/access";

/** Self-service security settings: 2FA and password are the admin's own account, never a granted permission. */
export const SECURITY_SETTINGS_ROUTE = "/admin/settings/security";

/**
 * The bare `/admin` landing redirector (`app/admin/page.tsx`). It renders no
 * data of its own — it reads the profile the gate already fetched and replaces
 * itself with `resolveFirstAllowedAdminRoute`. Listing it here is what lets it
 * run: without it `canAccessAdminRoute("/admin")` is false (no requirements
 * entry either), so `AdminAuthGate` rendered `PermissionDenied` over the
 * redirector and every admin without a wildcard/super-admin profile dead-ended
 * on the console's own entry URL.
 */
export const ADMIN_LANDING_ROUTE = "/admin";

export const ALWAYS_ALLOWED_ADMIN_ROUTES = [
  ADMIN_LANDING_ROUTE,
  ACCESS_HUB_ROUTE,
  "/admin/access/permission-groups",
  "/admin/access/request-elevation",
  SECURITY_SETTINGS_ROUTE,
] as const;

export const ROUTE_TITLES: Record<string, string> = {
  "/admin/overview": "Overview",
  "/admin/security/alerts": "Alerts",
  "/admin/security/sessions": "Sessions",
  "/admin/security/audit": "Audit Log",
  "/admin/permissions/catalog": "Permission Catalog",
  "/admin/permissions/templates": "Role Templates",
  "/admin/onboarding/cleaners": "Cleaner Onboarding",
  "/admin/institutions/employees": "Employees",
  "/admin/team": "Team",
  "/admin/users": "Users",
  "/admin/access": "Access Hub",
  "/admin/access/permission-groups": "Permission Groups",
  "/admin/access/request-elevation": "Request Elevation",
  "/admin/access/requests": "Access Requests",
  [SECURITY_SETTINGS_ROUTE]: "Account Security",
  "/admin/operations/service-definitions": "Service Definitions",
  "/admin/operations/add-ons": "Add-ons",
  "/admin/operations/pricing-rules": "Pricing Rules",
  "/admin/operations/service-areas": "Service Areas",
  "/admin/operations/promo-codes": "Promo Codes",
  "/admin/support/concierge-bookings": "Concierge Bookings",
  "/admin/support/chat-interventions": "Chat Interventions",
  "/admin/support/claim-reviews": "Claim Reviews",
  "/admin/support/service-credits": "Service Credits",
  "/admin/support/payout-adjustments": "Payout Adjustments",
  "/admin/governance/broadcasts": "Broadcasts",
  "/admin/governance/cleaner-tags": "Cleaner Tags",
  "/admin/governance/availability-overrides": "Availability Overrides",
};

export const ADMIN_ROUTE_REQUIREMENTS: Record<string, PermissionRequirement[]> = {
  "/admin/overview": [
    { method: "GET", path: "/v1/admins/monitoring/overview" },
    { method: "GET", path: "/v1/admins/monitoring/auth/heatmap" },
    { method: "GET", path: "/v1/admins/monitoring/alerts" },
    { method: "GET", path: "/v1/admins/monitoring/alerts/sla" },
  ],
  "/admin/security/alerts": [{ method: "GET", path: "/v1/admins/monitoring/alerts" }],
  "/admin/security/sessions": [{ method: "GET", path: "/v1/admins/monitoring/sessions/anomalies" }],
  "/admin/security/audit": [{ method: "GET", path: "/v1/admins/monitoring/audit/history" }],
  "/admin/permissions/catalog": [
    { method: "GET", path: "/v1/admins/permissions/catalog" },
    { method: "GET", path: "/v1/admins/monitoring/permissions/denied-top" },
    { method: "GET", path: "/v1/admins/permission-templates/cleaner" },
    { method: "GET", path: "/v1/admins/permission-templates/customer" },
  ],
  "/admin/permissions/templates": [
    { method: "GET", path: "/v1/admins/permission-templates/cleaner" },
    { method: "GET", path: "/v1/admins/permission-templates/customer" },
    { method: "GET", path: "/v1/admins/permissions/catalog" },
    { method: "GET", path: "/v1/admins/permission-templates/cleaner/rollout-impact" },
    { method: "GET", path: "/v1/admins/permission-templates/customer/rollout-impact" },
  ],
  "/admin/onboarding/cleaners": [
    { method: "GET", path: "/v1/admins/onboarding/queue" },
    { method: "GET", path: "/v1/admins/cleaners/{cleaner_id}" },
  ],
  "/admin/institutions/employees": [
    { method: "GET", path: "/v1/admins/onboarding/queue" },
    { method: "GET", path: "/v1/admins/cleaners/{cleaner_id}" },
  ],
  "/admin/team": [{ method: "GET", path: "/v1/admins" }],
  "/admin/users": [
    { method: "GET", path: "/v1/admins/reports/users/summary" },
    { method: "GET", path: "/v1/admins/reports/users/signups-trend" },
    { method: "GET", path: "/v1/admins/cleaners" },
    { method: "GET", path: "/v1/admins/customers" },
  ],
  "/admin/access/requests": [{ method: "GET", path: "/v1/admins/access/requests" }],
  "/admin/operations/service-definitions": [{ method: "GET", path: "/v1/admins/service-definitions" }],
  "/admin/operations/add-ons": [{ method: "GET", path: "/v1/admins/add-ons" }],
  "/admin/operations/pricing-rules": [{ method: "GET", path: "/v1/admins/pricing-rules" }],
  "/admin/operations/service-areas": [{ method: "GET", path: "/v1/admins/service-areas" }],
  "/admin/operations/promo-codes": [{ method: "GET", path: "/v1/admins/promo-codes" }],
  "/admin/support/concierge-bookings": [{ method: "GET", path: "/v1/admins/concierge-bookings" }],
  "/admin/support/chat-interventions": [{ method: "GET", path: "/v1/admins/chat-interventions" }],
  "/admin/support/claim-reviews": [{ method: "GET", path: "/v1/admins/claim-reviews" }],
  "/admin/support/service-credits": [{ method: "GET", path: "/v1/admins/service-credits" }],
  "/admin/support/payout-adjustments": [{ method: "GET", path: "/v1/admins/payout-adjustments" }],
  "/admin/governance/broadcasts": [{ method: "GET", path: "/v1/admins/notifications/broadcasts" }],
  "/admin/governance/cleaner-tags": [{ method: "GET", path: "/v1/admins/cleaner-tags" }],
  "/admin/governance/availability-overrides": [{ method: "GET", path: "/v1/admins/availability-overrides" }],
};

export const ADMIN_PRIMARY_ROUTE_ORDER = [
  "/admin/overview",
  "/admin/security/alerts",
  "/admin/security/sessions",
  "/admin/security/audit",
  "/admin/users",
  "/admin/team",
  "/admin/onboarding/cleaners",
  "/admin/institutions/employees",
  "/admin/permissions/catalog",
  "/admin/permissions/templates",
  "/admin/operations/service-definitions",
  "/admin/operations/add-ons",
  "/admin/operations/pricing-rules",
  "/admin/operations/service-areas",
  "/admin/operations/promo-codes",
  "/admin/support/concierge-bookings",
  "/admin/support/chat-interventions",
  "/admin/support/claim-reviews",
  "/admin/support/service-credits",
  "/admin/support/payout-adjustments",
  "/admin/governance/broadcasts",
  "/admin/governance/cleaner-tags",
  "/admin/governance/availability-overrides",
] as const;

type ProfilePermissionEntry = {
  key?: string;
  path: string;
  methods: Set<string>;
};

/**
 * Strips the API mount prefix so a permission string and a requirement compare
 * segment-for-segment.
 *
 * Both `/api/v1/...` and `/v1/...` have to go: the backend's access presets
 * (`app/server/security/admin-presets.ts`) ship keys in the real wire format
 * `METHOD:/api/v1/admins/...`, while the requirements in this file are written
 * `/v1/admins/...`. Handling only `/v1` (the original behaviour) left every real
 * key two segments longer than the requirement it should have satisfied, so
 * `pathMatches` rejected it on length alone and nobody but an `isSuperAdmin` /
 * `"*"` holder passed any check.
 */
function normalizePath(path: string): string {
  const trimmed = path.trim().split("?")[0];
  if (!trimmed) return "/";
  const withLeadingSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  const withoutVersionPrefix = withLeadingSlash.replace(/^\/(?:api\/)?v\d+(?=\/|$)/, "");
  const clean = withoutVersionPrefix.replace(/\/+$/, "");
  return clean || "/";
}

function normalizeMethod(method: string): string {
  return method.trim().toUpperCase();
}

function splitPath(path: string): string[] {
  return normalizePath(path).split("/").filter(Boolean);
}

function isParamLike(segment: string): boolean {
  return (
    (segment.startsWith("{") && segment.endsWith("}")) ||
    segment.startsWith(":") ||
    segment === "*" ||
    segment === "**"
  );
}

function pathMatches(permissionPath: string, requiredPath: string): boolean {
  const perm = splitPath(permissionPath);
  const req = splitPath(requiredPath);

  if (perm.length !== req.length) return false;

  for (let i = 0; i < perm.length; i += 1) {
    if (isParamLike(perm[i]) || isParamLike(req[i])) continue;
    if (perm[i] !== req[i]) return false;
  }

  return true;
}

type RawPermissionEntry = string | { key?: string; path?: string; methods?: string[] };

function getRawPermissionEntries(profile?: AdminProfile | null): RawPermissionEntry[] {
  const container = profile?.permissionList;
  if (!container) return [];
  return Array.isArray(container) ? container : container.permissions || [];
}

function isWildcardPermissionEntry(entry: RawPermissionEntry): boolean {
  if (typeof entry === "string") return entry.trim() === "*";
  return entry.key?.trim() === "*" || entry.path?.trim() === "*";
}

/** Super admins and the wildcard `"*"` permission bypass every per-route/action check. */
function hasFullAccess(profile?: AdminProfile | null): boolean {
  if (!profile) return false;
  if (profile.isSuperAdmin === true) return true;
  return getRawPermissionEntries(profile).some(isWildcardPermissionEntry);
}

function getProfilePermissions(profile?: AdminProfile | null): ProfilePermissionEntry[] {
  const permissions = getRawPermissionEntries(profile);
  return permissions
    .map((permission) => {
      if (typeof permission === "string") {
        const [methodRaw, pathRaw] = permission.split(":", 2);
        const method = normalizeMethod(methodRaw || "");
        const path = normalizePath(pathRaw || "");
        if (!method || path === "/") return null;
        return {
          path,
          methods: new Set([method]),
        } satisfies ProfilePermissionEntry;
      }

      return {
        key: permission.key?.trim(),
        path: normalizePath(permission.path || ""),
        methods: new Set((permission.methods || []).map(normalizeMethod)),
      } satisfies ProfilePermissionEntry;
    })
    .filter((permission): permission is ProfilePermissionEntry => permission !== null)
    .filter((permission) => permission.path !== "/" && permission.methods.size > 0);
}

function hasPermissionRequirement(permissionEntries: ProfilePermissionEntry[], requirement: PermissionRequirement): boolean {
  const key = requirement.key?.trim();
  if (key && permissionEntries.some((entry) => entry.key === key)) {
    return true;
  }

  const method = normalizeMethod(requirement.method);
  const path = normalizePath(requirement.path);

  return permissionEntries.some((entry) => entry.methods.has(method) && pathMatches(entry.path, path));
}

export function canAccessAdminAction(requirement: PermissionRequirement, profile?: AdminProfile | null): boolean {
  if (hasFullAccess(profile)) return true;
  const permissionEntries = getProfilePermissions(profile);
  return hasPermissionRequirement(permissionEntries, requirement);
}

export function isAlwaysAllowedAdminRoute(pathname: string): boolean {
  return ALWAYS_ALLOWED_ADMIN_ROUTES.includes(normalizePath(pathname) as (typeof ALWAYS_ALLOWED_ADMIN_ROUTES)[number]);
}

export function canAccessAdminRoute(pathname: string, profile?: AdminProfile | null): boolean {
  const path = normalizePath(pathname);
  if (isAlwaysAllowedAdminRoute(path)) return true;
  if (hasFullAccess(profile)) return true;

  const requirements = ADMIN_ROUTE_REQUIREMENTS[path];
  if (!requirements || requirements.length === 0) return false;

  const permissionEntries = getProfilePermissions(profile);
  return requirements.every((requirement) => hasPermissionRequirement(permissionEntries, requirement));
}

export function getAllowedAdminRoutes(profile?: AdminProfile | null): Set<string> {
  const allowed = new Set<string>(ALWAYS_ALLOWED_ADMIN_ROUTES);
  const routePaths = Object.keys(ADMIN_ROUTE_REQUIREMENTS);

  for (const routePath of routePaths) {
    if (canAccessAdminRoute(routePath, profile)) {
      allowed.add(routePath);
    }
  }

  return allowed;
}

export function resolveFirstAllowedAdminRoute(profile?: AdminProfile | null): string {
  for (const routePath of ADMIN_PRIMARY_ROUTE_ORDER) {
    if (canAccessAdminRoute(routePath, profile)) {
      return routePath;
    }
  }
  return ACCESS_HUB_ROUTE;
}

export function getAdminRouteTitle(pathname: string): string {
  const path = normalizePath(pathname);
  return ROUTE_TITLES[path] || "Dashboard";
}
