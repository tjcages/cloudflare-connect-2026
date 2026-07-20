import { describe, expect, it } from "vitest";
import { applyImageColorDensity, effectiveStripes } from "./imageColorDensity";
import { normalizeEngineConfig } from "../config/normalize";
import { parseEngineConfig } from "../config/serialize";
import type { Stripe } from "../config/types";

const STRIPES: Stripe[] = [
  { color: 0x111111, startFrom: 0.1, width: 1, opacity: 1 },
  { color: 0x222222, startFrom: 0.4, width: 2, opacity: 1 },
  { color: 0x333333, startFrom: 0.7, width: 3, opacity: 1 },
  { color: 0x444444, startFrom: 0.9, width: 4, opacity: 1 },
];

describe("applyImageColorDensity", () => {
  it("is the identity at 0/0", () => {
    expect(applyImageColorDensity(STRIPES, 0, 0)).toEqual(STRIPES);
  });

  it("filters stripes below the removeThin cutoff", () => {
    const out = applyImageColorDensity(STRIPES, 0.5, 0);
    expect(out.map((s) => s.color)).toEqual([0x333333, 0x444444]);
  });

  it("keeps the thickest stripe when everything is filtered", () => {
    const out = applyImageColorDensity(STRIPES, 0.95, 0);
    expect(out).toHaveLength(1);
    expect(out[0].color).toBe(0x444444);
  });

  it("boosts widths of high-band stripes", () => {
    const out = applyImageColorDensity(STRIPES, 0, 1);
    const last = out[out.length - 1];
    expect(last.width).toBeGreaterThan(STRIPES[STRIPES.length - 1].width);
    expect(out[0].width).toBe(STRIPES[0].width);
  });
});

describe("effectiveStripes", () => {
  it("returns config stripes untouched in luminance mode", () => {
    const config = normalizeEngineConfig({
      stripes: STRIPES,
      colors: { mode: "luminance", imageColorRemoveThin: 0.5, imageColorBoostThick: 1 },
    });
    expect(effectiveStripes(config)).toEqual(config.stripes);
  });

  it("applies removeThin/boostThick in colors mode", () => {
    const config = normalizeEngineConfig({
      stripes: STRIPES,
      colors: { mode: "colors", imageColorRemoveThin: 0.5, imageColorBoostThick: 0 },
    });
    expect(effectiveStripes(config).map((s) => s.color)).toEqual([0x333333, 0x444444]);
  });
});

describe("colors density config fields", () => {
  it("defaults to 0/0 and clamps to range", () => {
    const dflt = normalizeEngineConfig({});
    expect(dflt.colors.imageColorRemoveThin).toBe(0);
    expect(dflt.colors.imageColorBoostThick).toBe(0);

    const clamped = normalizeEngineConfig({
      colors: { imageColorRemoveThin: 2, imageColorBoostThick: -1 },
    });
    expect(clamped.colors.imageColorRemoveThin).toBe(0.95);
    expect(clamped.colors.imageColorBoostThick).toBe(0);
  });

  it("round-trips through serialize/parse", () => {
    const config = normalizeEngineConfig({
      colors: { mode: "colors", imageColorRemoveThin: 0.3, imageColorBoostThick: 1.25 },
    });
    const parsed = parseEngineConfig(JSON.stringify(config));
    expect(parsed.colors.imageColorRemoveThin).toBe(0.3);
    expect(parsed.colors.imageColorBoostThick).toBe(1.25);
  });
});
