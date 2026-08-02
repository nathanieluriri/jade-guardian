import { describe, expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  AudienceBuilder,
  validateAudience,
} from "@/features/admin/screens/governance/AudienceBuilder";
import type { BroadcastAudience } from "@/lib/api/broadcast-types";

describe("validateAudience", () => {
  it("ALL with no extra fields is valid", () => {
    expect(validateAudience({ type: "ALL" })).toBeNull();
  });

  it("USER_IDS with nothing else is invalid", () => {
    expect(validateAudience({ type: "USER_IDS" })).not.toBeNull();
  });

  it("USER_IDS with only userIds is still invalid (needs role)", () => {
    expect(
      validateAudience({ type: "USER_IDS", userIds: ["u1"] }),
    ).not.toBeNull();
  });

  it("USER_IDS with userIds and role is valid", () => {
    expect(
      validateAudience({ type: "USER_IDS", userIds: ["u1"], role: "customer" }),
    ).toBeNull();
  });

  it("CUSTOMERS_INACTIVE without inactiveDays is invalid", () => {
    expect(validateAudience({ type: "CUSTOMERS_INACTIVE" })).not.toBeNull();
  });

  it("CUSTOMERS_INACTIVE with inactiveDays 0 is invalid", () => {
    expect(
      validateAudience({ type: "CUSTOMERS_INACTIVE", inactiveDays: 0 }),
    ).not.toBeNull();
  });

  it("CUSTOMERS_INACTIVE with inactiveDays 3651 is invalid", () => {
    expect(
      validateAudience({ type: "CUSTOMERS_INACTIVE", inactiveDays: 3651 }),
    ).not.toBeNull();
  });

  it("CUSTOMERS_INACTIVE with inactiveDays 30 is valid", () => {
    expect(
      validateAudience({ type: "CUSTOMERS_INACTIVE", inactiveDays: 30 }),
    ).toBeNull();
  });

  it("CLEANERS_BY_ONBOARDING without onboardingStatus is invalid", () => {
    expect(
      validateAudience({ type: "CLEANERS_BY_ONBOARDING" }),
    ).not.toBeNull();
  });

  it("CLEANERS_BY_ONBOARDING with onboardingStatus is valid", () => {
    expect(
      validateAudience({
        type: "CLEANERS_BY_ONBOARDING",
        onboardingStatus: "APPROVED",
      }),
    ).toBeNull();
  });
});

describe("AudienceBuilder rendering", () => {
  it("shows no conditional inputs for ALL", () => {
    render(<AudienceBuilder value={{ type: "ALL" }} onChange={() => {}} />);
    expect(screen.queryByLabelText(/^inactive days$/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^onboarding status$/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^user ids$/i)).not.toBeInTheDocument();
  });

  it("reveals inactive-days input for CUSTOMERS_INACTIVE and clears it on switch away", () => {
    let value: BroadcastAudience = { type: "ALL" };
    const onChange = (next: BroadcastAudience) => {
      value = next;
    };
    const { rerender } = render(
      <AudienceBuilder value={value} onChange={onChange} />,
    );

    fireEvent.click(screen.getByRole("radio", { name: /inactive customers/i }));
    expect(value.type).toBe("CUSTOMERS_INACTIVE");
    rerender(<AudienceBuilder value={value} onChange={onChange} />);

    const inactiveInput = screen.getByLabelText(/^inactive days$/i);
    fireEvent.change(inactiveInput, { target: { value: "30" } });
    expect(value.inactiveDays).toBe(30);
    rerender(<AudienceBuilder value={value} onChange={onChange} />);

    expect(screen.queryByLabelText(/^onboarding status$/i)).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("radio", { name: /cleaners by onboarding/i }),
    );

    // Switching type must clear the stale inactiveDays field.
    expect(value.type).toBe("CLEANERS_BY_ONBOARDING");
    expect(value).not.toHaveProperty("inactiveDays");
    rerender(<AudienceBuilder value={value} onChange={onChange} />);

    expect(screen.queryByLabelText(/^inactive days$/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/^onboarding status$/i)).toBeInTheDocument();
  });
});
