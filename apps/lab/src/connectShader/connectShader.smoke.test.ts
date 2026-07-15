import { describe, expect, it } from "vitest";
import { CONNECT_SHADER_DEFAULTS } from "./config";
import { buildConnectGeometry, CONNECT_SHAPE_OPTIONS, sampleConnectSurface } from "./geometry";
import { CONNECT_CAMERA_DEFAULTS, normalizeConnectCameraState } from "./renderer";
import {
  CONNECT_SHADER_PRESET_ID,
  DEFAULT_SHADER_PRESET_ID,
  isConnectShaderPreset,
  NEBULA_SHADER_PRESET_ID,
  SHADER_LIBRARY,
} from "../shaderLibrary";

describe("connect shader smoke", () => {
  it("defaults to Connect with ten shapes", () => {
    expect(DEFAULT_SHADER_PRESET_ID).toBe(CONNECT_SHADER_PRESET_ID);
    expect(isConnectShaderPreset(DEFAULT_SHADER_PRESET_ID)).toBe(true);
    expect(SHADER_LIBRARY[0]?.id).toBe(CONNECT_SHADER_PRESET_ID);
    expect(SHADER_LIBRARY[1]?.id).toBe(NEBULA_SHADER_PRESET_ID);
    expect(CONNECT_SHAPE_OPTIONS).toHaveLength(10);
  });

  it("builds geometry for every shape", () => {
    for (const option of CONNECT_SHAPE_OPTIONS) {
      const geometry = buildConnectGeometry({
        ...CONNECT_SHADER_DEFAULTS,
        shapeType: option.value,
      });
      const position = geometry.getAttribute("position");
      expect(position).toBeTruthy();
      expect(position.count).toBeGreaterThan(10);
      geometry.dispose();
    }
  });

  it("arc-bends the spiral so the +Y tip swings toward +X (right/up banana)", () => {
    const params = {
      ...CONNECT_SHADER_DEFAULTS,
      shapeType: "spiral" as const,
      shapeBend: 90,
    };
    const mid = sampleConnectSurface(params, 0.5, 0.5);
    const tip = sampleConnectSurface(params, 0.5, 1);
    const straightTip = sampleConnectSurface({ ...params, shapeBend: 0 }, 0.5, 1);

    expect(tip.position.x).toBeGreaterThan(mid.position.x);
    expect(tip.position.x).toBeGreaterThan(straightTip.position.x);
    expect(tip.position.y).toBeGreaterThan(0);
  });

  it("normalizes camera state with Connect defaults", () => {
    expect(normalizeConnectCameraState(null)).toEqual(CONNECT_CAMERA_DEFAULTS);
    expect(
      normalizeConnectCameraState({
        distance: 200,
        rotateXDeg: 120,
        rotateYDeg: 540,
        rotateZDeg: 540,
        panX: 100,
        panY: -100,
        fov: 5,
      }),
    ).toEqual({
      distance: 120,
      rotateXDeg: 89,
      rotateYDeg: -180,
      rotateZDeg: -180,
      panX: 40,
      panY: -40,
      fov: 20,
    });
  });
});
