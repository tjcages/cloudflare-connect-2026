import { describe, it, expect } from "vitest";
import { resolveSourceRect } from "./fit";

describe("resolveSourceRect", () => {
  it("stretch ignores aspect → full source", () => {
    expect(resolveSourceRect(100, 100, 200, 50, "stretch", 1, 0, 0)).toEqual({ u0: 0, v0: 0, u1: 1, v1: 1 });
  });
  it("cover crops the long axis to match dst aspect (square src, wide dst → crop vertically)", () => {
    const r = resolveSourceRect(100, 100, 200, 100, "cover", 1, 0, 0);
    expect(r.u0).toBeCloseTo(0);
    expect(r.u1).toBeCloseTo(1); // full width
    expect(r.v0).toBeCloseTo(0.25);
    expect(r.v1).toBeCloseTo(0.75); // cropped height
  });
  it("contain fits the whole source (square src, wide dst → letterbox in U)", () => {
    const r = resolveSourceRect(100, 100, 200, 100, "contain", 1, 0, 0);
    expect(r.v0).toBeCloseTo(0);
    expect(r.v1).toBeCloseTo(1); // full height
    expect(r.u0).toBeCloseTo(-0.5);
    expect(r.u1).toBeCloseTo(1.5); // source narrower than dst → UV overflows
  });
  it("zoom>1 tightens the rect about center", () => {
    const r = resolveSourceRect(100, 100, 100, 100, "stretch", 2, 0, 0);
    expect(r.u0).toBeCloseTo(0.25);
    expect(r.u1).toBeCloseTo(0.75);
  });
  it("pan shifts the rect", () => {
    const r = resolveSourceRect(100, 100, 100, 100, "stretch", 2, 1, 0);
    expect(r.u0).toBeCloseTo(0.5);
    expect(r.u1).toBeCloseTo(1.0); // panned +0.5 span
  });
});
