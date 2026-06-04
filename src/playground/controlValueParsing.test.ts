import { describe, expect, it } from "vitest";
import {
  clampControlValue,
  isControlValueDraftInRange,
  parseControlValueDraft,
  resolveControlValueOnBlur,
} from "./controlValueParsing";

describe("controlValueParsing", () => {
  it("parses partial numeric drafts", () => {
    expect(parseControlValueDraft("")).toBeNull();
    expect(parseControlValueDraft("0.095")).toBe(0.095);
    expect(parseControlValueDraft("0.22")).toBe(0.22);
    expect(parseControlValueDraft("1.5")).toBe(1.5);
  });

  it("detects in-range drafts", () => {
    expect(isControlValueDraftInRange("0.095", 0.01, 0.5)).toBe(true);
    expect(isControlValueDraftInRange("-1", 0, 4)).toBe(false);
    expect(isControlValueDraftInRange("", 0, 4)).toBe(false);
  });

  it("clamps on blur and keeps committed value for empty drafts", () => {
    expect(resolveControlValueOnBlur("", 0.5, 0, 1)).toBe(0.5);
    expect(resolveControlValueOnBlur("-1", 0.5, 0, 4)).toBe(0);
    expect(resolveControlValueOnBlur("9", 0.5, 0, 4)).toBe(4);
  });

  it("clamps non-finite values to min", () => {
    expect(clampControlValue(Number.NaN, 0.01, 0.5)).toBe(0.01);
  });
});
