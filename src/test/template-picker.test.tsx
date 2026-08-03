import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { FeatureTemplate } from "@/lib/api/template-types";

const listFeatureTemplates = vi.fn();
const createFeatureTemplate = vi.fn();

vi.mock("@/lib/api/admin-api", () => ({
  listFeatureTemplates: (...args: unknown[]) => listFeatureTemplates(...args),
  createFeatureTemplate: (...args: unknown[]) => createFeatureTemplate(...args),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { TemplatePicker, SaveAsTemplateButton } from "@/features/admin/templates/TemplatePicker";

function makeTemplate(overrides: Partial<FeatureTemplate> = {}): FeatureTemplate {
  return {
    id: "t1",
    feature: "promo-codes",
    name: "Spring Sale",
    description: undefined,
    payload: { code: "SPRING10" },
    dateCreated: null,
    lastUpdated: null,
    ...overrides,
  };
}

describe("TemplatePicker", () => {
  beforeEach(() => {
    listFeatureTemplates.mockReset();
    createFeatureTemplate.mockReset();
  });

  it("lists only templates whose feature matches the prop", async () => {
    listFeatureTemplates.mockResolvedValueOnce([
      makeTemplate({ id: "promo1", feature: "promo-codes", name: "Promo Template" }),
      makeTemplate({ id: "svc1", feature: "service-definitions", name: "Service Template" }),
    ]);

    render(<TemplatePicker feature="service-definitions" onApply={vi.fn()} />);

    await waitFor(() => expect(screen.getByText("Service Template")).toBeInTheDocument());
    expect(screen.queryByText("Promo Template")).not.toBeInTheDocument();
  });

  it("calls onApply with the picked template's payload", async () => {
    const onApply = vi.fn();
    listFeatureTemplates.mockResolvedValueOnce([
      makeTemplate({ id: "svc1", feature: "service-definitions", name: "Service Template", payload: { name: "Deep clean" } }),
    ]);

    render(<TemplatePicker feature="service-definitions" onApply={onApply} />);

    await waitFor(() => expect(screen.getByText("Service Template")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Service Template"));

    expect(onApply).toHaveBeenCalledWith({ name: "Deep clean" });
  });

  it("renders a clear empty state when there are no matching templates", async () => {
    listFeatureTemplates.mockResolvedValueOnce([
      makeTemplate({ id: "promo1", feature: "promo-codes", name: "Promo Template" }),
    ]);

    render(<TemplatePicker feature="service-definitions" onApply={vi.fn()} />);

    await waitFor(() => expect(listFeatureTemplates).toHaveBeenCalled());
    expect(await screen.findByText(/no templates/i)).toBeInTheDocument();
  });

  it("degrades honestly on a failed fetch — states the failure and does not silently drop the picker", async () => {
    listFeatureTemplates.mockRejectedValueOnce(new Error("network down"));

    render(<TemplatePicker feature="service-definitions" onApply={vi.fn()} />);

    expect(await screen.findByText(/failed to load templates/i)).toBeInTheDocument();
  });
});

describe("SaveAsTemplateButton", () => {
  beforeEach(() => {
    listFeatureTemplates.mockReset();
    createFeatureTemplate.mockReset();
  });

  it("requires a non-empty name before saving", async () => {
    render(<SaveAsTemplateButton feature="promo-codes" payload={{ code: "X" }} />);

    fireEvent.click(screen.getByRole("button", { name: /save as template/i }));

    const nameInput = await screen.findByLabelText(/name/i);
    const saveButton = screen.getByRole("button", { name: /^save$/i });
    fireEvent.click(saveButton);

    expect(await screen.findByText(/name is required/i)).toBeInTheDocument();
    expect(createFeatureTemplate).not.toHaveBeenCalled();

    fireEvent.change(nameInput, { target: { value: "My Template" } });
    fireEvent.click(saveButton);

    await waitFor(() => expect(createFeatureTemplate).toHaveBeenCalledWith({
      feature: "promo-codes",
      name: "My Template",
      payload: { code: "X" },
    }));
  });

  it("blocks a duplicate submit via a synchronous in-flight guard", async () => {
    let resolveCreate: (value: unknown) => void = () => {};
    createFeatureTemplate.mockImplementationOnce(
      () => new Promise((resolve) => { resolveCreate = resolve; }),
    );

    render(<SaveAsTemplateButton feature="promo-codes" payload={{ code: "X" }} />);

    fireEvent.click(screen.getByRole("button", { name: /save as template/i }));
    const nameInput = await screen.findByLabelText(/name/i);
    fireEvent.change(nameInput, { target: { value: "My Template" } });

    const saveButton = screen.getByRole("button", { name: /^save$/i });
    fireEvent.click(saveButton);
    fireEvent.click(saveButton);
    fireEvent.click(saveButton);

    expect(createFeatureTemplate).toHaveBeenCalledTimes(1);

    resolveCreate(makeTemplate({ id: "new1", name: "My Template" }));
    await waitFor(() => expect(screen.queryByLabelText(/name/i)).not.toBeInTheDocument());
  });
});
