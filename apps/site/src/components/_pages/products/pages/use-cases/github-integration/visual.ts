import { cubicBezier } from "motion";
import { chipEl, hitChip } from "@/components/_animations/shared/chips/dom";
import { measureChips } from "@/components/_animations/shared/chips/measure-chips";
import { createFloat } from "@/components/_animations/shared/float/create-float";
import { nudgeHit } from "@/components/_animations/shared/nudge/nudge-hit";
import { buildConnector } from "@/components/_animations/shared/snake-pulse/build-connector";
import { createBullet } from "@/components/_animations/shared/snake-pulse/bullet";
import type { Anchor } from "@/components/_animations/shared/snake-pulse/geometry";
import type { PulseThrow } from "@/components/_animations/shared/snake-pulse/pulse-throw";
import type { ThrowableSnake } from "@/components/_animations/shared/snake-pulse/snake";
import type { SnakeVisualContext } from "@/components/_animations/shared/snake-pulse/backend";
import type { Visual } from "@/components/_animations/section-visuals";
import { resolveZoom } from "@/utils/zoom";
import {
  createBrowserContent,
  type BrowserContent,
} from "@/components/browser/archetypes";

const WAVE = 2;
const WAVE_DELAY = 0.1;
// The reveal reads late against the impact, so it opens already this far in.
const WAVE_LEAD = 0.05;
const WAVE_SCALE_MAX = 60;
const FEATHER_RAMP = 0.06;
const DEEP = 14;
const LEAD = 0.8;
const GAP = 0.35;
const REST = 1.5;

const RING_STOPS: [number, number][] = [
  [-15, 0],
  [-10, 26],
  [-5, 72],
  [0, 100],
  [5, 72],
  [10, 26],
  [15, 0],
];
const WAVE_ALPHA = 0.04;
const RING_CAP = 0.5;
const RING_HOLD = 0.45;
const REVEAL_SPLIT = 0.1;
const GROW_SPAN = 0.37;
const RING_COLOR = "var(--color-darker)";
const MASK_FEATHER = 28;
const WAVE_EASE = cubicBezier(0.3, 0.2, 0.7, 0.8);

type Conn = { snake: ThrowableSnake; throw: PulseThrow; dwell: number };
type Shot = { conn: Conn; startT: number };
type Phase = "lead" | "hop-a" | "gap" | "hop-b" | "rest";

export function createGithubVisual({
  makeSnake,
  root,
  cleanup,
}: SnakeVisualContext): Visual {
  const stage = root.querySelector<HTMLElement>("[data-browser-stage]");
  const nudge = root.querySelector<HTMLElement>("[data-browser-nudge]");
  const browser = root.querySelector<HTMLElement>("[data-browser]");
  const waveEl = root.querySelector<HTMLElement>("[data-browser-wave]");
  const float = createFloat(root);
  const content: BrowserContent | null = browser
    ? createBrowserContent(browser)
    : null;

  let hops: { a: Conn; b: Conn } | null = null;
  let shots: Shot[] = [];
  let phase: Phase = "rest";
  let phaseUntil = 0;
  let clock = 0;
  let revealing: HTMLElement | null = null;
  let waveStart: number | null = null;
  let origin = { x: 0, y: 0, reach: 0 };

  const waveScale = () => {
    if (!import.meta.env.DEV) return 1;
    const raw = Number(new URLSearchParams(location.search).get("wave"));
    return Number.isFinite(raw) && raw > 0 ? Math.min(raw, WAVE_SCALE_MAX) : 1;
  };

  const waveDuration = WAVE * waveScale();

  const connect = (from: Anchor, to: Anchor): Conn =>
    createBullet(
      makeSnake,
      buildConnector(from, to, { deep: DEEP, root }),
      "orange"
    );

  const destroyHops = () => {
    if (hops) {
      hops.a.snake.destroy();
      hops.b.snake.destroy();
    }
    hops = null;
    shots = [];
  };

  cleanup(destroyHops);

  const measureOrigin = (panel?: HTMLElement | null) => {
    const reference = panel ?? waveEl;
    if (!browser || !reference) return;
    const zoom = resolveZoom(root);
    const browserRect = browser.getBoundingClientRect();
    const impactX = browserRect.left + DEEP * zoom;
    const impactY = browserRect.top + browserRect.height / 2;

    const panelRect = reference.getBoundingClientRect();
    const x = (impactX - panelRect.left) / zoom;
    const y = (impactY - panelRect.top) / zoom;
    const width = panelRect.width / zoom;
    const height = panelRect.height / zoom;
    origin = {
      x,
      y,
      reach: Math.max(
        Math.hypot(x, y),
        Math.hypot(width - x, y),
        Math.hypot(x, height - y),
        Math.hypot(width - x, height - y)
      ),
    };
  };

  const build = () => {
    const chips = measureChips(root, ["G", "C"]);
    if (!chips || !stage) return null;

    const zoom = resolveZoom(root);
    const rootRect = root.getBoundingClientRect();
    const stageRect = stage.getBoundingClientRect();
    const browserAnchor: Anchor = {
      x: (stageRect.left - rootRect.left) / zoom,
      y: (stageRect.top + stageRect.height / 2 - rootRect.top) / zoom,
      side: "left",
    };

    measureOrigin();

    hops = {
      a: connect(
        {
          x: chips.G.cx + chips.G.r,
          y: chips.G.cy,
          side: "right",
        },
        { x: chips.C.cx - chips.C.r, y: chips.C.cy, side: "left" }
      ),
      b: connect(
        {
          x: chips.C.cx + chips.C.r,
          y: chips.C.cy,
          side: "right",
        },
        browserAnchor
      ),
    };
    return hops;
  };

  const paintWave = (progress: number) => {
    const easedProgress = WAVE_EASE(progress);
    const gradientOrigin = `circle at ${origin.x.toFixed(1)}px ${origin.y.toFixed(1)}px`;

    const sweepProgress = Math.min(easedProgress / REVEAL_SPLIT, 1);
    const settleProgress = Math.max(
      (easedProgress - REVEAL_SPLIT) / (1 - REVEAL_SPLIT),
      0
    );
    const revealFloor =
      settleProgress * settleProgress * (3 - 2 * settleProgress);

    const revealRadius =
      (GROW_SPAN * sweepProgress + (1 - GROW_SPAN) * settleProgress) *
      (origin.reach + MASK_FEATHER);

    if (revealing) {
      const feather = MASK_FEATHER * Math.min(progress / FEATHER_RAMP, 1);
      revealing.style.maskImage = `radial-gradient(${gradientOrigin}, #000 ${revealRadius.toFixed(1)}px, rgba(0, 0, 0, ${revealFloor.toFixed(3)}) ${(revealRadius + feather).toFixed(1)}px)`;
    }

    if (!waveEl) return;
    if (easedProgress <= 0) {
      waveEl.style.opacity = "0";
      return;
    }

    const pixels = (value: number) => `${Math.max(0, value).toFixed(1)}px`;
    const colorStop = (alpha: number) =>
      alpha === 0
        ? "transparent"
        : alpha === 100
          ? RING_COLOR
          : `color-mix(in oklab, ${RING_COLOR} ${alpha}%, transparent)`;

    const maxRingRadius = RING_CAP * (origin.reach + MASK_FEATHER);
    const cappedProgress =
      maxRingRadius > 0 ? Math.min(revealRadius / maxRingRadius, 1) : 0;
    const fadeProgress = Math.max(
      (cappedProgress - RING_HOLD) / (1 - RING_HOLD),
      0
    );

    waveEl.style.opacity = String(
      WAVE_ALPHA * (1 - fadeProgress * fadeProgress * (3 - 2 * fadeProgress))
    );
    waveEl.style.background = `radial-gradient(${gradientOrigin}, ${RING_STOPS.map(
      ([offset, alpha]) =>
        `${colorStop(alpha)} ${pixels(Math.min(revealRadius, maxRingRadius) + offset)}`
    ).join(", ")})`;
  };

  const clearWave = () => {
    revealing = null;
    if (!waveEl) return;
    waveEl.style.opacity = "0";
    waveEl.style.removeProperty("background");
  };

  const launch = (conn: Conn, handlers: Parameters<PulseThrow["play"]>[0]) => {
    shots.push({ conn, startT: clock });
    conn.throw.play(handlers);
  };

  const enter = (next: Phase, hold: number) => {
    phase = next;
    phaseUntil = clock + hold;
  };

  const arriveCloudflare = (dwell: number) => {
    const el = chipEl(root, "C");
    if (el) hitChip(el);
    enter("gap", dwell + GAP);
  };

  const arriveBrowser = () => {
    if (nudge) nudgeHit(nudge, { axis: "x", amount: 2 });
    revealing = content?.begin() ?? null;
    measureOrigin(revealing);
    waveStart = clock - WAVE_LEAD;
    paintWave(0);
  };

  const finishReveal = () => {
    content?.settle();
    clearWave();
    enter("rest", REST);
  };

  const rebuild = () => {
    destroyHops();
    waveStart = null;
    content?.settle();
    clearWave();
    phase = "rest";
    phaseUntil = clock + REST;
  };

  return {
    rebuild,
    tick: (elapsed) => {
      clock = elapsed;
      float.tick(elapsed);

      const built = hops ?? build();
      if (!built) return;

      for (const shot of shots) shot.conn.throw.update(clock - shot.startT);
      shots = shots.filter((shot) => !shot.conn.throw.done);

      if (waveStart !== null) {
        const progress = Math.min(
          Math.max((clock - waveStart - WAVE_DELAY) / waveDuration, 0),
          1
        );
        paintWave(progress);
        if (progress >= 1) {
          waveStart = null;
          finishReveal();
          return;
        }
      }

      if (clock < phaseUntil) return;

      switch (phase) {
        case "rest":
          enter("lead", LEAD);
          return;
        case "lead":
          phase = "hop-a";
          phaseUntil = Number.POSITIVE_INFINITY;
          launch(built.a, { onArrive: () => arriveCloudflare(built.a.dwell) });
          return;
        case "gap":
          phase = "hop-b";
          phaseUntil = Number.POSITIVE_INFINITY;
          launch(built.b, { onArrive: arriveBrowser });
          return;
        default:
          return;
      }
    },
  };
}
