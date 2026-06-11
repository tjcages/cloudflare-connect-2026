import { describe, expect, it } from "vitest";
import { addClickWave, createClickWaveState, updateClickWave } from "./clickWave";
import { DEFAULT_PLAYGROUND_CLICK_WAVE_CONFIG } from "./playgroundClickWaveConfig";

function makeConfig(overrides: Partial<typeof DEFAULT_PLAYGROUND_CLICK_WAVE_CONFIG> = {}) {
  return { ...DEFAULT_PLAYGROUND_CLICK_WAVE_CONFIG, ...overrides };
}

describe("updateClickWave", () => {
  it("emits eased radius, interpolated stroke, and unitless powers", () => {
    const config = makeConfig({ lifeMs: 1000, startRadiusPx: 10, maxRadiusPx: 110, startStrokeWidthPx: 24, endStrokeWidthPx: 4 });
    const state = createClickWaveState();
    addClickWave(state, { x: 50, y: 60 }, config.lifeMs);

    const dt = 16;
    const { samples, changed } = updateClickWave(state, dt, config);
    expect(changed).toBe(true);
    expect(samples).toHaveLength(1);

    const progress = dt / config.lifeMs;
    const eased = 1 - (1 - progress) ** 4;
    const life = 1 - progress;
    const sample = samples[0]!;
    expect(sample.x).toBe(50);
    expect(sample.y).toBe(60);
    expect(sample.waveProgress).toBeCloseTo(progress, 8);
    expect(sample.radius).toBeCloseTo(10 + 100 * eased, 6);
    expect(sample.strokeWidth).toBeCloseTo(24 + (4 - 24) * progress, 6);
    expect(sample.pushPower).toBeCloseTo(life * life * (3 - 2 * life), 6);
    expect(sample.whitePower).toBeCloseTo(Math.pow(life, 0.62) * (1.35 - 0.35 * eased), 6);
  });

  it("trims the wave pool to maxWaves, oldest first", () => {
    const config = makeConfig({ maxWaves: 3 });
    const state = createClickWaveState();
    for (let i = 0; i < 6; i++) {
      addClickWave(state, { x: i, y: 0 }, config.lifeMs);
    }
    const { samples } = updateClickWave(state, 16, config);
    expect(samples).toHaveLength(3);
    expect(samples.map((s) => s.x)).toEqual([3, 4, 5]);
  });

  it("keeps reporting changed for ten clear frames after the last wave dies", () => {
    const config = makeConfig({ lifeMs: 100 });
    const state = createClickWaveState();
    addClickWave(state, { x: 0, y: 0 }, config.lifeMs);

    // Age the wave close to death while it is still alive (dt is clamped at 48ms per tick).
    updateClickWave(state, 48, config);
    updateClickWave(state, 48, config);

    let clearingFrames = 0;
    for (let i = 0; i < 20; i++) {
      const result = updateClickWave(state, 16, config);
      if (result.changed && result.samples.length === 0) {
        clearingFrames++;
      }
      if (!result.changed) {
        break;
      }
    }
    expect(state.waves).toHaveLength(0);
    expect(clearingFrames).toBe(10);
  });

  it("clears the pool and reports clearing frames when disabled", () => {
    const config = makeConfig();
    const state = createClickWaveState();
    addClickWave(state, { x: 0, y: 0 }, config.lifeMs);
    updateClickWave(state, 16, config);

    const disabled = makeConfig({ enabled: false });
    const first = updateClickWave(state, 16, disabled);
    expect(state.waves).toHaveLength(0);
    expect(first.samples).toHaveLength(0);
    expect(first.changed).toBe(true);

    let sawIdle = false;
    for (let i = 0; i < 12; i++) {
      if (!updateClickWave(state, 16, disabled).changed) {
        sawIdle = true;
      }
    }
    expect(sawIdle).toBe(true);
  });
});
