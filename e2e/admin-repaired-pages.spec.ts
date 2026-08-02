import { expect, test, type Page, type Request, type Route } from "@playwright/test";

/**
 * Both pages below shipped broken. `/admin/security/sessions` white-screened on an
 * undefined field; `/admin/permissions/templates` dead-ended on a bare error string
 * with no retry and blanked the role that HAD loaded. Both failed only at runtime,
 * so they need a real browser to verify.
 *
 * The auth preamble mirrors `e2e/admin-login.spec.ts`: sign in, ride the OTP
 * challenge, land inside the console. Unlike that spec's `LIMITED_PROFILE` (empty
 * `permissionList`, used there deliberately for a deterministic landing route),
 * these two routes are permission-gated (see `src/lib/admin-access.ts` ->
 * `ADMIN_ROUTE_REQUIREMENTS`), so the fixture here grants exactly the GET
 * requirements each page's guard checks:
 *   - /admin/security/sessions      -> GET /v1/admins/monitoring/sessions/anomalies
 *   - /admin/permissions/templates  -> GET /v1/admins/permission-templates/cleaner
 *                                       GET /v1/admins/permission-templates/customer
 *                                       GET /v1/admins/permissions/catalog
 *                                       GET /v1/admins/permission-templates/cleaner/rollout-impact
 *                                       GET /v1/admins/permission-templates/customer/rollout-impact
 */

const CHALLENGE_ID = "chal_e2e_11";
const OTP_CODE = "123456";
const EMAIL = "admin@example.com";
const PASSWORD = "correct-horse-battery-staple";

const PROFILE = {
  id: "adm_e2e_11",
  firstName: "Rae",
  lastName: "Admin",
  email: EMAIL,
  accountStatus: "ACTIVE",
  isSuperAdmin: false,
  accessPreset: null,
  mustChangePassword: false,
  totpEnabled: false,
  permissionList: [
    "GET:/v1/admins/monitoring/sessions/anomalies",
    "GET:/v1/admins/permission-templates/cleaner",
    "GET:/v1/admins/permission-templates/customer",
    "GET:/v1/admins/permissions/catalog",
    "GET:/v1/admins/permission-templates/cleaner/rollout-impact",
    "GET:/v1/admins/permission-templates/customer/rollout-impact",
  ],
};

function envelope(data: unknown) {
  return { success: true, message: "ok", data, requestId: "req_e2e" };
}

/**
 * Stubs the whole admin API surface, exactly as `admin-login.spec.ts` does, then
 * lets per-test `page.route` calls registered afterwards override specific paths
 * (Playwright routes are matched most-recently-registered first).
 */
async function stubAdminApi(page: Page): Promise<void> {
  await page.route("**/api/**", async (route: Route, request: Request) => {
    const path = new URL(request.url()).pathname;

    if (path === "/api/v1/admins/login") {
      await route.fulfill({
        json: envelope({ otpRequired: true, otpChallengeId: CHALLENGE_ID, method: "email" }),
      });
      return;
    }

    if (path === "/api/v1/admins/verify-otp") {
      await route.fulfill({
        headers: {
          "content-type": "application/json",
          "set-cookie": [
            "admin_access=e2e-access-token; Path=/; HttpOnly; SameSite=Lax",
            "admin_refresh=e2e-refresh-token; Path=/; HttpOnly; SameSite=Lax",
          ].join("\n"),
        },
        body: JSON.stringify(envelope({ admin: PROFILE, tokens: null })),
      });
      return;
    }

    if (path === "/api/v1/admins/profile") {
      await route.fulfill({ json: envelope(PROFILE) });
      return;
    }

    // Well-formed empty envelope for everything else the shell reaches for
    // (catalog, alerts, rollout-impact, etc). Never a 401 here.
    await route.fulfill({ json: envelope(null) });
  });
}

/**
 * Signs in and rides the OTP challenge. The fixture's granted permissions make
 * `resolveFirstAllowedAdminRoute` land on `/admin/security/sessions` (the first
 * entry in `ADMIN_PRIMARY_ROUTE_ORDER` this profile satisfies) — this only
 * waits for *some* admin route to render, since each test navigates to its own
 * target page afterwards anyway.
 */
async function signIn(page: Page): Promise<void> {
  await stubAdminApi(page);

  await page.goto("/admin/login");
  await page.getByLabel("Email", { exact: true }).fill(EMAIL);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();

  const otpField = page.getByLabel("Verification code");
  await expect(otpField).toBeVisible();
  await otpField.fill(OTP_CODE);

  await expect(page).toHaveURL(/\/admin\//);
}

test("the sessions page renders without a client-side exception", async ({ page }) => {
  const pageErrors: Error[] = [];
  page.on("pageerror", (error) => pageErrors.push(error));

  await signIn(page);

  // The exact shape that used to crash it: the endpoint's `data` is a passthrough
  // object in the spec, so `active_sessions_by_admin` can simply be absent.
  await page.route("**/api/v1/admins/monitoring/sessions/anomalies", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, message: "ok", data: {}, requestId: "req_e2e" }),
    }),
  );

  await page.goto("/admin/security/sessions");

  await expect(page.getByRole("heading", { name: /session risk panel/i })).toBeVisible();
  await expect(page.getByText(/application error/i)).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});

test("one failing role template does not blank the healthy one", async ({ page }) => {
  await signIn(page);

  await page.route("**/api/v1/admins/permission-templates/cleaner*", (route) =>
    route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ success: false, message: "boom", data: null, requestId: "req_e2e" }),
    }),
  );
  await page.route("**/api/v1/admins/permission-templates/customer*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        message: "ok",
        data: { source: "template", permissionList: { permissions: [] } },
        requestId: "req_e2e",
      }),
    }),
  );

  await page.goto("/admin/permissions/templates");

  // The failing role shows its own error and retry; the healthy role still renders.
  await expect(page.getByTestId("role-template-error-cleaner")).toBeVisible();
  await expect(page.getByTestId("role-template-retry-cleaner")).toBeVisible();
  await expect(page.getByTestId("role-template-section-customer")).toBeVisible();
});
