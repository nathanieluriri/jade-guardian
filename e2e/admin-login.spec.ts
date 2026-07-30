import { expect, test, type Page, type Request, type Route } from "@playwright/test";

/**
 * End-to-end smoke for the admin sign-in flow: credentials → OTP challenge →
 * 6-digit code → inside the console.
 *
 * Every `/api/**` call is stubbed with `page.route`, so this needs no backend
 * and no `API_ORIGIN`. What it does need is the real dev server, because the
 * thing under test is partly the *origin*: the client only ever fetches
 * relative `/api/...` paths so the Next rewrite keeps the session cookies
 * first-party (see `docs/ADMIN_FRONTEND_AUTH.md`). `page.route` intercepts in
 * front of that rewrite, which is why no proxy target is needed here.
 */

const CHALLENGE_ID = "chal_e2e_1";
const OTP_CODE = "123456";
const EMAIL = "admin@example.com";
const PASSWORD = "correct-horse-battery-staple";

/**
 * A freshly invited admin with no preset and no permissions. Deliberate: it
 * makes the landing route deterministic (`resolveFirstAllowedAdminRoute` finds
 * nothing in `ADMIN_PRIMARY_ROUTE_ORDER` and falls back to the always-allowed
 * Access Hub) and it keeps the destination screen free of its own data
 * dependencies — every permission-gated query on the shell and the page stays
 * `enabled: false`. Landing there still proves the whole auth chain ran:
 * cookies set, hint written, profile fetched, route guard satisfied, shell
 * rendered.
 */
const LIMITED_PROFILE = {
  id: "adm_e2e_1",
  firstName: "Ada",
  lastName: "Admin",
  email: EMAIL,
  accountStatus: "ACTIVE",
  isSuperAdmin: false,
  accessPreset: null,
  mustChangePassword: false,
  totpEnabled: false,
  permissionList: [] as string[],
};

const LANDING_ROUTE = "/admin/access";

function envelope(data: unknown) {
  return { success: true, message: "ok", data, requestId: "req_e2e" };
}

interface ApiCall {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

/**
 * Stubs the whole admin API surface and records what the client sent. The
 * recording is the point of half the assertions below: the transport contract
 * ("cookies, never a bearer token") is only observable from the request side.
 */
async function stubAdminApi(page: Page): Promise<ApiCall[]> {
  const calls: ApiCall[] = [];

  await page.route("**/api/**", async (route: Route, request: Request) => {
    let body: unknown = null;
    try {
      body = request.postDataJSON();
    } catch {
      body = request.postData();
    }
    calls.push({
      url: request.url(),
      method: request.method(),
      headers: await request.allHeaders(),
      body,
    });

    const path = new URL(request.url()).pathname;

    if (path === "/api/v1/admins/login") {
      await route.fulfill({
        json: envelope({ otpRequired: true, otpChallengeId: CHALLENGE_ID, method: "email" }),
      });
      return;
    }

    if (path === "/api/v1/admins/verify-otp") {
      // Mirrors the real backend: the session arrives as two httpOnly cookies
      // and the JSON body carries no tokens at all.
      await route.fulfill({
        headers: {
          "content-type": "application/json",
          "set-cookie": [
            "admin_access=e2e-access-token; Path=/; HttpOnly; SameSite=Lax",
            "admin_refresh=e2e-refresh-token; Path=/; HttpOnly; SameSite=Lax",
          ].join("\n"),
        },
        body: JSON.stringify(envelope({ admin: LIMITED_PROFILE, tokens: null })),
      });
      return;
    }

    if (path === "/api/v1/admins/profile") {
      await route.fulfill({ json: envelope(LIMITED_PROFILE) });
      return;
    }

    // Anything else this screen happens to reach for: a well-formed empty
    // envelope, never a 401 — a 401 would send the query cache's error handler
    // straight back to /admin/login and mask a real failure.
    await route.fulfill({ json: envelope(null) });
  });

  return calls;
}

test.describe("admin sign-in", () => {
  test("walks credentials → OTP → console and never handles a token itself", async ({ page }) => {
    const calls = await stubAdminApi(page);

    await page.goto("/admin/login");

    // --- credentials state ---
    await expect(page.getByRole("heading", { name: "Admin sign-in" })).toBeVisible();
    await expect(page.getByLabel("Verification code")).toHaveCount(0);

    await page.getByLabel("Email", { exact: true }).fill(EMAIL);
    // `exact` matters: the reveal toggle's accessible name is "Show password",
    // which a substring match would pick up alongside the field itself.
    await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();

    // --- OTP state ---
    await expect(page.getByRole("heading", { name: "Two-factor authentication" })).toBeVisible();
    // The address is named but masked — this screen is reachable by anyone.
    await expect(page.getByTestId("otp-method-copy")).toContainText("ad••n@example.com");
    await expect(page.getByTestId("otp-method-copy")).not.toContainText(EMAIL);

    const otpField = page.getByLabel("Verification code");
    await expect(otpField).toBeVisible();
    // `input-otp` keeps one real input under the six boxes; filling it is what
    // a paste or an SMS autofill does, and it auto-submits on the sixth digit.
    await otpField.fill(OTP_CODE);

    // --- inside the console ---
    await expect(page).toHaveURL(new RegExp(`${LANDING_ROUTE}$`));
    await expect(
      page.getByRole("heading", { name: "Your admin account has limited access" })
    ).toBeVisible();

    // --- the login request sequence ---
    const paths = calls.map((call) => new URL(call.url).pathname);
    expect(paths).toContain("/api/v1/admins/login");
    expect(paths).toContain("/api/v1/admins/verify-otp");
    expect(paths).toContain("/api/v1/admins/profile");

    const loginCall = calls.find((call) => call.url.endsWith("/api/v1/admins/login"));
    expect(loginCall?.body).toEqual({ email: EMAIL, password: PASSWORD });

    const verifyCall = calls.find((call) => call.url.endsWith("/api/v1/admins/verify-otp"));
    expect(verifyCall?.body).toEqual({ challengeId: CHALLENGE_ID, code: OTP_CODE });

    // --- transport contract ---
    // Same-origin relative paths only: anything absolute would break the
    // first-party cookie, which is the entire reason the rewrite exists.
    const baseOrigin = new URL(page.url()).origin;
    for (const call of calls) {
      expect(new URL(call.url).origin).toBe(baseOrigin);
      expect(call.headers).not.toHaveProperty("authorization");
    }

    // The session is cookies the page cannot read, plus a non-sensitive hint.
    const cookies = await page.context().cookies();
    const cookieNames = cookies.map((cookie) => cookie.name);
    expect(cookieNames).toContain("admin_access");
    expect(cookieNames).toContain("admin_refresh");
    for (const cookie of cookies.filter((c) => c.name.startsWith("admin_"))) {
      expect(cookie.httpOnly).toBe(true);
      expect(cookie.sameSite).toBe("Lax");
    }
    expect(await page.evaluate(() => document.cookie)).not.toContain("admin_access");

    const storage = await page.evaluate(() =>
      Object.fromEntries(
        Object.keys(window.localStorage).map((key) => [key, window.localStorage.getItem(key)])
      )
    );
    expect(storage["admin_auth_hint_v1"]).toBe("1");
    for (const [key, value] of Object.entries(storage)) {
      expect(key.toLowerCase()).not.toContain("token");
      expect(String(value)).not.toContain("e2e-access-token");
      expect(String(value)).not.toContain("e2e-refresh-token");
    }
  });

  test("holds the branded splash over a cold boot that already has a session", async ({ page }) => {
    await stubAdminApi(page);

    // Seed the tripwire the same way a completed login does, then boot cold:
    // `BootstrapGate` reads it in a layout effect and gates on the splash
    // before the first paint.
    await page.goto("/admin/login");
    await page.evaluate(() => window.localStorage.setItem("admin_auth_hint_v1", "1"));

    await page.goto(LANDING_ROUTE);

    const splash = page.getByRole("status");
    await expect(splash).toBeVisible();
    await expect(splash).toContainText("please wait");

    // ...and releases into the console once the profile settles.
    await expect(
      page.getByRole("heading", { name: "Your admin account has limited access" })
    ).toBeVisible();
    await expect(splash).toHaveCount(0);
  });

  test("bounces an unauthenticated visitor from a deep link to /admin/login", async ({ page }) => {
    await stubAdminApi(page);

    await page.goto("/admin/team");

    await expect(page).toHaveURL(/\/admin\/login$/);
    await expect(page.getByRole("heading", { name: "Admin sign-in" })).toBeVisible();
  });
});
