import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockReplace } = vi.hoisted(() => ({ mockReplace: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mockReplace,
    push: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/admin/login",
}));

import { AdminLoginForm } from "@/components/auth/AdminLoginForm";

const LOGIN_URL = "/api/v1/admins/login";
const VERIFY_URL = "/api/v1/admins/verify-otp";
const PROFILE_URL = "/api/v1/admins/profile";
const REFRESH_URL = "/api/v1/admins/refresh";

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

/**
 * Real error envelope shape — `{success, message, data, requestId}` with the
 * code nested at `data.code`, exactly as the backend sends it (see
 * `parseError` in `client.ts`).
 */
function errorEnvelope(message: string, code: string) {
  return { success: false, message, data: { code, details: null }, requestId: "req_test" };
}

/**
 * Routes `fetch` by URL instead of by call order: the login screen fires
 * login → verify-otp → profile and (on a 401) a refresh attempt in between,
 * so order-based mocks are brittle. The last queued response for a path
 * repeats for any further calls to it.
 */
function stubRoutes(routes: Record<string, StubbedResponse[]>) {
  const queues = new Map(Object.entries(routes).map(([path, responses]) => [path, [...responses]]));
  const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
    const path = String(input);
    const queue = queues.get(path);
    if (!queue || queue.length === 0) {
      throw new Error(`Unstubbed request: ${path}`);
    }
    const next = queue.length > 1 ? (queue.shift() as StubbedResponse) : queue[0];
    return jsonResponse(next.body, next.status ?? 200);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function bodyOf(call: [RequestInfo | URL, RequestInit?] | undefined) {
  return JSON.parse(String(call?.[1]?.body ?? "{}"));
}

const OTP_CHALLENGE: StubbedResponse = {
  body: envelope({ otpRequired: true, otpChallengeId: "chal_1", method: "email" }),
};
const OTP_CHALLENGE_TOTP: StubbedResponse = {
  body: envelope({ otpRequired: true, otpChallengeId: "chal_2", method: "totp" }),
};
const VERIFIED: StubbedResponse = { body: envelope({ admin: { id: "a1" }, tokens: null }) };
const SUPER_ADMIN_PROFILE: StubbedResponse = {
  body: envelope({
    id: "a1",
    email: "admin@example.com",
    accessPreset: null,
    mustChangePassword: false,
    totpEnabled: false,
    isSuperAdmin: true,
  }),
};

function renderLogin() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AdminLoginForm />
    </QueryClientProvider>
  );
}

async function submitCredentials(email = "admin@example.com") {
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: email } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "correct-horse-battery" } });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
  });
}

async function enterOtp(code: string) {
  await act(async () => {
    fireEvent.change(screen.getByLabelText("Verification code"), { target: { value: code } });
  });
}

describe("admin login screen", () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockReplace.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the credentials state with brand chrome and no OTP field", () => {
    stubRoutes({});
    renderLogin();

    expect(screen.getByRole("heading", { name: "Admin sign-in" })).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Verification code")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows the Google-style trust footer with the security line", () => {
    stubRoutes({});
    renderLogin();

    const footer = screen.getByTestId("auth-trust-footer");
    expect(footer).toHaveTextContent(/monitored and logged/i);
    expect(footer.querySelector("svg")).not.toBeNull();
  });

  it("toggles password visibility from the eye button", () => {
    stubRoutes({});
    renderLogin();

    const password = screen.getByLabelText("Password");
    expect(password).toHaveAttribute("type", "password");
    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(password).toHaveAttribute("type", "text");
    fireEvent.click(screen.getByRole("button", { name: "Hide password" }));
    expect(password).toHaveAttribute("type", "password");
  });

  it("moves to the OTP state and names the method with the masked email", async () => {
    stubRoutes({ [LOGIN_URL]: [OTP_CHALLENGE] });
    renderLogin();

    await submitCredentials("admin@example.com");

    expect(screen.getByRole("heading", { name: "Two-factor authentication" })).toBeInTheDocument();
    expect(screen.getByTestId("otp-method-copy")).toHaveTextContent(
      "We emailed a 6-digit code to ad••n@example.com"
    );
    expect(screen.getByTestId("otp-method-copy")).not.toHaveTextContent("admin@example.com");
    expect(screen.getByText(/spam folder/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Verification code")).toBeInTheDocument();
  });

  it("names the authenticator app instead of an email for the totp method", async () => {
    stubRoutes({ [LOGIN_URL]: [OTP_CHALLENGE_TOTP] });
    renderLogin();

    await submitCredentials();

    expect(screen.getByTestId("otp-method-copy")).toHaveTextContent(
      "Enter the code from your authenticator app"
    );
    expect(screen.queryByText(/spam folder/i)).not.toBeInTheDocument();
  });

  it("auto-submits once six digits are entered and lands on the resolved admin route", async () => {
    const fetchMock = stubRoutes({
      [LOGIN_URL]: [OTP_CHALLENGE],
      [VERIFY_URL]: [VERIFIED],
      [PROFILE_URL]: [SUPER_ADMIN_PROFILE],
    });
    renderLogin();

    await submitCredentials();
    await enterOtp("123456");

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/admin/overview"));

    const verifyCall = fetchMock.mock.calls.find((call) => call[0] === VERIFY_URL);
    expect(verifyCall).toBeDefined();
    expect(bodyOf(verifyCall)).toEqual({ challengeId: "chal_1", code: "123456" });
  });

  it("keeps the OTP state and shows the mapped copy on OTP_INVALID", async () => {
    stubRoutes({
      [LOGIN_URL]: [OTP_CHALLENGE],
      [VERIFY_URL]: [{ body: errorEnvelope("Invalid code", "OTP_INVALID"), status: 401 }],
    });
    renderLogin();

    await submitCredentials();
    await enterOtp("000000");

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("That code isn't right. Check and try again.")
    );
    expect(screen.getByRole("heading", { name: "Two-factor authentication" })).toBeInTheDocument();
    expect(screen.getByLabelText("Verification code")).toBeInTheDocument();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("returns to the credentials state with the lockout copy on OTP_LOCKED", async () => {
    stubRoutes({
      [LOGIN_URL]: [OTP_CHALLENGE],
      [VERIFY_URL]: [{ body: errorEnvelope("Locked out", "OTP_LOCKED"), status: 429 }],
    });
    renderLogin();

    await submitCredentials();
    await enterOtp("111111");

    await waitFor(() => expect(screen.getByRole("heading", { name: "Admin sign-in" })).toBeInTheDocument());
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Too many incorrect codes. Start again to get a new one."
    );
    expect(screen.queryByLabelText("Verification code")).not.toBeInTheDocument();
  });

  it("surfaces bad credentials in the role=alert pill", async () => {
    stubRoutes({
      [LOGIN_URL]: [{ body: errorEnvelope("Nope", "INVALID_CREDENTIALS"), status: 401 }],
      [REFRESH_URL]: [{ body: errorEnvelope("Nope", "INVALID_CREDENTIALS"), status: 401 }],
    });
    renderLogin();

    await submitCredentials();

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("That email and password don't match.")
    );
    expect(screen.getByRole("heading", { name: "Admin sign-in" })).toBeInTheDocument();
  });

  it("returns to the credentials state from the back link", async () => {
    stubRoutes({ [LOGIN_URL]: [OTP_CHALLENGE] });
    renderLogin();

    await submitCredentials();
    expect(screen.getByLabelText("Verification code")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /back to sign-in/i }));

    expect(screen.getByRole("heading", { name: "Admin sign-in" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Verification code")).not.toBeInTheDocument();
  });
});
