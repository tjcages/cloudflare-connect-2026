import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  BADGE_ACCENT_LIGHTS,
  BADGE_ANISOTROPY,
  BADGE_DPR_MAX,
  BADGE_ENV_INTENSITY,
  BADGE_PRINT_ROUGHNESS,
  BADGE_TONE_EXPOSURE,
} from "./badge-look";

describe("badge look", () => {
  it("uses a one-shot studio environment, not a post stack", () => {
    expect(BADGE_DPR_MAX).toBe(2);
    expect(BADGE_ANISOTROPY).toBe(8);
    expect(BADGE_ENV_INTENSITY).toBeGreaterThan(0.3);
    expect(BADGE_PRINT_ROUGHNESS).toBeLessThan(0.2);
    expect(BADGE_ACCENT_LIGHTS).toHaveLength(2);

    const source = readFileSync(
      resolve(process.cwd(), "src/components/_pages/connect/badge/badge-look.ts"),
      "utf8"
    );
    expect(source).toContain("RoomEnvironment");
    expect(source).toContain("ACESFilmicToneMapping");
    expect(source).toContain("PMREMGenerator");
    expect(source).not.toContain("EffectComposer");
    expect(source).not.toContain("Bloom");
    expect(source).not.toContain("SSAO");
    expect(source).not.toContain("N8AO");
  });
});
