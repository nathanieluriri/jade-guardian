import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockToastSuccess, mockToastError } = vi.hoisted(() => ({
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: mockToastSuccess, error: mockToastError, info: vi.fn(), message: vi.fn() },
}));

import { SecurityTab } from "@/components/settings/security-tab";
import { setAuthHint } from "@/lib/api/auth-storage";

const PROFILE_URL = "GET /api/v1/admins/profile";
const SETUP_URL = "POST /api/v1/admins/2fa/setup";
const VERIFY_URL = "POST /api/v1/admins/2fa/verify";
const DISABLE_URL = "DELETE /api/v1/admins/2fa";
const REGENERATE_URL = "POST /api/v1/admins/2fa/backup-codes/regenerate";
const REFRESH_URL = "POST /api/v1/admins/refresh";

type StubbedResponse = { body: unknown; status?: number };

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

function envelope(data: unknown) {
  return { success: true, message: "ok", data };
}

/** Real backend error shape: `{success, message, data: {code}}` — see `parseError` in client.ts. */
function errorEnvelope(message: string, code: string) {
  return { success: false, message, data: { code, details: null }, requestId: "req_test" };
}

/**
 * Routes `fetch` by `"<METHOD> <pathname>"`. The last queued response for a key
 * repeats, which also answers the api client's refresh-and-retry replay.
 */
function stubRoutes(routes: Record<string, StubbedResponse[]>) {
  const queues = new Map(Object.entries(routes).map(([key, responses]) => [key, [...responses]]));
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const key = `${(init?.method || "GET").toUpperCase()} ${String(input).split("?")[0]}`;
    const queue = queues.get(key);
    if (!queue || queue.length === 0) {
      throw new Error(`Unstubbed request: ${key}`);
    }
    const next = queue.length > 1 ? (queue.shift() as StubbedResponse) : queue[0];
    return jsonResponse(next.body, next.status ?? 200);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function callsTo(fetchMock: ReturnType<typeof stubRoutes>, key: string) {
  return fetchMock.mock.calls.filter((call) => {
    const init = call[1] as RequestInit | undefined;
    return `${(init?.method || "GET").toUpperCase()} ${String(call[0]).split("?")[0]}` === key;
  });
}

function bodyOf(call: unknown[] | undefined) {
  const init = call?.[1] as RequestInit | undefined;
  return JSON.parse(String(init?.body ?? "{}"));
}

const SETUP_DATA = {
  secret: "JBSWY3DPEHPK3PXP",
  otpauthUri: "otpauth://totp/Cleanm:ada@cleanm.io?secret=JBSWY3DPEHPK3PXP&issuer=Cleanm",
};

/** 8 codes, matching the backend's `BACKUP_CODE_COUNT` / 10-char base32 shape. */
const CODES_A = [
  "AAAAA11111",
  "BBBBB22222",
  "CCCCC33333",
  "DDDDD44444",
  "EEEEE55555",
  "FFFFF66666",
  "GGGGG77777",
  "HHHHH88888",
];

const CODES_B = [
  "PPPPP11111",
  "QQQQQ22222",
  "RRRRR33333",
  "SSSSS44444",
  "TTTTT55555",
  "UUUUU66666",
  "VVVVV77777",
  "WWWWW88888",
];

function profileResponse(totpEnabled: boolean): StubbedResponse {
  return {
    body: envelope({
      id: "a1",
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@cleanm.io",
      accountStatus: "ACTIVE",
      isSuperAdmin: true,
      permissionList: ["*"],
      preferredLanguage: "en",
      accessPreset: "all_controls",
      mustChangePassword: false,
      totpEnabled,
    }),
  };
}

function renderTab() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <SecurityTab />
    </QueryClientProvider>
  );
}

async function clickButton(name: string) {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name }));
  });
}

/** Walks a fresh enrollment as far as the verify step. */
async function reachVerifyStep() {
  await waitFor(() => expect(screen.getByText("Not enabled")).toBeInTheDocument());
  await clickButton("Enable two-factor authentication");
  await clickButton("Get started");
  await clickButton("Enter a code");
}

async function enterOtp(code: string) {
  await act(async () => {
    fireEvent.change(screen.getByLabelText("Verification code"), { target: { value: code } });
  });
}

describe("admin two-factor security settings", () => {
  beforeEach(() => {
    window.localStorage.clear();
    setAuthHint();
    mockToastSuccess.mockClear();
    mockToastError.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts setup then verify on a fresh enable and reveals all eight backup codes", async () => {
    const fetchMock = stubRoutes({
      [PROFILE_URL]: [profileResponse(false)],
      [SETUP_URL]: [{ body: envelope(SETUP_DATA) }],
      [VERIFY_URL]: [{ body: envelope({ backupCodes: CODES_A }) }],
    });
    renderTab();

    await waitFor(() => expect(screen.getByText("Not enabled")).toBeInTheDocument());
    await clickButton("Enable two-factor authentication");
    await clickButton("Get started");

    // Scan step: the no-QR-dependency path — selectable otpauth URI, a deep link,
    // and the manual base32 secret.
    expect(screen.getByText(SETUP_DATA.secret)).toBeInTheDocument();
    expect(screen.getByText(SETUP_DATA.otpauthUri)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /open in authenticator/i })).toHaveAttribute(
      "href",
      SETUP_DATA.otpauthUri
    );

    await clickButton("Enter a code");
    await enterOtp("123456");

    await waitFor(() => expect(screen.getByText(CODES_A[0])).toBeInTheDocument());
    for (const code of CODES_A) {
      expect(screen.getByText(code)).toBeInTheDocument();
    }

    expect(bodyOf(callsTo(fetchMock, SETUP_URL)[0])).toEqual({});
    expect(bodyOf(callsTo(fetchMock, VERIFY_URL)[0])).toEqual({ code: "123456" });
  });

  it("requires a current code before re-enrolling while TOTP is already enabled", async () => {
    const fetchMock = stubRoutes({
      [PROFILE_URL]: [profileResponse(true)],
      [SETUP_URL]: [{ body: envelope(SETUP_DATA) }],
    });
    renderTab();

    await waitFor(() => expect(screen.getByText("Enabled")).toBeInTheDocument());
    await clickButton("Replace authenticator app");

    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
    await clickButton("Continue");
    expect(callsTo(fetchMock, SETUP_URL)).toHaveLength(0);

    fireEvent.change(screen.getByLabelText("Current code"), { target: { value: "111222" } });
    await clickButton("Continue");

    await waitFor(() => expect(callsTo(fetchMock, SETUP_URL)).toHaveLength(1));
    expect(bodyOf(callsTo(fetchMock, SETUP_URL)[0])).toEqual({ code: "111222" });
    expect(screen.getByText(SETUP_DATA.secret)).toBeInTheDocument();
  });

  it("shows the mapped TOTP_INVALID copy and keeps the verify step", async () => {
    stubRoutes({
      [PROFILE_URL]: [profileResponse(false)],
      [SETUP_URL]: [{ body: envelope(SETUP_DATA) }],
      [VERIFY_URL]: [{ body: errorEnvelope("Invalid TOTP code", "TOTP_INVALID"), status: 401 }],
      [REFRESH_URL]: [{ body: envelope({}) }],
    });
    renderTab();

    await reachVerifyStep();
    await enterOtp("000000");

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "That code isn't right. Try again, or use a backup code."
      )
    );
    expect(screen.getByLabelText("Verification code")).toBeInTheDocument();
  });

  it("gates completion behind the saved-codes acknowledgement and then hides the codes", async () => {
    stubRoutes({
      [PROFILE_URL]: [profileResponse(false)],
      [SETUP_URL]: [{ body: envelope(SETUP_DATA) }],
      [VERIFY_URL]: [{ body: envelope({ backupCodes: CODES_A }) }],
    });
    renderTab();

    await reachVerifyStep();
    await enterOtp("123456");
    await waitFor(() => expect(screen.getByText(CODES_A[0])).toBeInTheDocument());

    expect(screen.getByRole("button", { name: "Finish setup" })).toBeDisabled();

    await act(async () => {
      fireEvent.click(screen.getByRole("checkbox", { name: "I have saved these codes" }));
    });
    expect(screen.getByRole("button", { name: "Finish setup" })).toBeEnabled();

    await clickButton("Finish setup");

    // One-time reveal: nothing may still be on screen after the step advances.
    expect(screen.queryByText(CODES_A[0])).not.toBeInTheDocument();
    expect(screen.queryByText(SETUP_DATA.secret)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Done" })).toBeInTheDocument();
  });

  it("refuses to dismiss the one-time reveal until the codes are acknowledged", async () => {
    stubRoutes({
      [PROFILE_URL]: [profileResponse(false)],
      [SETUP_URL]: [{ body: envelope(SETUP_DATA) }],
      [VERIFY_URL]: [{ body: envelope({ backupCodes: CODES_A }) }],
    });
    renderTab();

    await reachVerifyStep();
    await enterOtp("123456");
    await waitFor(() => expect(screen.getByText(CODES_A[0])).toBeInTheDocument());

    // TOTP is already enabled server-side by now and the codes cannot be re-issued,
    // so the dialog's own X must not throw them away.
    await clickButton("Close");
    expect(screen.getByText(CODES_A[0])).toBeInTheDocument();
    expect(mockToastError).toHaveBeenCalled();
  });

  it("posts the code when disabling and reflects the flipped profile", async () => {
    const fetchMock = stubRoutes({
      [PROFILE_URL]: [profileResponse(true), profileResponse(false)],
      [DISABLE_URL]: [{ body: envelope({}) }],
    });
    renderTab();

    await waitFor(() => expect(screen.getByText("Enabled")).toBeInTheDocument());
    await clickButton("Disable two-factor authentication");

    expect(screen.getByRole("button", { name: "Disable 2FA" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Current code"), { target: { value: "654321" } });
    await clickButton("Disable 2FA");

    await waitFor(() => expect(callsTo(fetchMock, DISABLE_URL)).toHaveLength(1));
    expect(bodyOf(callsTo(fetchMock, DISABLE_URL)[0])).toEqual({ code: "654321" });
    await waitFor(() => expect(screen.getByText("Not enabled")).toBeInTheDocument());
  });

  it("replaces the displayed set when backup codes are regenerated again", async () => {
    const fetchMock = stubRoutes({
      [PROFILE_URL]: [profileResponse(true)],
      [REGENERATE_URL]: [
        { body: envelope({ backupCodes: CODES_A }) },
        { body: envelope({ backupCodes: CODES_B }) },
      ],
    });
    renderTab();

    await waitFor(() => expect(screen.getByText("Enabled")).toBeInTheDocument());

    await clickButton("Regenerate backup codes");
    fireEvent.change(screen.getByLabelText("Current code"), { target: { value: "222333" } });
    await clickButton("Generate new codes");
    await waitFor(() => expect(screen.getByText(CODES_A[0])).toBeInTheDocument());

    await act(async () => {
      fireEvent.click(screen.getByRole("checkbox", { name: "I have saved these codes" }));
    });
    await clickButton("Done");
    expect(screen.queryByText(CODES_A[0])).not.toBeInTheDocument();

    await clickButton("Regenerate backup codes");
    fireEvent.change(screen.getByLabelText("Current code"), { target: { value: "444555" } });
    await clickButton("Generate new codes");

    await waitFor(() => expect(screen.getByText(CODES_B[0])).toBeInTheDocument());
    expect(screen.queryByText(CODES_A[0])).not.toBeInTheDocument();
    expect(bodyOf(callsTo(fetchMock, REGENERATE_URL)[1])).toEqual({ code: "444555" });
  });

  it("links to the change-password surface without exposing any secret", async () => {
    stubRoutes({ [PROFILE_URL]: [profileResponse(true)] });
    renderTab();

    await waitFor(() => expect(screen.getByText("Enabled")).toBeInTheDocument());

    expect(screen.getByRole("link", { name: "Change password" })).toHaveAttribute(
      "href",
      "/admin/change-password"
    );
    expect(screen.queryByText(SETUP_DATA.secret)).not.toBeInTheDocument();
  });
});
