import { cubicBezier } from "motion";
import {
  clearCrest,
  collectCrestSteps,
  paintCrest,
} from "@/components/_animations/container-stream/code-crest";
import { shuffleCode } from "@/components/_animations/container-stream/code-shuffle";
import { measureChips } from "@/components/_animations/shared/chips/measure-chips";
import { createSpinnerBridge } from "@/components/_animations/shared/choreography/spinner-bridge";
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

const DEEP = 14;
const LEAD = 0.8;
// Hub hold on top of the bullet's own dwell. Together they land on the ~0.5s the
// house law asks for at a hub.
const GAP = 0.35;
const REST = 1.5;
// After the last token lands, before the strip moves on.
const HOLD = 0.9;
const ADVANCE = 0.3375;
const ADVANCE_EASE = cubicBezier(0.6, 0.6, 0, 1);
// The four container tiles fill across the code run rather than all at once.
const TILE_STOPS = [0.1, 0.35, 0.6, 0.85];

type Conn = { snake: ThrowableSnake; throw: PulseThrow; dwell: number };
type Shot = { conn: Conn; startT: number };
type Phase =
  "rest" | "lead" | "hop-a" | "gap" | "hop-b" | "stream" | "hold" | "advance";

export function createSdkControlVisual({
  makeSnake,
  root,
  cleanup,
}: SnakeVisualContext): Visual {
  const stage = root.querySelector<HTMLElement>("[data-reel-stage]");
  const track = root.querySelector<HTMLElement>("[data-reel-track]");
  const slotEls = Array.from(
    root.querySelectorAll<HTMLElement>("[data-reel-slot]")
  );
  // The bridge owns what a ringed hub does on a hit — the chip bounce and the
  // ring boost together. `onApproachCenter` stays unwired on purpose: leg a's
  // arriveT is ~0.57s, under RING_DECEL_TIME, so the ring cannot fit a
  // deceleration and would freeze. Same call pill-hub-pill documents.
  const spinner = createSpinnerBridge(root, {
    ring: root.querySelector<HTMLElement>("[data-orbit-ring]"),
    centerId: "C",
  });

  let hops: { a: Conn; b: Conn } | null = null;
  let shots: Shot[] = [];
  let phase: Phase = "rest";
  let phaseUntil = REST;
  let clock = 0;
  let pitch = 0;
  let offsets: number[] = [];
  let steps: HTMLElement[] = [];
  let tiles: HTMLElement[] = [];
  let written = 0;
  let streamStart: number | null = null;
  let advanceStart = 0;

  const browserIn = (slot: HTMLElement) =>
    slot.querySelector<HTMLElement>("[data-reel-browser]");

  const centerSlot = () => {
    const index = offsets.indexOf(0);
    return index < 0 ? null : slotEls[index];
  };

  const centerBrowser = () => {
    const slot = centerSlot();
    return slot ? browserIn(slot) : null;
  };

  // The address spinner says "the Worker is still writing here", so it collapses
  // out of the pill on the last token — the slot the active state expanded, run
  // backwards.
  const stopAddressLoader = (browser: HTMLElement | null) => {
    const slot = browser?.querySelector<HTMLElement>("[data-browser-loader]");
    if (!slot) return;
    slot.style.width = "0px";
    slot.style.opacity = "0";
  };

  const clearBrowser = (browser: HTMLElement) => {
    delete browser.dataset.active;
    const loader = browser.querySelector<HTMLElement>("[data-browser-loader]");
    if (loader) {
      loader.style.width = "";
      loader.style.opacity = "";
    }
    for (const tile of browser.querySelectorAll<HTMLElement>(
      "[data-sandbox-tile]"
    )) {
      delete tile.dataset.lit;
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

  const connect = (from: Anchor, to: Anchor): Conn =>
    createBullet(
      makeSnake,
      buildConnector(from, to, { deep: DEEP, root }),
      "purple"
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

  const build = () => {
    const chips = measureChips(root, ["U", "C"]);
    if (!chips || !stage || !track || slotEls.length === 0) return null;

    const zoom = resolveZoom(root);
    const rootRect = root.getBoundingClientRect();
    const stageRect = stage.getBoundingClientRect();
    if (rootRect.width <= 0 || stageRect.height <= 0) return null;

    // SdkControl.astro owns the pitch and publishes it; recomputing it here from
    // the window height would put the 36 gap in two files.
    pitch = Number.parseFloat(
      getComputedStyle(stage).getPropertyValue("--reel-pitch")
    );
    if (!(pitch > 0)) return null;
    resetSlots();

    const browserAnchor: Anchor = {
      x: (stageRect.left - rootRect.left) / zoom,
      y: (stageRect.top + stageRect.height / 2 - rootRect.top) / zoom,
      side: "left",
    };

    hops = {
      a: connect(
        { x: chips.U.cx + chips.U.r, y: chips.U.cy, side: "right" },
        { x: chips.C.cx - chips.C.r, y: chips.C.cy, side: "left" }
      ),
      b: connect(
        { x: chips.C.cx + chips.C.r, y: chips.C.cy, side: "right" },
        browserAnchor
      ),
    };
    return hops;
  };

  const launch = (conn: Conn, handlers: Parameters<PulseThrow["play"]>[0]) => {
    shots.push({ conn, startT: clock });
    conn.throw.play(handlers);
  };

  const enter = (next: Phase, hold: number) => {
    phase = next;
    phaseUntil = clock + hold;
  };

  const arriveHub = (dwell: number) => {
    spinner.onHit("C", "outC");
    enter("gap", dwell + GAP);
  };

  const arriveBrowser = () => {
    const slot = centerSlot();
    const browser = slot ? browserIn(slot) : null;

    steps = [];
    tiles = [];
    written = 0;

    if (slot && browser) {
      // Nudge the wrapper, never the Browser root — Browser.astro bakes in
      // `transition-all duration-450`, which interpolates anything motion writes
      // onto it and smears the hit into nothing.
      const nudge = slot.querySelector<HTMLElement>("[data-reel-nudge]");
      if (nudge) nudgeHit(nudge, { axis: "x", amount: 2 });
      browser.dataset.active = "";
      steps = collectCrestSteps(browser);
      tiles = Array.from(
        browser.querySelectorAll<HTMLElement>("[data-sandbox-tile]")
      );
    }

    // `hop-b` parks on an infinite phaseUntil and leans on this handler to move
    // the phase on, so an empty window has to end the run here or the loop
    // freezes until a resize forces a rebuild.
    if (steps.length === 0) {
      endStream();
      return;
    }

    streamStart = clock;
    phase = "stream";
    phaseUntil = Number.POSITIVE_INFINITY;
  };

  const endStream = () => {
    stopAddressLoader(centerBrowser());
    enter("hold", HOLD);
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
      if (offset === 0) continue;

      const browser = browserIn(slot);
      if (!browser) continue;
      clearBrowser(browser);
      // Only the wrapped slot sits entirely below the card. The one at -pitch
      // still shows its top rows over the card edge, so reshuffling there pops.
      if (wrapped) shuffleCode(browser);
    }

    steps = [];
    tiles = [];
    written = 0;
    enter("rest", REST);
  };

  const rebuild = () => {
    destroyHops();
    // Read before resetSlots rewrites the offsets: what has to be spared is the
    // window the viewer can currently see, not the one that holds the centre
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
    tiles = [];
    written = 0;
    streamStart = null;
    enter("rest", REST);
  };

  return {
    rebuild,
    tick: (elapsed, dt) => {
      clock = elapsed;
      spinner.tick(dt);

      const built = hops ?? build();
      if (!built) return;

      for (const shot of shots) shot.conn.throw.update(clock - shot.startT);
      shots = shots.filter((shot) => !shot.conn.throw.done);

      if (streamStart !== null) {
        const run = clock - streamStart;
        const crest = paintCrest(steps, run, written);
        written = crest.written;

        for (const [index, tile] of tiles.entries()) {
          if (crest.progress >= (TILE_STOPS[index] ?? 1)) tile.dataset.lit = "";
        }

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
        case "rest":
          enter("lead", LEAD);
          return;
        case "lead":
          phase = "hop-a";
          phaseUntil = Number.POSITIVE_INFINITY;
          launch(built.a, { onArrive: () => arriveHub(built.a.dwell) });
          return;
        case "gap":
          phase = "hop-b";
          phaseUntil = Number.POSITIVE_INFINITY;
          launch(built.b, { onArrive: arriveBrowser });
          return;
        case "hold": {
          phase = "advance";
          phaseUntil = Number.POSITIVE_INFINITY;
          advanceStart = clock;
          // Deactivate as the slide starts, not when it lands — the window's own
          // 450ms transition then plays out under the travel instead of firing
          // afterwards on a slot whose top rows are still over the card edge.
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
