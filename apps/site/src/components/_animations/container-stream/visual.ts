import { cubicBezier } from "motion";
import { chipEl } from "@/components/_animations/shared/chips/dom";
import { measureChips } from "@/components/_animations/shared/chips/measure-chips";
import { nudgeHit } from "@/components/_animations/shared/nudge/nudge-hit";
import type { SnakeVisualContext } from "@/components/_animations/shared/snake-pulse/backend";
import { buildConnector } from "@/components/_animations/shared/snake-pulse/build-connector";
import { createBullet } from "@/components/_animations/shared/snake-pulse/bullet";
import type { Anchor } from "@/components/_animations/shared/snake-pulse/geometry";
import { clamp } from "@/components/_animations/shared/snake-pulse/math";
import type { PulseThrow } from "@/components/_animations/shared/snake-pulse/pulse-throw";
import type { ThrowableSnake } from "@/components/_animations/shared/snake-pulse/snake";
import type { Visual } from "@/components/_animations/section-visuals";
import { resolveZoom } from "@/utils/zoom";
import { clearCrest, collectCrestSteps, paintCrest } from "./code-crest";
import { shuffleCode } from "./code-shuffle";

const DEEP = 14;
// buildConnector extends `deep` past the anchor, and the canvas snake clamps its
// head to the path end — so the terminus is anchor + deep, not the anchor. The
// emit connector is therefore anchored EMIT_DEEP short of the browser, putting
// that terminus exactly on its outer edge instead of inside the chrome band.
const EMIT_DEEP = 4;
const EXIT = 0.15;
// Cadence taken from `render` too: REST 0.5, SLIDE 0.3375. HOLD is longer than
// its 0.15 only so the 0.25s check crossfade completes before the strip moves.
const IDLE = 0.5;
// Beat between the stream finishing and the container reporting back.
const SETTLE = 0.4;
// A card with nothing to report to moves on this long after the container stops
// writing. Measured from the last token, so the spinner's 450ms collapse plays
// out inside it and the finished container then rests for the remainder.
const DONE_HOLD = 1.5;
// Dwell once the checkmark is fully on screen — measured from the end of the
// crossfade, so the phase also has to absorb CHECK_DELAY + SWAP.
const HOLD = 0.5;
const ADVANCE = 0.3375;
// With EXIT and a blunt body the snake clears the path almost the instant it
// arrives, so this only has to cover a frame or two. Waiting on the throw's own
// completion instead would open a visible dead gap.
const CHECK_DELAY = 0.02;
// Lands just after the nudge's outward peak (~100ms). 0.25 finished at ~290ms
// and read late; 0.1 landed on the peak but snapped.
const SWAP = 0.2;
const ADVANCE_EASE = cubicBezier(0.6, 0.6, 0, 1);
// Matches the compute use-cases chip swap (RunChipIcon): opacity + blur + scale,
// entering from 0.95, exiting out to 1.05, on its ease. Quart-out was tried to
// pull the swap earlier and front-loaded it too hard — it read snappy rather
// than deliberate. Pull SWAP down before reaching for a sharper curve.
const SWAP_EASE = cubicBezier(0.6, 0.6, 0, 1);

type Conn = { snake: ThrowableSnake; throw: PulseThrow };
type Shot = { conn: Conn; startT: number };
type Phase =
  "idle" | "emit" | "stream" | "settle" | "complete" | "hold" | "advance";

export function createContainerStreamVisual({
  makeSnake,
  root,
  cleanup,
}: SnakeVisualContext): Visual {
  // `root` is the stage the canvas layer is aligned to; the config and the CSS
  // variables live on ContainerStream's own root inside it, and custom properties
  // do not inherit upwards.
  const host = root.querySelector<HTMLElement>("[data-stream-root]");
  if (!host) {
    throw new Error("createContainerStreamVisual: missing [data-stream-root]");
  }

  const track = root.querySelector<HTMLElement>("[data-stream-track]");
  const slotEls = Array.from(
    root.querySelectorAll<HTMLElement>("[data-stream-slot]")
  );
  const loader = root.querySelector<HTMLElement>("[data-stream-loader]");
  const check = root.querySelector<HTMLElement>("[data-stream-check]");
  const hasReport = root.querySelector('[data-chip-id="W"]') !== null;
  const color = host.dataset.sourceColor ?? "purple";

  let conns: { emit: Conn; report: Conn | null } | null = null;
  let pitch = 0;
  let shots: Shot[] = [];
  let phase: Phase = "idle";
  let phaseUntil = IDLE;
  let clock = 0;
  let offsets: number[] = [];
  let steps: HTMLElement[] = [];
  let written = 0;
  let streamStart: number | null = null;
  let swapStart: number | null = null;
  let swapAt: number | null = null;
  let swapFrom = 0;
  let swapTarget = 0;
  let swapValue = 0;
  let advanceStart = 0;

  const browserIn = (slot: HTMLElement) =>
    slot.querySelector<HTMLElement>("[data-stream-browser]");

  const centerSlot = () => {
    const index = offsets.indexOf(0);
    return index < 0 ? null : slotEls[index];
  };

  const centerBrowser = () => {
    const slot = centerSlot();
    return slot ? browserIn(slot) : null;
  };

  const addressLoaderIn = (browser: HTMLElement) =>
    browser.querySelector<HTMLElement>("[data-browser-loader]");

  // The address-bar spinner reads as "this container is still writing", so it
  // collapses out of the pill the moment the last token lands — the same slot
  // width the active state expanded, run backwards.
  const stopAddressLoader = (browser: HTMLElement | null) => {
    const loaderSlot = browser ? addressLoaderIn(browser) : null;
    if (!loaderSlot) return;
    loaderSlot.style.width = "0px";
    loaderSlot.style.opacity = "0";
  };

  const clearBrowser = (browser: HTMLElement) => {
    delete browser.dataset.active;
    const loaderSlot = addressLoaderIn(browser);
    if (loaderSlot) {
      loaderSlot.style.width = "";
      loaderSlot.style.opacity = "";
    }
    clearCrest(browser);
  };

  const resetSlots = () => {
    if (pitch <= 0) return;
    offsets = slotEls.map((_, index) => (index - 1) * pitch);
    for (const [index, slot] of slotEls.entries()) {
      slot.style.translate = `0 ${offsets[index]}px`;
    }
    if (track) track.style.translate = "0px";
  };

  const paintIcon = (
    el: HTMLElement | null,
    shown: number,
    entering: boolean
  ) => {
    if (!el) return;
    el.style.opacity = `${shown}`;
    el.style.filter = `blur(${1 - shown}px)`;
    el.style.scale = `${entering ? 0.95 + 0.05 * shown : 1 + 0.05 * (1 - shown)}`;
  };

  const startSwap = (target: number) => {
    swapFrom = swapValue;
    swapTarget = target;
    swapStart = clock;
  };

  const paintChip = () => {
    if (swapStart !== null) {
      const progress = SWAP_EASE(clamp((clock - swapStart) / SWAP, 0, 1));
      swapValue = swapFrom + (swapTarget - swapFrom) * progress;
      if (progress >= 1) swapStart = null;
    }
    paintIcon(loader, 1 - swapValue, swapTarget === 0);
    paintIcon(check, swapValue, swapTarget === 1);
  };

  const connect = (
    from: Anchor,
    to: Anchor,
    deep = DEEP,
    exitDuration?: number
  ): Conn =>
    createBullet(
      makeSnake,
      buildConnector(from, to, { deep, root }),
      color,
      color,
      {
        exitDuration,
      }
    );

  const destroyConns = () => {
    if (conns) {
      conns.emit.snake.destroy();
      conns.report?.snake.destroy();
    }
    conns = null;
    shots = [];
  };

  cleanup(destroyConns);

  const build = () => {
    const source = measureChips(root, ["A"]);
    const target = hasReport ? measureChips(root, ["W"]) : null;
    if (!source || (hasReport && !target) || !track || slotEls.length === 0) {
      return null;
    }

    pitch = Number.parseFloat(
      getComputedStyle(host).getPropertyValue("--stream-pitch")
    );
    if (!(pitch > 0)) return null;

    const zoom = resolveZoom(root);
    const rect = root.getBoundingClientRect();
    const stageH = rect.height / zoom;
    if (rect.width <= 0) return null;

    resetSlots();

    // Anchor on the measured centre browser rather than on a WINDOW_W constant:
    // that is what lets one module serve both card sizes, and it takes the
    // off-centre column of the sandbox card for free.
    const slot = centerSlot();
    const browser = slot ? browserIn(slot) : null;
    if (!browser) return null;
    const box = browser.getBoundingClientRect();
    const left = (box.left - rect.left) / zoom;
    const right = (box.right - rect.left) / zoom;

    const centerY = stageH / 2;
    conns = {
      emit: connect(
        {
          x: source.A.cx + source.A.r,
          y: source.A.cy,
          side: "right",
        },
        { x: left - EMIT_DEEP, y: centerY, side: "left" },
        EMIT_DEEP
      ),
      report: target
        ? connect(
            { x: right, y: centerY, side: "right" },
            {
              x: target.W.cx - target.W.r,
              y: target.W.cy,
              side: "left",
            },
            DEEP,
            EXIT
          )
        : null,
    };
    return conns;
  };

  const launch = (conn: Conn, onArrive: () => void) => {
    shots.push({ conn, startT: clock });
    conn.throw.play({ onArrive });
  };

  // The container has stopped writing. With a waiting chip to report to, the
  // spinner switching off is only the first beat of a longer tail; without one
  // it is the whole of it, and the strip moves on DONE_HOLD later.
  const endStream = () => {
    stopAddressLoader(centerBrowser());
    if (hasReport) {
      phase = "settle";
      phaseUntil = clock + SETTLE;
      return;
    }
    phase = "hold";
    phaseUntil = clock + DONE_HOLD;
  };

  const arriveBrowser = () => {
    const slot = centerSlot();
    const browser = slot ? browserIn(slot) : null;

    steps = [];
    written = 0;

    if (slot && browser) {
      // Nudge the wrapper, never the Browser root — Browser.astro bakes in
      // `transition-all duration-450`, which interpolates every transform motion
      // writes and smears the hit into nothing.
      const nudge = slot.querySelector<HTMLElement>("[data-stream-nudge]");
      if (nudge) nudgeHit(nudge, { axis: "x", amount: 2 });
      browser.dataset.active = "";
      steps = collectCrestSteps(browser);
    }

    // `emit` parks on an infinite phaseUntil and depends on this handler to move
    // the phase on, so bailing out here would freeze the loop until a resize
    // forced a rebuild. With nothing to stream, the write is over on arrival.
    if (steps.length === 0) {
      endStream();
      return;
    }

    streamStart = clock;
    phase = "stream";
    phaseUntil = Number.POSITIVE_INFINITY;
  };

  const arriveWaiting = () => {
    const chip = chipEl(root, "W");
    // nudgeHit alone, as every other visual does — layering hitChip's scale on
    // top damps the translate and the impact reads soft.
    if (chip) nudgeHit(chip, { axis: "x", amount: 2 });
    swapAt = clock + CHECK_DELAY;
    phase = "hold";
    phaseUntil = clock + CHECK_DELAY + SWAP + HOLD;
  };

  const finishAdvance = () => {
    if (track) track.style.translate = "0px";
    const span = pitch * slotEls.length;
    for (const [index, slot] of slotEls.entries()) {
      let offset = offsets[index] - pitch;
      const wrapped = offset < -pitch;
      if (wrapped) offset += span;
      offsets[index] = offset;
      slot.style.translate = `0 ${offset}px`;
      if (offset !== 0) {
        const browser = browserIn(slot);
        if (browser) {
          clearBrowser(browser);
          // Only the wrapped slot sits entirely below the stage. The slot at
          // -pitch still shows its last code row in the top few pixels, so
          // reshuffling there would pop in view.
          if (wrapped) shuffleCode(browser);
        }
      }
    }

    steps = [];
    written = 0;
    phase = "idle";
    phaseUntil = clock + IDLE;
  };

  const rebuild = () => {
    destroyConns();
    // Read before resetSlots rewrites the offsets: what has to be spared is the
    // container the viewer can currently see, not the one that holds the centre
    // afterwards.
    const visible = centerSlot();
    for (const slot of slotEls) {
      const browser = browserIn(slot);
      if (!browser) continue;
      clearBrowser(browser);
      if (slot !== visible) shuffleCode(browser);
    }
    resetSlots();
    steps = [];
    written = 0;
    streamStart = null;
    swapStart = null;
    swapAt = null;
    swapValue = 0;
    // Direction as well as position: paintChip derives each icon's enter/exit
    // scale from swapTarget, so leaving it at 1 rests the hidden checkmark on the
    // entering scale instead of the exiting one.
    swapTarget = 0;
    swapFrom = 0;
    paintChip();
    phase = "idle";
    phaseUntil = clock + IDLE;
  };

  return {
    rebuild,
    tick: (elapsed) => {
      clock = elapsed;

      const built = conns ?? build();
      if (!built) return;

      for (const shot of shots) shot.conn.throw.update(clock - shot.startT);
      shots = shots.filter((shot) => !shot.conn.throw.done);

      if (swapAt !== null && clock >= swapAt) {
        swapAt = null;
        startSwap(1);
      }
      paintChip();

      if (streamStart !== null) {
        const crest = paintCrest(steps, clock - streamStart, written);
        written = crest.written;
        if (crest.done) {
          streamStart = null;
          endStream();
        }
      }

      if (phase === "advance") {
        const progress = ADVANCE_EASE(
          clamp((clock - advanceStart) / ADVANCE, 0, 1)
        );
        if (track) track.style.translate = `0 ${-pitch * progress}px`;
        if (progress >= 1) finishAdvance();
        return;
      }

      if (clock < phaseUntil) return;

      switch (phase) {
        case "idle": {
          phase = "emit";
          phaseUntil = Number.POSITIVE_INFINITY;
          launch(built.emit, arriveBrowser);
          return;
        }
        case "settle": {
          // Unreachable without a report leg — endStream sends those straight to
          // `hold` — but the narrowing has to be here for `launch` regardless.
          if (!built.report) {
            phase = "hold";
            phaseUntil = clock + DONE_HOLD;
            return;
          }
          phase = "complete";
          phaseUntil = Number.POSITIVE_INFINITY;
          launch(built.report, arriveWaiting);
          return;
        }
        case "hold": {
          phase = "advance";
          advanceStart = clock;
          startSwap(0);
          // Deactivate as the slide starts, not when it lands — the browser's own
          // 450ms transition then plays out under the 550ms travel.
          const finished = centerBrowser();
          if (finished) delete finished.dataset.active;
          return;
        }
        default:
          return;
      }
    },
  };
}
