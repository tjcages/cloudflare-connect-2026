import { describe, expect, it } from "vitest";
import { SHADER_VIEW_DEFAULTS, normalizeShaderViewState, shaderViewToUniforms } from "./shaderView";

describe("shaderView", () => {
  it("keeps identity framing at defaults", () => {
    const uniforms = shaderViewToUniforms(SHADER_VIEW_DEFAULTS);
    expect(uniforms.zoom).toBeCloseTo(1, 5);
    expect(uniforms.orbitRad).toEqual([0, 0, 0]);
    expect(uniforms.pan).toEqual([0, 0]);
  });

  it("zooms out as distance increases", () => {
    const near = shaderViewToUniforms({ ...SHADER_VIEW_DEFAULTS, distance: 15 });
    const far = shaderViewToUniforms({ ...SHADER_VIEW_DEFAULTS, distance: 60 });
    expect(near.zoom).toBeGreaterThan(far.zoom);
  });

  it("maps rotate degrees to radians", () => {
    const uniforms = shaderViewToUniforms({
      ...SHADER_VIEW_DEFAULTS,
      rotateYDeg: 90,
      rotateXDeg: -45,
    });
    expect(uniforms.orbitRad[0]).toBeCloseTo(Math.PI / 2, 5);
    expect(uniforms.orbitRad[1]).toBeCloseTo(-Math.PI / 4, 5);
  });

  it("clamps extreme values", () => {
    const view = normalizeShaderViewState({
      distance: 999,
      rotateXDeg: 120,
      panX: 100,
      fov: 5,
    });
    expect(view.distance).toBe(120);
    expect(view.rotateXDeg).toBe(89);
    expect(view.panX).toBe(40);
    expect(view.fov).toBe(20);
  });
});
