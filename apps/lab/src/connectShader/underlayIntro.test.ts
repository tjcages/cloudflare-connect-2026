import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { UNDERLAY_INTRO_FADE_MS, createUnderlayIntroController, resolveUnderlayIntroDelayMs } from "./underlayIntro";

const ALL_REVEAL_BLOCKS = {
  assembly: { staggerMs: 900, speedMaxMs: 1600 },
  turbulence: { staggerMs: 1400, speedMaxMs: 2600 },
  glitch: { staggerMs: 1200, speedMaxMs: 1400 },
  vortex: { staggerMs: 900, speedMaxMs: 1100 },
  water: { durationMs: 2600, settleMs: 900 },
};

describe("resolveUnderlayIntroDelayMs", () => {
  it("returns 0 when reveal is disabled", () => {
    expect(
      resolveUnderlayIntroDelayMs({
        enabled: false,
        type: "wave",
        wave: { durationMs: 1200 },
        ...ALL_REVEAL_BLOCKS,
      }),
    ).toBe(0);
  });

  it("uses wave.durationMs for wave reveals", () => {
    expect(
      resolveUnderlayIntroDelayMs({
        enabled: true,
        type: "wave",
        wave: { durationMs: 1200 },
        ...ALL_REVEAL_BLOCKS,
      }),
    ).toBe(1200);
  });

  it("uses the assembly block's stagger + speedMax for assembly reveals", () => {
    expect(
      resolveUnderlayIntroDelayMs({
        enabled: true,
        type: "assembly",
        wave: { durationMs: 1200 },
        ...ALL_REVEAL_BLOCKS,
      }),
    ).toBe(2500);
  });

  it("uses the active type's own block's stagger + speedMax for energy reveals", () => {
    expect(
      resolveUnderlayIntroDelayMs({
        enabled: true,
        type: "glitch",
        wave: { durationMs: 1200 },
        ...ALL_REVEAL_BLOCKS,
      }),
    ).toBe(2600);
    expect(
      resolveUnderlayIntroDelayMs({
        enabled: true,
        type: "turbulence",
        wave: { durationMs: 1200 },
        ...ALL_REVEAL_BLOCKS,
      }),
    ).toBe(4000);
  });

  it("uses water.durationMs + water.settleMs for water reveals", () => {
    expect(
      resolveUnderlayIntroDelayMs({
        enabled: true,
        type: "water",
        wave: { durationMs: 1200 },
        ...ALL_REVEAL_BLOCKS,
      }),
    ).toBe(3500);
  });
});

describe("createUnderlayIntroController", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function mockEl(): HTMLElement {
    return { style: { opacity: "" } } as HTMLElement;
  }

  it("keeps opacity at 0 during the reveal delay", () => {
    const el = mockEl();
    const intro = createUnderlayIntroController();
    intro.play(el, 1200);

    expect(el.style.opacity).toBe("0");
    vi.advanceTimersByTime(1199);
    expect(el.style.opacity).toBe("0");
    intro.cancel();
  });

  it("fades to 1 with easeOutExpo after delay when rAF is available", () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      frames.push(cb);
      return frames.length;
    });
    vi.stubGlobal("cancelAnimationFrame", () => {});

    const el = mockEl();
    const intro = createUnderlayIntroController();
    intro.play(el, 100);
    vi.advanceTimersByTime(100);

    expect(frames.length).toBe(1);
    const start = performance.now();
    frames[0]!(start);
    expect(Number(el.style.opacity)).toBe(0);

    frames[0]!(start + UNDERLAY_INTRO_FADE_MS);
    expect(Number(el.style.opacity)).toBeCloseTo(1, 5);

    intro.cancel();
    vi.unstubAllGlobals();
  });

  it("resets opacity when replayed", () => {
    const el = mockEl();
    const intro = createUnderlayIntroController();
    intro.showImmediate(el);
    expect(el.style.opacity).toBe("1");
    intro.play(el, 500);
    expect(el.style.opacity).toBe("0");
    intro.cancel();
  });
});
