import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ConfirmDialog, useConfirm } from "@/components/recipes/confirm-dialog";
import { ResponsiveModal } from "@/components/recipes/responsive-modal";

/**
 * `setup.ts` installs a `matchMedia` stub that always answers `false`, which is
 * exactly what the recipes must not be tested against — the whole point of
 * `ResponsiveModal` is that it reads the answer and re-reads it when it changes.
 * This replaces it with one whose answer is controllable and which actually
 * notifies its listeners, and restores the original afterwards.
 */
function installMatchMedia(initialMatches: boolean) {
  const original = window.matchMedia;
  const listeners = new Set<() => void>();
  let matches = initialMatches;

  window.matchMedia = ((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
    addListener: (listener: () => void) => listeners.add(listener),
    removeListener: (listener: () => void) => listeners.delete(listener),
    dispatchEvent: () => true,
  })) as unknown as typeof window.matchMedia;

  return {
    /** Crossing the breakpoint: flip the answer, then fire `change` like a real MQL. */
    async setMatches(next: boolean) {
      matches = next;
      await act(async () => {
        listeners.forEach((listener) => listener());
      });
    },
    restore() {
      window.matchMedia = original;
      listeners.clear();
    },
  };
}

function renderModal(props: Partial<React.ComponentProps<typeof ResponsiveModal>> = {}) {
  return render(
    <ResponsiveModal
      open
      onOpenChange={() => {}}
      title="Re-scope access"
      description="Replaces the admin's current preset."
      {...props}
    >
      <p>Modal body</p>
    </ResponsiveModal>
  );
}

function ConfirmHarness({
  onResult,
  tone = "default",
}: {
  onResult: (confirmed: boolean) => void;
  tone?: "default" | "destructive";
}) {
  const { confirm, confirmDialog } = useConfirm();
  return (
    <>
      <button
        type="button"
        onClick={() => {
          void confirm({
            title: "Disable two-factor authentication?",
            description: "Your backup codes are destroyed.",
            confirmLabel: "Disable 2FA",
            cancelLabel: "Keep it on",
            tone,
          }).then(onResult);
        }}
      >
        Ask
      </button>
      {confirmDialog}
    </>
  );
}

describe("ResponsiveModal", () => {
  let media: ReturnType<typeof installMatchMedia>;

  afterEach(() => {
    media?.restore();
  });

  it("renders a centred dialog at md and above", async () => {
    media = installMatchMedia(true);
    renderModal();

    const surface = await screen.findByRole("dialog");
    expect(surface).toHaveAttribute("data-variant", "dialog");
    expect(screen.getByText("Re-scope access")).toBeInTheDocument();
    expect(screen.getByText("Modal body")).toBeInTheDocument();
    // The drawer branch is not mounted alongside it.
    expect(document.querySelector('[data-variant="drawer"]')).toBeNull();
  });

  it("renders a bottom drawer below md", async () => {
    media = installMatchMedia(false);
    renderModal();

    await waitFor(() => expect(document.querySelector('[data-variant="drawer"]')).not.toBeNull());
    expect(document.querySelector('[data-variant="dialog"]')).toBeNull();
    expect(screen.getByText("Re-scope access")).toBeInTheDocument();
    expect(screen.getByText("Modal body")).toBeInTheDocument();
  });

  it("switches shape when the viewport crosses the breakpoint", async () => {
    media = installMatchMedia(false);
    renderModal();

    await waitFor(() => expect(document.querySelector('[data-variant="drawer"]')).not.toBeNull());

    await media.setMatches(true);
    await waitFor(() => expect(document.querySelector('[data-variant="dialog"]')).not.toBeNull());
    expect(document.querySelector('[data-variant="drawer"]')).toBeNull();

    await media.setMatches(false);
    await waitFor(() => expect(document.querySelector('[data-variant="drawer"]')).not.toBeNull());
    expect(document.querySelector('[data-variant="dialog"]')).toBeNull();
  });

  it("mounts nothing while closed", () => {
    media = installMatchMedia(true);
    renderModal({ open: false });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.querySelector('[data-variant="drawer"]')).toBeNull();
  });
});

describe("useConfirm", () => {
  let onResult: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onResult = vi.fn();
  });

  async function ask() {
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    });
    return screen.findByTestId("confirm-dialog");
  }

  it("resolves true when the action is taken", async () => {
    render(<ConfirmHarness onResult={onResult} />);
    await ask();

    expect(screen.getByText("Your backup codes are destroyed.")).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Disable 2FA" }));
    });

    await waitFor(() => expect(onResult).toHaveBeenCalledWith(true));
    // The dialog closes itself — the caller never has to unset any state.
    expect(screen.queryByTestId("confirm-dialog")).not.toBeInTheDocument();
  });

  it("resolves false when the admin cancels", async () => {
    render(<ConfirmHarness onResult={onResult} />);
    await ask();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Keep it on" }));
    });

    await waitFor(() => expect(onResult).toHaveBeenCalledWith(false));
    expect(screen.queryByTestId("confirm-dialog")).not.toBeInTheDocument();
  });

  it("resolves false when dismissed with Escape", async () => {
    render(<ConfirmHarness onResult={onResult} />);
    const dialog = await ask();

    await act(async () => {
      fireEvent.keyDown(dialog, { key: "Escape" });
    });

    await waitFor(() => expect(onResult).toHaveBeenCalledWith(false));
  });

  it("resolves false if the owning component unmounts while open", async () => {
    const { unmount } = render(<ConfirmHarness onResult={onResult} />);
    await ask();

    unmount();

    await waitFor(() => expect(onResult).toHaveBeenCalledWith(false));
  });

  it("marks the destructive tone so the action reads as dangerous", async () => {
    render(<ConfirmHarness onResult={onResult} tone="destructive" />);
    const dialog = await ask();

    expect(dialog).toHaveAttribute("data-tone", "destructive");
    expect(screen.getByRole("button", { name: "Disable 2FA" }).className).toContain(
      "bg-destructive"
    );
  });

  it("resolves exactly once per open", async () => {
    render(<ConfirmHarness onResult={onResult} />);
    await ask();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Disable 2FA" }));
    });

    await waitFor(() => expect(onResult).toHaveBeenCalledTimes(1));
  });
});

describe("ConfirmDialog", () => {
  it("reports the answer through onResolve without owning any state", async () => {
    const onResolve = vi.fn();
    render(
      <ConfirmDialog
        open
        onResolve={onResolve}
        title="Delete the thing?"
        description="The thing does not come back."
        confirmLabel="Delete"
        tone="destructive"
      />
    );

    await act(async () => {
      fireEvent.click(await screen.findByRole("button", { name: "Delete" }));
    });

    expect(onResolve).toHaveBeenCalledWith(true);
  });
});
