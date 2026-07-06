import { describe, it, expect } from "vitest";
import { safeCompare } from "@/lib/timingSafe";

describe("safeCompare", () => {
  it("returns true for identical strings", () => {
    expect(safeCompare("s3cr3t-token", "s3cr3t-token")).toBe(true);
  });

  it("returns false for different strings of equal length", () => {
    expect(safeCompare("aaaaaa", "aaaaab")).toBe(false);
  });

  it("returns false for different lengths (no crash, no leak)", () => {
    expect(safeCompare("short", "a-much-longer-secret")).toBe(false);
  });

  it("returns false when either side is null/undefined/empty", () => {
    expect(safeCompare(null, "x")).toBe(false);
    expect(safeCompare("x", undefined)).toBe(false);
    expect(safeCompare("", "")).toBe(false);
    expect(safeCompare(null, null)).toBe(false);
  });

  it("handles unicode without throwing", () => {
    expect(safeCompare("tökén", "tökén")).toBe(true);
    expect(safeCompare("tökén", "token")).toBe(false);
  });
});
