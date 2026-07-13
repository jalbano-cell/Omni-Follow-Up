import { describe, it, expect } from "vitest";
import { safeParseClassification } from "@/services/leadClassification";

describe("safeParseClassification", () => {
  it("parses a clean JSON response", () => {
    const raw = '{"is_lead": true, "confidence": 0.9, "reason": "Asking for a quote", "intent": "new_work_request"}';
    expect(safeParseClassification(raw)).toEqual({
      is_lead: true,
      confidence: 0.9,
      reason: "Asking for a quote",
      intent: "new_work_request",
    });
  });

  it("strips markdown code fences", () => {
    const raw = '```json\n{"is_lead": false, "confidence": 0.2, "reason": "Invoice", "intent": "supplier_vendor"}\n```';
    expect(safeParseClassification(raw)?.is_lead).toBe(false);
  });

  it("strips stray text surrounding the JSON object", () => {
    const raw = 'Here is my answer:\n{"is_lead": true, "confidence": 0.7, "reason": "New job request", "intent": "existing_customer"}\nThanks!';
    expect(safeParseClassification(raw)?.intent).toBe("existing_customer");
  });

  it("returns null for malformed JSON", () => {
    expect(safeParseClassification('{"is_lead": true, "confidence":')).toBeNull();
  });

  it("returns null when no JSON object is present", () => {
    expect(safeParseClassification("I'm not sure how to classify this.")).toBeNull();
  });

  it("returns null when a required field is missing", () => {
    expect(safeParseClassification('{"is_lead": true, "confidence": 0.9}')).toBeNull();
  });

  it("returns null when confidence is out of range", () => {
    const raw = '{"is_lead": true, "confidence": 1.5, "reason": "x", "intent": "new_work_request"}';
    expect(safeParseClassification(raw)).toBeNull();
  });

  it("returns null when intent isn't one of the allowed values", () => {
    const raw = '{"is_lead": true, "confidence": 0.5, "reason": "x", "intent": "made_up_intent"}';
    expect(safeParseClassification(raw)).toBeNull();
  });

  it("returns null when is_lead isn't a boolean", () => {
    const raw = '{"is_lead": "yes", "confidence": 0.5, "reason": "x", "intent": "other"}';
    expect(safeParseClassification(raw)).toBeNull();
  });
});
