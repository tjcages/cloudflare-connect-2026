import { ShapeGeometry } from "three";
import { describe, expect, it } from "vitest";
import {
  createPrintFaceGeometry,
  roundedRect,
  uvRange,
} from "./badge-card-geometry";

const CARD_W = 0.1;
const CARD_H = 0.158;
const CARD_R = 0.013;

describe("badge print face UVs", () => {
  it("maps the print across the full canvas, not the white corner", () => {
    const geometry = createPrintFaceGeometry(CARD_W, CARD_H, CARD_R);
    const range = uvRange(geometry);
    expect(range.minU).toBeCloseTo(0, 2);
    expect(range.maxU).toBeCloseTo(1, 2);
    expect(range.minV).toBeCloseTo(0, 2);
    expect(range.maxV).toBeCloseTo(1, 2);
    geometry.dispose();
  });

  it("stores shape meters as UVs unless they are remapped to 0–1", () => {
    const geometry = new ShapeGeometry(roundedRect(CARD_W, CARD_H, CARD_R), 12);
    const range = uvRange(geometry);
    expect(range.maxU - range.minU).toBeCloseTo(CARD_W, 2);
    expect(range.maxV - range.minV).toBeCloseTo(CARD_H, 2);
    geometry.dispose();
  });
});
