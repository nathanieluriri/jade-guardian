import { describe, expect, it } from "vitest";
import {
  canAccessAdminAction,
  canAccessAdminRoute,
  getAdminRouteTitle,
  isAlwaysAllowedAdminRoute,
} from "@/lib/admin-access";
import type { AdminProfile } from "@/lib/api/types";

function buildProfile(overrides: Partial<AdminProfile> = {}): AdminProfile {
  return {
    id: "admin_1",
    accessPreset: null,
    mustChangePassword: false,
    totpEnabled: false,
    isSuperAdmin: false,
    ...overrides,
  };
}

describe("admin-access", () => {
  it("accepts a flat permissionList array of METHOD:/path keys", () => {
    const profile = buildProfile({
      permissionList: ["GET:/v1/admins/monitoring/alerts"],
    });

    expect(canAccessAdminRoute("/admin/security/alerts", profile)).toBe(true);
    expect(canAccessAdminAction({ method: "GET", path: "/v1/admins/monitoring/alerts" }, profile)).toBe(true);
  });

  it("accepts the nested permissionList.permissions container", () => {
    const profile = buildProfile({
      permissionList: {
        permissions: [{ path: "/v1/admins/monitoring/alerts", methods: ["GET"] }],
      },
    });

    expect(canAccessAdminRoute("/admin/security/alerts", profile)).toBe(true);
    expect(canAccessAdminAction({ method: "GET", path: "/v1/admins/monitoring/alerts" }, profile)).toBe(true);
  });

  it("grants everything to a super admin", () => {
    const profile = buildProfile({ isSuperAdmin: true, permissionList: [] });

    expect(canAccessAdminRoute("/admin/security/alerts", profile)).toBe(true);
    expect(canAccessAdminRoute("/admin/governance/broadcasts", profile)).toBe(true);
    expect(canAccessAdminAction({ method: "DELETE", path: "/v1/admins/anything" }, profile)).toBe(true);
  });

  it("grants everything when the list contains '*'", () => {
    const profile = buildProfile({ permissionList: ["*"] });

    expect(canAccessAdminRoute("/admin/security/alerts", profile)).toBe(true);
    expect(canAccessAdminAction({ method: "DELETE", path: "/v1/admins/anything" }, profile)).toBe(true);
  });

  it("denies a route whose requirement is absent", () => {
    const profile = buildProfile({ permissionList: ["GET:/v1/admins/monitoring/alerts"] });

    expect(canAccessAdminRoute("/admin/does-not-exist", profile)).toBe(false);
  });

  /**
   * The backend's access presets (`app/server/security/admin-presets.ts`) ship keys in
   * `METHOD:/api/v1/admins/...` form — the real wire format. `normalizePath` used to
   * strip only a leading `/v1`, so every real key had two extra leading segments and
   * could never path-match a `/v1/...` requirement: only `isSuperAdmin`/`"*"` holders
   * passed any check.
   */
  it("matches a preset-style /api/v1 permission key against a /v1 requirement", () => {
    const profile = buildProfile({
      permissionList: ["GET:/api/v1/admins/monitoring/alerts"],
    });

    expect(canAccessAdminRoute("/admin/security/alerts", profile)).toBe(true);
    expect(canAccessAdminAction({ method: "GET", path: "/v1/admins/monitoring/alerts" }, profile)).toBe(true);
  });

  it("matches a preset-style /api/v1 nested entry, including a `:param` segment", () => {
    const profile = buildProfile({
      permissionList: {
        permissions: [
          { path: "/api/v1/admins/onboarding/queue", methods: ["GET"] },
          { path: "/api/v1/admins/cleaners/:cleaner_id", methods: ["GET"] },
        ],
      },
    });

    expect(canAccessAdminRoute("/admin/onboarding/cleaners", profile)).toBe(true);
  });

  it("matches the admin-list key that the team route requires", () => {
    const profile = buildProfile({ permissionList: ["GET:/api/v1/admins"] });

    expect(canAccessAdminRoute("/admin/team", profile)).toBe(true);
  });

  it("keeps a genuinely unrelated /api/v1 key from matching", () => {
    const profile = buildProfile({ permissionList: ["GET:/api/v1/admins/monitoring/alerts"] });

    expect(canAccessAdminRoute("/admin/security/audit", profile)).toBe(false);
  });

  /** Security settings are self-service: every admin reaches them, permissions or not. */
  it("always allows the self-service security settings route", () => {
    const profile = buildProfile({ permissionList: [] });

    expect(isAlwaysAllowedAdminRoute("/admin/settings/security")).toBe(true);
    expect(canAccessAdminRoute("/admin/settings/security", profile)).toBe(true);
    expect(getAdminRouteTitle("/admin/settings/security")).toBe("Account Security");
  });
});
