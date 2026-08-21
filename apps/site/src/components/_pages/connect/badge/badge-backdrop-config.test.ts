import { describe, expect, it } from "vitest";
import {
  BADGE_BACKDROP_CONFIG,
  BADGE_BACKDROP_GLSL,
  BADGE_BACKDROP_SHADER_SOURCE,
} from "./badge-backdrop-config";

describe("badge backdrop shader", () => {
  it("keeps the lab stripe field and Corridor source", () => {
    expect(BADGE_BACKDROP_CONFIG.stripes).toHaveLength(10);
    expect(BADGE_BACKDROP_CONFIG.reveal?.type).toBe("water");
    expect(BADGE_BACKDROP_CONFIG.cursorTrail?.enabled).toBe(false);
    expect(BADGE_BACKDROP_CONFIG.clickWave?.enabled).toBe(false);
    expect(BADGE_BACKDROP_CONFIG.maxFps).toBe(30);
    expect(BADGE_BACKDROP_CONFIG.grid?.angleDeg).toBe(45);
    expect(BADGE_BACKDROP_CONFIG.dark?.background).toEqual({
      transparent: true,
    });
    expect(BADGE_BACKDROP_GLSL).toContain("mainImage");
    expect(BADGE_BACKDROP_SHADER_SOURCE.width).toBe(1280);
    expect(BADGE_BACKDROP_SHADER_SOURCE.height).toBe(960);
  });
});
