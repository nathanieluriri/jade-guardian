import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The dotLottie player is only ever reached through a dynamic import (it must
 * never sit on the first-paint path) and it drives a wasm renderer jsdom can't
 * execute. Stub it with a marker that echoes its props back so the tests can
 * assert exactly what the splash asked the player to do.
 */
vi.mock("@lottiefiles/dotlottie-react", () => ({
  DotLottieReact: ({
    src,
    autoplay,
    loop,
  }: {
    src: string;
    autoplay?: boolean;
    loop?: boolean;
  }) => (
    <div
      data-testid="dotlottie"
      data-src={src}
      data-autoplay={String(autoplay === true)}
      data-loop={String(loop === true)}
    />
  ),
}));

import { BootstrapGate, MIN_VISIBLE_MS, SAFETY_TIMEOUT_MS } from "@/app/providers";
import { BrandedSplash } from "@/components/auth/branded-splash";
import { setAuthHint } from "@/lib/api/auth-storage";

const PROFILE_URL = "/api/v1/admins/profile";

function setPrefersReducedMotion(reduce: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: reduce && query.includes("prefers-reduced-motion"),
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }));
}

function stubProfile(mode: "resolves" | "never-resolves") {
  if (mode === "never-resolves") {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>(() => {}))
    );
    return;
  }

  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) !== PROFILE_URL) throw new Error(`Unstubbed request: ${String(input)}`);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          message: "ok",
          data: {
            id: "a1",
            email: "admin@example.com",
            accessPreset: null,
            mustChangePassword: false,
            totpEnabled: false,
            isSuperAdmin: true,
          },
        }),
      } as unknown as Response;
    })
  );
}

function renderGate() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <BootstrapGate>
        <div data-testid="console-children">Admin console</div>
      </BootstrapGate>
    </QueryClientProvider>
  );
}

/** Flush both the fake clock and any promises it unblocks. */
async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe("BrandedSplash", () => {
  beforeEach(() => {
    window.localStorage.clear();
    setPrefersReducedMotion(false);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("announces itself as a status region with an sr-only loading message", async () => {
    render(<BrandedSplash />);

    const status = screen.getByRole("status");
    expect(status).toBeInTheDocument();
    expect(status).toHaveTextContent("Loading the admin console, please wait.");

    // Settle the player import so the state update lands inside this test.
    await screen.findByTestId("dotlottie");
  });

  it("renders a rotating tip card", async () => {
    vi.useFakeTimers();
    render(<BrandedSplash />);

    expect(screen.getByText("Tip")).toBeInTheDocument();
    const firstTip = screen.getByTestId("splash-tip-title").textContent;
    expect(firstTip).toBeTruthy();

    await advance(6_000);

    expect(screen.getByTestId("splash-tip-title").textContent).not.toBe(firstTip);
  });

  it("shows the spinner fallback until the Lottie player has loaded, then plays the cleaning animation", async () => {
    render(<BrandedSplash />);

    // First paint never waits on the player bundle.
    expect(screen.getByTestId("lottie-fallback")).toBeInTheDocument();

    const player = await screen.findByTestId("dotlottie");
    expect(player).toHaveAttribute("data-src", "/marcus_loading_animations/Cleaning.lottie");
    expect(player).toHaveAttribute("data-autoplay", "true");
    expect(player).toHaveAttribute("data-loop", "true");
  });

  it("disables the animation under prefers-reduced-motion", async () => {
    setPrefersReducedMotion(true);
    vi.useFakeTimers();
    render(<BrandedSplash />);

    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("data-reduced-motion", "true");
    expect(status.querySelector(".branded-splash-wordmark")).toBeNull();
    expect(status.querySelector(".branded-splash-progress-bar")).toBeNull();

    const firstTip = screen.getByTestId("splash-tip-title").textContent;
    await advance(6_000 * 3);
    expect(screen.getByTestId("splash-tip-title").textContent).toBe(firstTip);

    const player = screen.getByTestId("dotlottie");
    expect(player).toHaveAttribute("data-autoplay", "false");
    expect(player).toHaveAttribute("data-loop", "false");
  });
});

describe("BootstrapGate", () => {
  beforeEach(() => {
    window.localStorage.clear();
    setPrefersReducedMotion(false);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("renders children immediately when the browser holds no auth hint", () => {
    stubProfile("resolves");
    renderGate();

    expect(screen.getByTestId("console-children")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("keeps the splash up for the minimum visible window even when the profile resolves instantly", async () => {
    setAuthHint();
    stubProfile("resolves");
    renderGate();

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByTestId("console-children")).not.toBeInTheDocument();

    await advance(MIN_VISIBLE_MS - 200);
    expect(screen.queryByTestId("console-children")).not.toBeInTheDocument();

    await advance(300);
    expect(screen.getByTestId("console-children")).toBeInTheDocument();
  });

  it("releases the splash after the safety timeout when the profile never resolves", async () => {
    setAuthHint();
    stubProfile("never-resolves");
    renderGate();

    expect(screen.getByRole("status")).toBeInTheDocument();

    await advance(SAFETY_TIMEOUT_MS - 1_000);
    expect(screen.queryByTestId("console-children")).not.toBeInTheDocument();

    await advance(1_100);
    expect(screen.getByTestId("console-children")).toBeInTheDocument();
  });
});
