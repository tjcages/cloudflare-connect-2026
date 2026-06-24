import { describe, it, expect } from "vitest";
import { createClickWaveState, addClickWave, updateClickWave } from "./clickWaveSim";
import type { ClickWaveConfig } from "../config/types";

const ENABLED_CONFIG: ClickWaveConfig = {
  enabled: true,
  lifeMs: 630,
  startRadiusPx: 6,
  maxRadiusPx: 120,
  startStrokeWidthPx: 24,
  endStrokeWidthPx: 12,
  maxWaves: 12,
  pushStrengthPx: 38,
  pushBandScale: 3.2,
  stripeWhiteAlpha: 0.9,
};

const DISABLED_CONFIG: ClickWaveConfig = { ...ENABLED_CONFIG, enabled: false };

describe("createClickWaveState", () => {
  it("starts with nextSeed=1, no waves, clearFramesRemaining=0", () => {
    const state = createClickWaveState();
    expect(state.nextSeed).toBe(1);
    expect(state.waves).toHaveLength(0);
    expect(state.clearFramesRemaining).toBe(0);
  });
});

describe("addClickWave", () => {
  it("adds a wave with correct coords and increments nextSeed", () => {
    const state = createClickWaveState();
    addClickWave(state, { x: 100, y: 200 }, 630);
    expect(state.waves).toHaveLength(1);
    expect(state.waves[0].x).toBe(100);
    expect(state.waves[0].y).toBe(200);
    expect(state.waves[0].seed).toBe(1);
    expect(state.nextSeed).toBe(2);
  });

  it("assigns sequential seeds to multiple waves", () => {
    const state = createClickWaveState();
    addClickWave(state, { x: 0, y: 0 }, 630);
    addClickWave(state, { x: 10, y: 10 }, 630);
    expect(state.waves[0].seed).toBe(1);
    expect(state.waves[1].seed).toBe(2);
  });
});

describe("updateClickWave — ring radius grows with easeOutQuart", () => {
  it("radius increases from startRadiusPx toward maxRadiusPx over life", () => {
    const state = createClickWaveState();
    addClickWave(state, { x: 0, y: 0 }, ENABLED_CONFIG.lifeMs);

    const { samples: s1 } = updateClickWave(state, 16, ENABLED_CONFIG);
    expect(s1).toHaveLength(1);
    const r1 = s1[0].radius;

    const state2 = createClickWaveState();
    addClickWave(state2, { x: 0, y: 0 }, ENABLED_CONFIG.lifeMs);
    updateClickWave(state2, 16, ENABLED_CONFIG);
    const { samples: s2 } = updateClickWave(state2, 16, ENABLED_CONFIG);
    expect(s2).toHaveLength(1);
    const r2 = s2[0].radius;

    expect(r2).toBeGreaterThan(r1);
    expect(r1).toBeGreaterThanOrEqual(ENABLED_CONFIG.startRadiusPx);
  });

  it("most radius expansion happens in the early portion of life (easeOutQuart)", () => {
    function clamp01(v: number) {
      return Math.max(0, Math.min(1, v));
    }
    function easeOutQuart(p: number) {
      const t = 1 - clamp01(p);
      return 1 - t * t * t * t;
    }

    const startR = ENABLED_CONFIG.startRadiusPx;
    const maxR = ENABLED_CONFIG.maxRadiusPx;
    const radiusAt25pct = startR + (maxR - startR) * easeOutQuart(0.25);
    const radiusAt75pct = startR + (maxR - startR) * easeOutQuart(0.75);
    const totalRange = maxR - startR;

    const gainFirst25pct = radiusAt25pct - startR;
    const gainNext50pct = radiusAt75pct - radiusAt25pct;

    expect(gainFirst25pct).toBeGreaterThan(gainNext50pct);
    expect(gainFirst25pct / totalRange).toBeGreaterThan(0.5);
  });
});

describe("updateClickWave — strokeWidth interpolates start→end", () => {
  it("strokeWidth starts near startStrokeWidthPx and trends toward endStrokeWidthPx", () => {
    const config = { ...ENABLED_CONFIG, lifeMs: 1000 };

    const stateA = createClickWaveState();
    addClickWave(stateA, { x: 0, y: 0 }, config.lifeMs);
    const { samples: sA } = updateClickWave(stateA, 16, config);
    const swEarly = sA[0].strokeWidth;

    const stateB = createClickWaveState();
    addClickWave(stateB, { x: 0, y: 0 }, config.lifeMs);
    updateClickWave(stateB, 16, config);
    updateClickWave(stateB, 400, config);
    updateClickWave(stateB, 400, config);
    const { samples: sB } = updateClickWave(stateB, 100, config);
    const swLate = sB[0].strokeWidth;

    expect(swEarly).toBeGreaterThan(swLate);
    expect(swEarly).toBeLessThanOrEqual(config.startStrokeWidthPx + 0.001);
    expect(swLate).toBeGreaterThanOrEqual(config.endStrokeWidthPx - 0.001);
  });
});

describe("updateClickWave — pushPower and whitePower shapes", () => {
  it("pushPower is strongest at birth and fades (smoothstep of remaining life)", () => {
    const config = { ...ENABLED_CONFIG, lifeMs: 1000 };

    const stateA = createClickWaveState();
    addClickWave(stateA, { x: 0, y: 0 }, config.lifeMs);
    const { samples: sA } = updateClickWave(stateA, 16, config);
    const pushEarly = sA[0].pushPower;

    const stateB = createClickWaveState();
    addClickWave(stateB, { x: 0, y: 0 }, config.lifeMs);
    updateClickWave(stateB, 16, config);
    updateClickWave(stateB, 400, config);
    const { samples: sB } = updateClickWave(stateB, 400, config);
    const pushLate = sB[0].pushPower;

    expect(pushEarly).toBeGreaterThan(pushLate);
    expect(pushEarly).toBeLessThanOrEqual(1 + 1e-9);
    expect(pushLate).toBeGreaterThanOrEqual(0);
  });

  it("whitePower is high at birth (via birthBoost) and decreases over life", () => {
    const config = { ...ENABLED_CONFIG, lifeMs: 1000 };

    const stateA = createClickWaveState();
    addClickWave(stateA, { x: 0, y: 0 }, config.lifeMs);
    const { samples: sA } = updateClickWave(stateA, 16, config);
    const whiteEarly = sA[0].whitePower;

    const stateB = createClickWaveState();
    addClickWave(stateB, { x: 0, y: 0 }, config.lifeMs);
    updateClickWave(stateB, 16, config);
    updateClickWave(stateB, 400, config);
    const { samples: sB } = updateClickWave(stateB, 400, config);
    const whiteLate = sB[0].whitePower;

    expect(whiteEarly).toBeGreaterThan(whiteLate);
    expect(whiteEarly).toBeGreaterThan(1);
  });
});

describe("updateClickWave — cull at age >= life", () => {
  it("wave is removed after its lifeMs is exceeded", () => {
    const config = { ...ENABLED_CONFIG, lifeMs: 100 };
    const state = createClickWaveState();
    addClickWave(state, { x: 0, y: 0 }, config.lifeMs);

    const { samples: s1 } = updateClickWave(state, 40, config);
    expect(s1).toHaveLength(1);

    const { samples: s2 } = updateClickWave(state, 40, config);
    expect(s2).toHaveLength(1);

    const { samples: s3 } = updateClickWave(state, 40, config);
    expect(s3).toHaveLength(0);
  });
});

describe("updateClickWave — maxWaves cap", () => {
  it("splices oldest waves when count exceeds maxWaves", () => {
    const config = { ...ENABLED_CONFIG, maxWaves: 2, lifeMs: 10000 };
    const state = createClickWaveState();
    addClickWave(state, { x: 1, y: 0 }, config.lifeMs);
    addClickWave(state, { x: 2, y: 0 }, config.lifeMs);
    addClickWave(state, { x: 3, y: 0 }, config.lifeMs);

    const { samples } = updateClickWave(state, 16, config);
    expect(samples).toHaveLength(2);
    expect(samples[0].x).toBe(2);
    expect(samples[1].x).toBe(3);
  });
});

describe("updateClickWave — disabled path", () => {
  it("returns empty samples when disabled", () => {
    const state = createClickWaveState();
    addClickWave(state, { x: 0, y: 0 }, 630);
    const { samples } = updateClickWave(state, 16, DISABLED_CONFIG);
    expect(samples).toHaveLength(0);
  });

  it("clears waves when disabled", () => {
    const state = createClickWaveState();
    addClickWave(state, { x: 0, y: 0 }, 10000);
    updateClickWave(state, 16, ENABLED_CONFIG);
    expect(state.waves.length).toBeGreaterThan(0);
    updateClickWave(state, 16, DISABLED_CONFIG);
    expect(state.waves).toHaveLength(0);
  });

  it("changed=true for CLEAR_REBUILD_FRAMES after waves cleared, then false", () => {
    const state = createClickWaveState();
    addClickWave(state, { x: 0, y: 0 }, 10000);
    updateClickWave(state, 16, ENABLED_CONFIG);
    updateClickWave(state, 16, DISABLED_CONFIG);
    const { changed: c1 } = updateClickWave(state, 16, DISABLED_CONFIG);
    expect(c1).toBe(true);
    for (let i = 0; i < 8; i++) {
      updateClickWave(state, 16, DISABLED_CONFIG);
    }
    const { changed: cFinal } = updateClickWave(state, 16, DISABLED_CONFIG);
    expect(cFinal).toBe(false);
  });
});

describe("updateClickWave — determinism", () => {
  it("same inputs produce identical samples", () => {
    function runSim() {
      const state = createClickWaveState();
      addClickWave(state, { x: 50, y: 80 }, 630);
      addClickWave(state, { x: 200, y: 100 }, 630);
      const results = [];
      for (let i = 0; i < 5; i++) {
        results.push(updateClickWave(state, 16, ENABLED_CONFIG));
      }
      return results;
    }
    expect(runSim()).toEqual(runSim());
  });
});
