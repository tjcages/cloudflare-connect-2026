import { CREST_TONES } from "@/components/_animations/container-stream/tones";
import { createFloat } from "@/components/_animations/shared/float/create-float";
import { createWireGlobe } from "@/components/_animations/shared/globe/create-wire-globe";
import {
  NUDGE_DURATION,
  nudgeHit,
} from "@/components/_animations/shared/nudge/nudge-hit";
import { clamp } from "@/components/_animations/shared/snake-pulse/math";
import type { CanvasVisualContext } from "@/components/_animations/canvas-visuals";
import type { Visual } from "@/components/_animations/section-visuals";
import { scrambleChars } from "@/components/scramble/chars";
import { between, pick } from "@/utils/random";
import { createChipTraffic } from "./chip-traffic";
import { type SandboxBar, shuffleSandbox } from "./sandbox-content";

const GLOBE_CENTER_DROP = 276;
const REST = 1.2;
const SWAP = 0.1;
const STEP = 0.035;
const WAVE = 6;
const LIT = 2;
const DIM = 0.2;
const FADE = 0.25;
const SCRAMBLE_MS = 450;
const NUDGE = -4;

type Phase = "rest" | "swap" | "settle" | "crest";

export function createContainersVisual({
  layer,
  root,
  cleanup,
}: CanvasVisualContext): Visual {
  const globe = createWireGlobe(root.clientWidth, root.clientHeight, {
    centerDrop: GLOBE_CENTER_DROP,
    stroke: "var(--color-border-default)",
  });
  layer.addChild(globe.container);
  cleanup(globe.destroy);

  const traffic = createChipTraffic(globe, root, root.clientWidth);
  layer.addChild(traffic.container);
  cleanup(traffic.destroy);

  const float = createFloat(root);

  const nudge = root.querySelector<HTMLElement>("[data-sandbox-nudge]");
  const digits = root.querySelector<HTMLElement>("[data-sandbox-number]");
  const loader = root.querySelector<HTMLElement>("[data-browser-loader]");

  let clock = 0;
  let phase: Phase = "rest";
  let phaseUntil = REST;
  let crestStart: number | null = null;
  let leftWritten = 0;
  let leftBars: SandboxBar[] = [];
  let rightBeats: SandboxBar[][] = [];
  let shown = digits?.textContent?.trim() ?? "";
  let stopScramble: (() => void) | null = null;
  let activeChip: HTMLElement | null = null;

  cleanup(() => stopScramble?.());

  const setLoader = (on: boolean) => {
    if (!loader) return;
    loader.style.width = on ? "" : "0px";
    loader.style.opacity = on ? "" : "0";
  };

  const settleBars = () => {
    for (const el of root.querySelectorAll<HTMLElement>("[data-sandbox-bar]")) {
      el.style.opacity = "";
      el.style.backgroundColor = "";
    }
  };

  const rollDigits = () => {
    if (!digits) return;
    let next = shown;
    while (next === shown) {
      next = `${between(1, 99)}`.padStart(2, "0");
    }
    stopScramble?.();
    const morphFrom = shown;
    shown = next;
    digits.textContent = next;
    stopScramble = scrambleChars(digits, "cipher", undefined, {
      duration: SCRAMBLE_MS,
      morphFrom,
    });
  };

  const markActive = () => {
    const chips = traffic.visibleChips();
    const pool =
      chips.length > 1 ? chips.filter((el) => el !== activeChip) : chips;
    activeChip?.removeAttribute("data-active-container");
    activeChip = pool.length > 0 ? pick(pool) : null;
    activeChip?.setAttribute("data-active-container", "");
  };

  const rest = () => {
    phase = "rest";
    phaseUntil = clock + REST;
  };

  setLoader(false);

  return {
    tick: (elapsed, dt) => {
      clock = elapsed;
      globe.advance(dt);
      traffic.tick(elapsed);
      float.tick(elapsed);

      if (crestStart !== null) {
        const head = (clock - crestStart) / STEP;
        const done = clamp(Math.floor(head - WAVE), 0, leftBars.length);
        for (; leftWritten < done; leftWritten++) {
          leftBars[leftWritten].el.style.opacity = "";
          leftBars[leftWritten].el.style.backgroundColor = "";
        }

        const live = clamp(Math.ceil(head), 0, leftBars.length);
        for (let i = leftWritten; i < live; i++) {
          const { el, tone } = leftBars[i];
          el.style.opacity = `${DIM + (1 - DIM) * clamp((head - i) / LIT, 0, 1)}`;
          if (!tone) continue;
          const env = Math.sin(Math.PI * clamp((head - i) / WAVE, 0, 1));
          el.style.backgroundColor = CREST_TONES[tone](env);
        }

        const rightSpan = Math.max((leftBars.length + WAVE) * STEP - FADE, 0);
        const rightGap =
          rightBeats.length > 1 ? rightSpan / (rightBeats.length - 1) : 0;
        for (let i = 0; i < rightBeats.length; i++) {
          const progress = clamp(
            (clock - crestStart - rightGap * i) / FADE,
            0,
            1
          );
          for (const { el } of rightBeats[i]) {
            el.style.opacity =
              progress >= 1 ? "" : `${DIM + (1 - DIM) * progress}`;
          }
        }

        if (head >= leftBars.length + WAVE) {
          settleBars();
          leftWritten = leftBars.length;
          crestStart = null;
          setLoader(false);
          rest();
        }
      }

      if (clock < phaseUntil) return;

      switch (phase) {
        case "rest": {
          if (nudge) nudgeHit(nudge, { axis: "y", amount: NUDGE });
          rollDigits();
          markActive();
          phase = "swap";
          phaseUntil = clock + SWAP;
          return;
        }
        case "swap": {
          const lanes = shuffleSandbox(root);
          leftBars = lanes.left;
          rightBeats = lanes.right;
          for (const { el } of [...leftBars, ...rightBeats.flat()]) {
            el.style.opacity = `${DIM}`;
          }
          setLoader(true);
          phase = "settle";
          phaseUntil = clock + NUDGE_DURATION - SWAP;
          return;
        }
        case "settle": {
          crestStart = clock;
          leftWritten = 0;
          phase = "crest";
          phaseUntil = Number.POSITIVE_INFINITY;
          return;
        }
        default:
          return;
      }
    },
    rebuild: () => {
      globe.resize(root.clientWidth, root.clientHeight);
      traffic.resize(root.clientWidth);
      activeChip?.removeAttribute("data-active-container");
      activeChip = null;
      stopScramble?.();
      stopScramble = null;
      settleBars();
      setLoader(false);
      crestStart = null;
      leftWritten = 0;
      leftBars = [];
      rightBeats = [];
      rest();
    },
  };
}
