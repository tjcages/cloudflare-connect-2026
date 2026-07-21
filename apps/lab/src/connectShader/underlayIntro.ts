import { easeValue } from "../controls/easing";

export const UNDERLAY_INTRO_FADE_MS = 4000;

type WarpStyleLike = { staggerMs: number; speedMaxMs: number };
type RevealTypeLike = "wave" | "assembly" | "turbulence" | "glitch" | "vortex" | "water" | "custom";

type RevealLike = {
  enabled: boolean;
  type: RevealTypeLike;
  wave: { durationMs: number };
  assembly: WarpStyleLike;
  turbulence: WarpStyleLike;
  glitch: WarpStyleLike;
  vortex: WarpStyleLike;
  water: { durationMs: number; settleMs: number };
};

/** Match stripes-engine `resolveRevealDurationMs` — when progress reaches 1. */
export function resolveUnderlayIntroDelayMs(reveal: RevealLike): number {
  if (!reveal.enabled) return 0;
  if (reveal.type === "wave" || reveal.type === "custom") return reveal.wave.durationMs;
  if (reveal.type === "water") return reveal.water.durationMs + reveal.water.settleMs;
  const block = reveal.type === "assembly" ? reveal.assembly : reveal[reveal.type];
  return block.staggerMs + block.speedMaxMs;
}

export type UnderlayIntroController = {
  /** Hide, wait `delayMs`, then fade 0→1 over 4s easeOutExpo. */
  play: (el: HTMLElement | null, delayMs: number) => void;
  showImmediate: (el: HTMLElement | null) => void;
  hide: (el: HTMLElement | null) => void;
  cancel: () => void;
};

export function createUnderlayIntroController(): UnderlayIntroController {
  let raf = 0;
  let delayTimer = 0;
  let generation = 0;

  const setOpacity = (el: HTMLElement | null, opacity: number) => {
    if (!el) return;
    el.style.opacity = String(opacity);
  };

  const cancel = () => {
    generation += 1;
    if (raf) cancelAnimationFrame(raf);
    if (delayTimer) clearTimeout(delayTimer);
    raf = 0;
    delayTimer = 0;
  };

  const play = (el: HTMLElement | null, delayMs: number) => {
    cancel();
    const gen = generation;
    setOpacity(el, 0);
    if (!el) return;

    const startFade = () => {
      if (gen !== generation) return;
      const t0 = performance.now();
      const tick = (now: number) => {
        if (gen !== generation) return;
        const t = Math.min(1, (now - t0) / UNDERLAY_INTRO_FADE_MS);
        setOpacity(el, easeValue(t, "easeOutExpo"));
        if (t < 1) raf = requestAnimationFrame(tick);
        else raf = 0;
      };
      raf = requestAnimationFrame(tick);
    };

    const wait = Math.max(0, delayMs);
    if (wait <= 0) startFade();
    else delayTimer = setTimeout(startFade, wait) as unknown as number;
  };

  return {
    play,
    showImmediate: (el) => {
      cancel();
      setOpacity(el, 1);
    },
    hide: (el) => {
      cancel();
      setOpacity(el, 0);
    },
    cancel,
  };
}
