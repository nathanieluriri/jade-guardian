import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const { mockToastSuccess, mockToastError, mockToastInfo } = vi.hoisted(() => ({
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
  mockToastInfo: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: mockToastSuccess, error: mockToastError, info: mockToastInfo, message: vi.fn() },
}));

import TeamPage from "@/features/admin/screens/TeamPage";
import { setAuthHint } from "@/lib/api/auth-storage";
import type { AdminProfile } from "@/lib/api/types";

const PROFILE_URL = "GET /api/v1/admins/profile";
const ADMINS_URL = "GET /api/v1/admins";
const PRESETS_URL = "GET /api/v1/admins/access-presets";
const INVITE_URL = "POST /api/v1/admins/invites";
const BULK_URL = "POST /api/v1/admins/access-presets/bulk";

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
 * Routes are keyed `"<METHOD> <pathname>"` — the query string is dropped so
 * `GET /api/v1/admins?limit=20&skip=0` matches a single `ADMINS_URL` stub while
 * still being assertable in full via `fetchMock.mock.calls`.
 */
function stubRoutes(routes: Record<string, StubbedResponse[]>) {
  const queues = new Map(Object.entries(routes).map(([key, responses]) => [key, [...responses]]));
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const key = `${(init?.method || "GET").toUpperCase()} ${url.split("?")[0]}`;
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

const PRESETS = [
  {
    key: "all_controls",
    label: "All controls",
    description: "Full super-admin access to every admin route.",
    permissionCount: 1,
  },
  {
    key: "support_only",
    label: "Support",
    description: "FAQ and customer conversations.",
    permissionCount: 12,
  },
  {
    key: "finance_only",
    label: "Finance",
    description: "Payments, service credits and financial reports.",
    permissionCount: 16,
  },
];

/** Shaped exactly like the backend's `AdminOut` — firstName/lastName, no full_name. */
const ADA: AdminProfile = {
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
  totpEnabled: true,
  dateCreated: 1_750_000_000,
  lastUpdated: 1_750_000_000,
};

const GRACE: AdminProfile = {
  id: "a2",
  firstName: "Grace",
  lastName: "Hopper",
  email: "grace@cleanm.io",
  accountStatus: "ACTIVE",
  isSuperAdmin: false,
  permissionList: ["GET:/api/v1/faq"],
  preferredLanguage: "en",
  accessPreset: "support_only",
  mustChangePassword: true,
  totpEnabled: false,
  dateCreated: 1_750_000_100,
  lastUpdated: 1_750_000_100,
};

const RESTRICTED_PROFILE: AdminProfile = {
  id: "a3",
  firstName: "Reed",
  lastName: "Onley",
  email: "reed@cleanm.io",
  accountStatus: "ACTIVE",
  isSuperAdmin: false,
  permissionList: ["GET:/v1/admins"],
  preferredLanguage: "en",
  accessPreset: "support_only",
  mustChangePassword: false,
  totpEnabled: true,
};

function baseRoutes(overrides: Record<string, StubbedResponse[]> = {}, profile: AdminProfile = ADA) {
  return {
    [PROFILE_URL]: [{ body: envelope(profile) }],
    [ADMINS_URL]: [{ body: envelope({ items: [ADA, GRACE], total: 2 }) }],
    [PRESETS_URL]: [{ body: envelope({ items: PRESETS }) }],
    ...overrides,
  };
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <TeamPage />
    </QueryClientProvider>
  );
}

/** Opens a Radix select by keyboard (jsdom has no real pointer events) and picks an option. */
async function chooseOption(trigger: HTMLElement, optionName: RegExp) {
  await act(async () => {
    fireEvent.keyDown(trigger, { key: "Enter" });
  });
  const option = await screen.findByRole("option", { name: optionName });
  await act(async () => {
    fireEvent.click(option);
  });
}

async function waitForRows() {
  await waitFor(() => expect(screen.getByText("Grace Hopper")).toBeInTheDocument());
}

describe("admin team page", () => {
  beforeAll(() => {
    // Radix's popper content measures itself through APIs jsdom doesn't implement.
    Element.prototype.scrollIntoView = vi.fn();
    Element.prototype.hasPointerCapture = vi.fn(() => false);
    Element.prototype.releasePointerCapture = vi.fn();
    if (typeof globalThis.IntersectionObserver === "undefined") {
      globalThis.IntersectionObserver = class {
        observe(): void {}
        unobserve(): void {}
        disconnect(): void {}
        takeRecords(): IntersectionObserverEntry[] {
          return [];
        }
        readonly root = null;
        readonly rootMargin = "";
        readonly thresholds: number[] = [];
      } as unknown as typeof IntersectionObserver;
    }
  });

  beforeEach(() => {
    window.localStorage.clear();
    setAuthHint();
    mockToastSuccess.mockClear();
    mockToastError.mockClear();
    mockToastInfo.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads real admins from GET /api/v1/admins and names them from firstName/lastName", async () => {
    const fetchMock = stubRoutes(baseRoutes());
    renderPage();
    await waitForRows();

    // Carry-forward bug (b): no trailing slash, limit/skip pagination params.
    const listCall = callsTo(fetchMock, ADMINS_URL)[0];
    expect(String(listCall[0])).toBe("/api/v1/admins?limit=20&skip=0");

    // Carry-forward bug (a): the name is derived from firstName/lastName, not
    // the email prefix, and the columns with no backing data are gone.
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.queryByText("ada")).not.toBeInTheDocument();
    expect(screen.queryByText("Email Verified")).not.toBeInTheDocument();
    expect(screen.queryByText("Last Auth")).not.toBeInTheDocument();
    expect(screen.queryByText("Never")).not.toBeInTheDocument();

    // The preset badge column reads from real `accessPreset` data.
    const graceRow = screen.getByText("Grace Hopper").closest("tr") as HTMLElement;
    expect(within(graceRow).getByText("Support")).toBeInTheDocument();
  });

  it("validates the invite form and posts fullName/email/accessPreset", async () => {
    const fetchMock = stubRoutes(
      baseRoutes({
        [INVITE_URL]: [{ body: envelope({ ...GRACE, id: "a9", email: "cleo@cleanm.io" }), status: 201 }],
      })
    );
    renderPage();
    await waitForRows();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Invite admin" }));
    });

    fireEvent.change(await screen.findByLabelText("Full name"), { target: { value: "Cleo Nash" } });
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "not-an-email" } });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Send invite" }));
    });

    expect(await screen.findByText("Enter a valid email address")).toBeInTheDocument();
    expect(callsTo(fetchMock, INVITE_URL)).toHaveLength(0);

    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "cleo@cleanm.io" } });
    await chooseOption(screen.getByRole("combobox", { name: "Access preset" }), /^Finance/);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Send invite" }));
    });

    await waitFor(() => expect(callsTo(fetchMock, INVITE_URL)).toHaveLength(1));
    expect(bodyOf(callsTo(fetchMock, INVITE_URL)[0])).toEqual({
      fullName: "Cleo Nash",
      email: "cleo@cleanm.io",
      accessPreset: "finance_only",
    });
    // The temp password is generated and emailed server-side, and dies in 72h.
    await waitFor(() => expect(mockToastSuccess).toHaveBeenCalled());
    expect(String(mockToastSuccess.mock.calls[0][0])).toMatch(/temporary password/i);
    expect(String(mockToastSuccess.mock.calls[0][0])).toMatch(/72 hours/i);
  });

  it("shows preset descriptions inside the invite picker", async () => {
    stubRoutes(baseRoutes());
    renderPage();
    await waitForRows();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Invite admin" }));
    });
    await act(async () => {
      fireEvent.keyDown(await screen.findByRole("combobox", { name: "Access preset" }), { key: "Enter" });
    });

    expect(await screen.findByText("FAQ and customer conversations.")).toBeInTheDocument();
    expect(screen.getByText("Payments, service credits and financial reports.")).toBeInTheDocument();
  });

  it("PATCHes {preset} to the right admin from the per-row picker", async () => {
    const fetchMock = stubRoutes(
      baseRoutes({
        "PATCH /api/v1/admins/a2/access-preset": [{ body: envelope({ ...GRACE, accessPreset: "finance_only" }) }],
      })
    );
    renderPage();
    await waitForRows();

    await chooseOption(
      screen.getByRole("combobox", { name: "Access preset for Grace Hopper" }),
      /^Finance/
    );

    const patchCalls = callsTo(fetchMock, "PATCH /api/v1/admins/a2/access-preset");
    await waitFor(() => expect(patchCalls).toHaveLength(1));
    expect(bodyOf(patchCalls[0])).toEqual({ preset: "finance_only" });
    await waitFor(() => expect(mockToastSuccess).toHaveBeenCalled());
  });

  it("bulk-assigns a preset and lists every skipped admin with its reason", async () => {
    const fetchMock = stubRoutes(
      baseRoutes({
        [BULK_URL]: [
          {
            body: envelope({
              updated: 1,
              skipped: [{ id: "a1", reason: "Cannot change the preset of the last admin with full access" }],
            }),
          },
        ],
      })
    );
    renderPage();
    await waitForRows();

    await act(async () => {
      fireEvent.click(screen.getByRole("checkbox", { name: "Select Ada Lovelace" }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("checkbox", { name: "Select Grace Hopper" }));
    });

    expect(screen.getByText("2 selected")).toBeInTheDocument();

    await chooseOption(
      screen.getByRole("combobox", { name: "Access preset for selected admins" }),
      /^Support/
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Change preset for 2 selected" }));
    });

    await waitFor(() => expect(callsTo(fetchMock, BULK_URL)).toHaveLength(1));
    expect(bodyOf(callsTo(fetchMock, BULK_URL)[0])).toEqual({
      adminIds: ["a1", "a2"],
      preset: "support_only",
    });

    expect(
      await screen.findByText(/Cannot change the preset of the last admin with full access/)
    ).toBeInTheDocument();
    expect(screen.getByText(/1 updated/)).toBeInTheDocument();
  });

  it("offers Resend invite only while an admin still must change their password", async () => {
    const fetchMock = stubRoutes(
      baseRoutes({
        "POST /api/v1/admins/invites/a2/resend": [{ body: envelope(GRACE) }],
      })
    );
    renderPage();
    await waitForRows();

    const resendButtons = screen.getAllByRole("button", { name: /^Resend invite/ });
    expect(resendButtons).toHaveLength(1);
    expect(resendButtons[0]).toHaveAccessibleName("Resend invite to Grace Hopper");

    await act(async () => {
      fireEvent.click(resendButtons[0]);
    });

    await waitFor(() =>
      expect(callsTo(fetchMock, "POST /api/v1/admins/invites/a2/resend")).toHaveLength(1)
    );
    await waitFor(() => expect(mockToastSuccess).toHaveBeenCalled());
  });

  it("hides every invite and preset control from an admin without invite permission", async () => {
    stubRoutes(baseRoutes({}, RESTRICTED_PROFILE));
    renderPage();
    await waitForRows();

    expect(screen.queryByRole("button", { name: "Invite admin" })).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "Select Grace Hopper" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("combobox", { name: "Access preset for Grace Hopper" })
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Resend invite/ })).not.toBeInTheDocument();

    // The read-only view still shows who is on which preset.
    expect(screen.getByText("Support")).toBeInTheDocument();
  });
});
