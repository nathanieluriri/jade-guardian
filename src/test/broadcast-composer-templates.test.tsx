import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BroadcastComposer } from "@/features/admin/screens/governance/BroadcastComposer";
import type { AudiencePreviewOut } from "@/lib/api/broadcast-types";
import type { FeatureTemplate } from "@/lib/api/template-types";
import * as adminApi from "@/lib/api/admin-api";

const preview: AudiencePreviewOut = {
  audience: { type: "ALL" },
  total: 5000,
  customers: 3000,
  cleaners: 2000,
  reachableByPush: 4200,
  matchedBeforeOptOut: 4800,
  suppressedByOptOut: 600,
};

const types = ["promo.broadcast", "system.alert"];

const template: FeatureTemplate = {
  id: "t1",
  feature: "broadcasts",
  name: "Weekend sale",
  payload: {
    title: "Big weekend sale",
    body: "50% off everything this weekend only.",
    type: "system.alert",
    audience: { type: "ALL_CUSTOMERS" },
  },
};

function setup() {
  vi.spyOn(adminApi, "fetchNotificationTypes").mockResolvedValue(types);
  vi.spyOn(adminApi, "previewBroadcastAudience").mockResolvedValue(preview);
  vi.spyOn(adminApi, "listFeatureTemplates").mockResolvedValue([template]);
  vi.spyOn(adminApi, "createFeatureTemplate").mockResolvedValue(template);
}

async function fillMessage(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/title/i), "Big sale");
  await user.type(screen.getByLabelText(/body|message/i), "Everything is 50% off this weekend.");
}

async function doPreview(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /preview/i }));
  await waitFor(() =>
    expect(screen.getByRole("button", { name: /^send/i })).not.toBeDisabled(),
  );
}

describe("BroadcastComposer templates", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("applying a template fills title, body, type and audience", async () => {
    setup();
    const user = userEvent.setup();
    render(<BroadcastComposer />);
    await waitFor(() => expect(adminApi.fetchNotificationTypes).toHaveBeenCalled());

    await user.click(await screen.findByRole("button", { name: /weekend sale/i }));

    expect((screen.getByLabelText(/title/i) as HTMLInputElement).value).toBe(
      "Big weekend sale",
    );
    expect((screen.getByLabelText(/body|message/i) as HTMLTextAreaElement).value).toBe(
      "50% off everything this weekend only.",
    );
    expect(await screen.findByText("system.alert")).toBeInTheDocument();
    // Audience switched to ALL_CUSTOMERS -> "All customers" radio should be checked.
    expect(screen.getByLabelText(/all customers/i)).toBeChecked();
  });

  it("disables send after applying a template, even following a prior successful preview, until a new preview is taken", async () => {
    setup();
    const user = userEvent.setup();
    render(<BroadcastComposer />);
    await waitFor(() => expect(adminApi.fetchNotificationTypes).toHaveBeenCalled());

    // Take a legitimate preview first so send is enabled.
    await fillMessage(user);
    await doPreview(user);
    expect(screen.getByRole("button", { name: /^send/i })).not.toBeDisabled();

    // Now apply a template that swaps the audience/type/content.
    await user.click(await screen.findByRole("button", { name: /weekend sale/i }));

    // Send must be disabled again, even though a preview object still exists
    // in memory from before the template was applied.
    expect(screen.getByRole("button", { name: /^send/i })).toBeDisabled();

    // Stays disabled until a fresh preview is taken.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.getByRole("button", { name: /^send/i })).toBeDisabled();

    await doPreview(user);
    expect(screen.getByRole("button", { name: /^send/i })).not.toBeDisabled();
  });

  it("saving a template captures title, body, type and audience but not preview/recipient data", async () => {
    setup();
    const createSpy = vi.spyOn(adminApi, "createFeatureTemplate").mockResolvedValue(template);
    const user = userEvent.setup();
    render(<BroadcastComposer />);
    await waitFor(() => expect(adminApi.fetchNotificationTypes).toHaveBeenCalled());

    await fillMessage(user);
    await doPreview(user);

    await user.click(screen.getByRole("button", { name: /save as template/i }));
    await user.type(screen.getByLabelText(/name/i), "My template");
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => expect(createSpy).toHaveBeenCalledTimes(1));
    const call = createSpy.mock.calls[0][0];
    expect(call.feature).toBe("broadcasts");
    expect(call.payload).toEqual({
      title: "Big sale",
      body: "Everything is 50% off this weekend.",
      type: "promo.broadcast",
      audience: { type: "ALL" },
    });
    // Must not leak transient preview/recipient facts into the reusable template.
    const payloadKeys = Object.keys(call.payload);
    expect(payloadKeys).not.toContain("preview");
    expect(payloadKeys).not.toContain("total");
    expect(payloadKeys).not.toContain("recipientCount");
    expect(payloadKeys).not.toContain("reachableByPush");
  });
});
