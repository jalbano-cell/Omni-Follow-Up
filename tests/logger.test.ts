import { describe, it, expect } from "vitest";
import { maskEmail, maskPhone } from "@/lib/logger";

describe("maskEmail", () => {
  it("keeps first char of local part and the full domain", () => {
    expect(maskEmail("jane.doe@acme.com")).toBe("j***@acme.com");
  });

  it("does not expand a single-char local part", () => {
    expect(maskEmail("a@acme.com")).toBe("a@acme.com");
  });

  it("passes through non-email input unchanged (nothing to leak)", () => {
    expect(maskEmail("")).toBe("");
    expect(maskEmail("not-an-email")).toBe("not-an-email");
  });
});

describe("maskPhone", () => {
  it("keeps only the last 4 digits", () => {
    expect(maskPhone("+1 (416) 555-1234")).toBe("***1234");
  });

  it("masks short numbers entirely", () => {
    expect(maskPhone("123")).toBe("***");
  });

  it("passes through empty input unchanged", () => {
    expect(maskPhone("")).toBe("");
  });
});
