import { describe, expect, it } from "vitest";
import { buildStripeColors } from "./stripeColors";
import { applyTrailStripeIndices } from "./resolvePlaygroundDisplayStripeIndices";

describe("resolvePlaygroundDisplayStripeIndices", () => {
  it("lifts stripe band where cursor trail is active", () => {
    const _colors = buildStripeColors();
    const lut = new Uint8Array(256);
    for (let i = 128; i < 256; i++) {
      lut[i] = 3;
    }

    const baseIndices = new Uint8Array([0]);
    const luma = new Uint8Array([200]);
    const trailMap = {
      cols: 1,
      rows: 1,
      whiteAlpha: new Float32Array([0.9]),
      pushX: new Float32Array([0]),
      pushY: new Float32Array([0]),
      tear: new Float32Array([0]),
      color: new Uint8Array([0, 0, 0]),
      pushRange: 0,
      nonEmpty: true,
    };

    const out = applyTrailStripeIndices(baseIndices, luma, trailMap, lut, false);
    expect(out[0]).toBe(3);
  });
});
