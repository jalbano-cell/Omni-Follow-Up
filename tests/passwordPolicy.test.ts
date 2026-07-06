import { describe, it, expect } from "vitest";
import { passwordProblem } from "@/lib/passwordPolicy";

describe("passwordProblem", () => {
  it("accepts a password meeting all rules", () => {
    expect(passwordProblem("correcthorse9")).toBeNull();
  });

  it("rejects short passwords", () => {
    expect(passwordProblem("short1")).toMatch(/10 characters/);
  });

  it("rejects letters-only passwords", () => {
    expect(passwordProblem("onlylettersnodigits")).toMatch(/letters and numbers/);
  });

  it("rejects numbers-only passwords", () => {
    expect(passwordProblem("1234567890123")).toMatch(/letters and numbers/);
  });

  it("rejects common passwords regardless of case", () => {
    expect(passwordProblem("Password123")).toMatch(/too common/);
  });
});
