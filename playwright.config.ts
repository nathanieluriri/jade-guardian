import { defineConfig, devices } from "@playwright/test";

/**
 * The previous config re-exported `createLovableConfig` from
 * `lovable-agent-playwright-config`, a package that is not (and never was) in
 * `package.json` — so `npx playwright test` could not resolve its own config.
 * This is the plain equivalent, plus the piece the smoke test actually needs:
 * a `webServer` that boots `npm run dev`.
 *
 * The dev server matters for more than convenience. Every API call the admin
 * client makes is a *relative* `/api/...` path, proxied to the backend by the
 * Next rewrite in `next.config.mjs` so the session cookies stay first-party
 * (see `docs/ADMIN_FRONTEND_AUTH.md`). A test that opened `file://` or a
 * static export would not exercise that origin at all. The specs still stub
 * every `/api/**` call with `page.route`, so no backend — and no `API_ORIGIN` —
 * is required.
 */
const PORT = Number(process.env.PLAYWRIGHT_PORT ?? 3100);
// `localhost`, not `127.0.0.1`: `next dev` treats the two as different origins
// and warns about cross-origin `/_next/*` requests otherwise.
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "line" : "list",
  // `next dev` compiles routes on first request; the first navigation of a
  // cold run routinely takes longer than the 30s default.
  timeout: 90_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Playwright's own Chromium build is a separate `npx playwright install`
        // step. Set `PLAYWRIGHT_CHANNEL=chrome` (or `msedge`) to run against a
        // browser that is already on the machine instead of downloading one.
        channel: process.env.PLAYWRIGHT_CHANNEL,
      },
    },
  ],
  // Point PLAYWRIGHT_BASE_URL at an already-running server to skip this.
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: `npm run dev -- --port ${PORT}`,
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      },
});
