import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Every admin section needs its own loading boundary; without one, navigation falls
 * back to an ancestor and the section blocks longer than necessary before painting.
 */
const SECTIONS = [
  "access",
  "governance",
  "institutions",
  "onboarding",
  "operations",
  "overview",
  "permissions",
  "security",
  "settings",
  "support",
  "team",
  "users",
];

describe("admin route loading boundaries", () => {
  it.each(SECTIONS)("src/app/admin/%s has a loading.tsx", (section) => {
    expect(existsSync(resolve(__dirname, `../app/admin/${section}/loading.tsx`))).toBe(true);
  });
});
