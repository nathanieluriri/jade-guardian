import { expect, test, type Page, type Request, type Route } from "@playwright/test";

/**
 * The broadcast composer sends real notifications to every user on the
 * platform, so a send gate (`canSend` in `BroadcastPreview.tsx`) stops an
 * admin from sending before previewing who they'll reach. That gate has been
 * reworked twice and, until now, only ever verified in jsdom. This spec
 * proves it holds in a real browser: the send control must be genuinely
 * disabled (not just visually), and no POST to the broadcast endpoint must
 * ever escape while it's disabled.
 *
 * The auth preamble mirrors `e2e/admin-repaired-pages.spec.ts`. The route
 * `/admin/governance/broadcasts` is permission-gated (see
 * `src/lib/admin-access.ts` -> `ADMIN_ROUTE_REQUIREMENTS`) on:
 *   GET /v1/admins/notifications/broadcasts
 *
 * The composer also calls `GET /v1/admins/notifications/types` to populate
 * the type picker (a soft dependency — see `BroadcastComposer.tsx`), so that
 * is stubbed too, along with `POST /v1/admins/notifications/broadcasts/preview`
 * and `POST /v1/admins/notifications/broadcasts` (the send itself).
 */

const CHALLENGE_ID = "chal_e2e_broadcast";
const OTP_CODE = "123456";
const EMAIL = "admin@example.com";
const PASSWORD = "correct-horse-battery-staple";

const PROFILE = {
  id: "adm_e2e_broadcast",
  firstName: "Rae",
  lastName: "Admin",
  email: EMAIL,
  accountStatus: "ACTIVE",
  isSuperAdmin: false,
  accessPreset: null,
  mustChangePassword: false,
  totpEnabled: false,
  permissionList: ["GET:/v1/admins/notifications/broadcasts"],
};

const NOTIFICATION_TYPES = ["promo.broadcast", "system.alert"];

function envelope(data: unknown) {
  return { success: true, message: "ok", data, requestId: "req_e2e" };
}

function previewResponse(total: number, suppressedByOptOut: number) {
  return {
    audience: { type: "ALL" },
    total,
    customers: Math.floor(total * 0.6),
    cleaners: total - Math.floor(total * 0.6),
    reachableByPush: total - suppressedByOptOut,
    matchedBeforeOptOut: total,
    suppressedByOptOut,
  };
}

/**
 * Stubs the whole admin API surface, then lets per-test `page.route` calls
 * registered afterwards override specific paths (Playwright routes are
 * matched most-recently-registered first).
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

    if (path === "/api/v1/admins/notifications/types") {
      await route.fulfill({ json: envelope(NOTIFICATION_TYPES) });
      return;
    }

    if (path === "/api/v1/admins/notifications/broadcasts") {
      // GET (list) landing on the route guard, and the base path for POST
      // (send) unless a test overrides it below.
      await route.fulfill({ json: envelope({ items: [], nextCursor: null, pageSize: 20 }) });
      return;
    }

    // Well-formed empty envelope for everything else the shell reaches for.
    await route.fulfill({ json: envelope(null) });
  });
}

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

async function goToComposer(page: Page): Promise<void> {
  await page.goto("/admin/governance/broadcasts");
  await expect(page.getByLabel("Title", { exact: true })).toBeVisible();
}

async function fillTitleAndBody(page: Page): Promise<void> {
  await page.getByLabel("Title", { exact: true }).fill("Platform maintenance tonight");
  await page.getByLabel("Message", { exact: true }).fill("We'll be down for 30 minutes at 2am UTC.");
}

const sendButton = (page: Page) => page.getByRole("button", { name: /send broadcast/i });
const previewButton = (page: Page) => page.getByRole("button", { name: /preview audience/i });

test("send is disabled before previewing, and no send request ever escapes", async ({ page }) => {
  const sendRequests: Request[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/notifications/broadcasts") && request.method() === "POST") {
      sendRequests.push(request);
    }
  });

  await signIn(page);
  await goToComposer(page);

  await fillTitleAndBody(page);
  // Default audience is "Everyone" (ALL) — already selected, no extra fields required.
  await expect(page.getByLabel("Everyone", { exact: true })).toBeChecked();

  await expect(sendButton(page)).toBeDisabled();

  // Try to force it anyway: a disabled button ignores clicks in real browsers,
  // but assert on the network layer too, per the brief — the proof that
  // matters is that no request escaped, not that the attribute was set.
  await sendButton(page).click({ force: true }).catch(() => {});
  await page.waitForTimeout(300);

  expect(sendRequests).toHaveLength(0);
});

test("send enables after a successful preview, and the recipient count is visible", async ({ page }) => {
  await signIn(page);
  await page.route("**/api/v1/admins/notifications/broadcasts/preview**", (route) =>
    route.fulfill({ json: envelope(previewResponse(4200, 150)) }),
  );

  await goToComposer(page);
  await fillTitleAndBody(page);

  await expect(sendButton(page)).toBeDisabled();

  await previewButton(page).click();

  await expect(page.getByText(/Matched:/)).toBeVisible();
  await expect(sendButton(page)).toBeEnabled();
});

test("editing the audience after previewing disables send again (stale-count case)", async ({ page }) => {
  await signIn(page);
  await page.route("**/api/v1/admins/notifications/broadcasts/preview**", (route) =>
    route.fulfill({ json: envelope(previewResponse(4200, 150)) }),
  );

  await goToComposer(page);
  await fillTitleAndBody(page);

  await previewButton(page).click();
  await expect(page.getByText(/Matched:/)).toBeVisible();
  await expect(sendButton(page)).toBeEnabled();

  // A count taken for "Everyone" must never authorise a send to "All customers".
  await page.getByLabel("All customers", { exact: true }).check();

  await expect(sendButton(page)).toBeDisabled();
});

test("changing only the notification type after previewing disables send again", async ({ page }) => {
  await signIn(page);
  await page.route("**/api/v1/admins/notifications/broadcasts/preview**", (route) =>
    route.fulfill({ json: envelope(previewResponse(4200, 150)) }),
  );

  await goToComposer(page);
  await fillTitleAndBody(page);

  await previewButton(page).click();
  await expect(page.getByText(/Matched:/)).toBeVisible();
  await expect(sendButton(page)).toBeEnabled();

  // The backend computes opt-out suppression per type, so a type-only change
  // invalidates the preview's numbers just as much as an audience change.
  await page.getByLabel("Notification type").click();
  await page.getByRole("option", { name: "system.alert" }).click();

  await expect(sendButton(page)).toBeDisabled();
});
