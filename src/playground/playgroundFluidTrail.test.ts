import { describe, expect, it } from "vitest";
import {
  createPlaygroundFluidTrailInput,
  flattenPlaygroundFluidSplat,
  pushPlaygroundFluidPointer,
} from "./playgroundFluidTrail";
import {
  PLAYGROUND_FLUID_ADVECT_FRAGMENT,
  PLAYGROUND_FLUID_DIVERGENCE_FRAGMENT,
  PLAYGROUND_FLUID_GRADIENT_SUBTRACT_FRAGMENT,
  PLAYGROUND_FLUID_PRESSURE_FRAGMENT,
  PLAYGROUND_FLUID_PRESSURE_ITERATIONS,
  PLAYGROUND_FLUID_SPLAT_FRAGMENT,
  PLAYGROUND_FLUID_VORTICITY_FRAGMENT,
} from "./playgroundFluidTrailSimulation";
import { SOURCE_TEXTURE_FILTER_FRAGMENT } from "./sourceTextureFilter";

describe("playgroundFluidTrail input", () => {
  it("maps pointer movement to a clamped logical splat with velocity", () => {
    const input = createPlaygroundFluidTrailInput();

    pushPlaygroundFluidPointer(input, { x: 10, y: 20 }, { width: 100, height: 200 }, 1000);
    pushPlaygroundFluidPointer(input, { x: 50, y: 70 }, { width: 100, height: 200 }, 1016);

    expect(input.splat).toMatchObject({
      active: true,
      x: 0.5,
      y: 0.35,
      vx: 1,
      vy: 1,
    });
    expect(flattenPlaygroundFluidSplat(input)).toEqual([0.5, 0.35, 1, 1]);
  });

  it("clears the splat after a simulation step consumes it", () => {
    const input = createPlaygroundFluidTrailInput();

    pushPlaygroundFluidPointer(input, { x: 10, y: 20 }, { width: 100, height: 100 }, 1000);
    expect(input.splat.active).toBe(false);
    expect(flattenPlaygroundFluidSplat(input)).toEqual([0, 0, 0, 0]);

    pushPlaygroundFluidPointer(input, { x: 20, y: 30 }, { width: 100, height: 100 }, 1016);
    input.consumeSplat();

    expect(input.splat.active).toBe(false);
    expect(flattenPlaygroundFluidSplat(input)).toEqual([0, 0, 0, 0]);
  });
});

describe("SOURCE_TEXTURE_FILTER_FRAGMENT", () => {
  it("composites fluid trail and flames over the source texture before stripe rendering", () => {
    expect(SOURCE_TEXTURE_FILTER_FRAGMENT).toContain("uniform sampler2D uFluidTrail");
    expect(SOURCE_TEXTURE_FILTER_FRAGMENT).toContain("uniform sampler2D uFlames");
    expect(SOURCE_TEXTURE_FILTER_FRAGMENT).toContain("vec3 applyFluidTrail(vec3 color)");
    expect(SOURCE_TEXTURE_FILTER_FRAGMENT).toContain("vec3 applyFlames(vec3 color)");
    expect(SOURCE_TEXTURE_FILTER_FRAGMENT).toContain("texture(uFluidTrail, vDisplayCoord).rgb");
    expect(SOURCE_TEXTURE_FILTER_FRAGMENT).toContain(
      "finalColor = vec4(applyFlames(applyFluidTrail(clamp(adjustedColor, 0.0, 1.0))), sourceColor.a)",
    );
  });
});

describe("playgroundFluidTrail simulation shaders", () => {
  it("uses a velocity/dye solver rather than a single blurred dye pass", () => {
    expect(PLAYGROUND_FLUID_ADVECT_FRAGMENT).toContain("uniform sampler2D uVelocity");
    expect(PLAYGROUND_FLUID_ADVECT_FRAGMENT).toContain("decodeVelocity(texture(uVelocity, vTextureCoord))");
    expect(PLAYGROUND_FLUID_SPLAT_FRAGMENT).toContain("wake * clamp(speed * 2.4");
    expect(PLAYGROUND_FLUID_DIVERGENCE_FRAGMENT).toContain("right - left + top - bottom");
    expect(PLAYGROUND_FLUID_PRESSURE_FRAGMENT).toContain("left + right + bottom + top - divergence");
    expect(PLAYGROUND_FLUID_GRADIENT_SUBTRACT_FRAGMENT).toContain("velocity -= vec2(right - left, top - bottom)");
    expect(PLAYGROUND_FLUID_VORTICITY_FRAGMENT).toContain("uCurlStrength");
    expect(PLAYGROUND_FLUID_PRESSURE_ITERATIONS).toBeGreaterThanOrEqual(8);
  });
});
