import { describe, it, expect } from "vitest";
import { canApprove, canFlagOutcome } from "@/services/appointmentService";

describe("canApprove", () => {
  it("allows approving a requested appointment", () => {
    expect(canApprove({ status: "requested" })).toBe(true);
  });

  it("rejects approving anything else", () => {
    expect(canApprove({ status: "approved" })).toBe(false);
    expect(canApprove({ status: "completed" })).toBe(false);
    expect(canApprove({ status: "no_show" })).toBe(false);
    expect(canApprove({ status: "cancelled" })).toBe(false);
  });
});

describe("canFlagOutcome", () => {
  it("allows flagging no_show/cancelled only from approved", () => {
    expect(canFlagOutcome({ status: "approved" })).toBe(true);
  });

  it("rejects flagging from any other status", () => {
    expect(canFlagOutcome({ status: "requested" })).toBe(false);
    expect(canFlagOutcome({ status: "completed" })).toBe(false);
    expect(canFlagOutcome({ status: "no_show" })).toBe(false);
    expect(canFlagOutcome({ status: "cancelled" })).toBe(false);
  });
});
