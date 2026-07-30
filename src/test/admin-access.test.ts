import { describe, expect, it } from "vitest";
import { canAccessAdminAction, canAccessAdminRoute } from "@/lib/admin-access";
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
});
