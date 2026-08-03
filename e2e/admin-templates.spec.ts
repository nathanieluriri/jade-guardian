import { expect, test, type Page, type Request, type Route } from "@playwright/test";

/**
 * Feature templates let an admin save a composed broadcast (title/body/type/
 * audience) as a reusable starting point and re-apply it later. Applying a
 * template must populate the composer's fields but must never itself
 * authorise a send — `canSend` (see `BroadcastPreview.tsx`) only opens once a
 * fresh preview has been taken against the applied audience/type, so a
 * template-filled form must land in exactly the same "send disabled" state
 * as a manually-filled, unpreviewed one.
 *
 * This mirrors `e2e/admin-broadcast-composer.spec.ts`: same auth preamble,
 * same route-stubbing shape (a catch-all registered first, with per-test
 * `page.route` overrides registered afterwards so Playwright's
 * most-recently-registered-wins matching lets them take priority).
 */

const CHALLENGE_ID = "chal_e2e_templates";
const OTP_CODE = "123456";
const EMAIL = "admin@example.com";
const PASSWORD = "correct-horse-battery-staple";

const PROFILE = {
  id: "adm_e2e_templates",
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

const TEMPLATE_PAYLOAD = {
  title: "Scheduled maintenance",
  body: "The platform will be briefly unavailable overnight.",
  type: "system.alert",
  audience: { type: "ALL" },
};

const SAVED_TEMPLATE = {
  id: "tmpl_e2e_1",
  feature: "broadcasts",
  name: "Maintenance notice",
  payload: TEMPLATE_PAYLOAD,
  dateCreated: 1700000000000,
  lastUpdated: 1700000000000,
};

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

    if (path === "/api/v1/admins/notifications/broadcasts/preview") {
      await route.fulfill({
        json: envelope({
          audience: { type: "ALL" },
          total: 100,
          customers: 60,
          cleaners: 40,
          reachableByPush: 90,
          matchedBeforeOptOut: 100,
          suppressedByOptOut: 10,
        }),
      });
      return;
    }

    if (path === "/api/v1/admins/notifications/broadcasts") {
      // GET (list/route-guard) and POST (send) unless a test overrides it below.
      await route.fulfill({ json: envelope({ items: [], nextCursor: null, pageSize: 20 }) });
      return;
    }

    if (path === "/api/v1/admins/feature-templates") {
      if (request.method() === "GET") {
        await route.fulfill({ json: envelope({ items: [], total: 0 }) });
        return;
      }
      if (request.method() === "POST") {
        const body = request.postDataJSON();
        await route.fulfill({
          json: envelope({
            id: "tmpl_e2e_new",
            feature: body.feature,
            name: body.name,
            payload: body.payload,
            dateCreated: Date.now(),
            lastUpdated: Date.now(),
          }),
        });
        return;
      }
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

  await expect(page).not.toHaveURL(/\/admin\/login/);
}

async function goToComposer(page: Page): Promise<void> {
  await page.goto("/admin/governance/broadcasts");
  await expect(page.getByLabel("Title", { exact: true })).toBeVisible();
}

const sendButton = (page: Page) => page.getByRole("button", { name: /send broadcast/i });

test("saving a composed broadcast as a template posts feature, name, and payload", async ({
  page,
}) => {
  const saveRequests: Request[] = [];
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    if (path === "/api/v1/admins/feature-templates" && request.method() === "POST") {
      saveRequests.push(request);
    }
  });

  await signIn(page);
  await goToComposer(page);

  await page.getByLabel("Title", { exact: true }).fill("Platform maintenance tonight");
  await page.getByLabel("Message", { exact: true }).fill("We'll be down for 30 minutes at 2am UTC.");
  // Default audience "Everyone" (ALL) is already selected.
  await expect(page.getByLabel("Everyone", { exact: true })).toBeChecked();

  await page.getByRole("button", { name: "Save as template" }).click();
  await page.getByLabel("Name", { exact: true }).fill("Nightly maintenance");
  await page.getByRole("button", { name: "Save", exact: true }).click();

  await expect(page.getByText("Template saved.")).toBeVisible();

  expect(saveRequests).toHaveLength(1);
  const body = saveRequests[0].postDataJSON();
  expect(body.feature).toBe("broadcasts");
  expect(body.name).toBe("Nightly maintenance");
  expect(body.payload).toMatchObject({
    title: "Platform maintenance tonight",
    body: "We'll be down for 30 minutes at 2am UTC.",
    type: expect.any(String),
    audience: { type: "ALL" },
  });
});

test("applying a template populates fields but never authorises a send", async ({ page }) => {
  const sendRequests: Request[] = [];
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    if (path === "/api/v1/admins/notifications/broadcasts" && request.method() === "POST") {
      sendRequests.push(request);
    }
  });

  await signIn(page);

  // Override the templates list AFTER signIn's catch-all is registered, so
  // this route wins the most-recently-registered match.
  await page.route("**/api/v1/admins/feature-templates**", async (route: Route, request: Request) => {
    if (request.method() === "GET") {
      await route.fulfill({ json: envelope({ items: [SAVED_TEMPLATE], total: 1 }) });
      return;
    }
    await route.fulfill({ json: envelope(SAVED_TEMPLATE) });
  });

  await goToComposer(page);

  await page.getByRole("button", { name: "Maintenance notice" }).click();

  await expect(page.getByLabel("Title", { exact: true })).toHaveValue(TEMPLATE_PAYLOAD.title);
  await expect(page.getByLabel("Message", { exact: true })).toHaveValue(TEMPLATE_PAYLOAD.body);
  await expect(page.getByLabel("Everyone", { exact: true })).toBeChecked();

  await expect(sendButton(page)).toBeDisabled();

  await sendButton(page).click({ force: true }).catch(() => {});
  await page.waitForTimeout(300);

  expect(sendRequests).toHaveLength(0);
});
