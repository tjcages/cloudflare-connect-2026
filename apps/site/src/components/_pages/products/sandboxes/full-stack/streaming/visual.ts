import { cubicBezier } from "motion";
import { measureChips } from "@/components/_animations/shared/chips/measure-chips";
import { createRingSpinner } from "@/components/_animations/shared/choreography/ring";
import { nudgeHit } from "@/components/_animations/shared/nudge/nudge-hit";
import type { SnakeVisualContext } from "@/components/_animations/shared/snake-pulse/backend";
import { buildConnector } from "@/components/_animations/shared/snake-pulse/build-connector";
import { createBullet } from "@/components/_animations/shared/snake-pulse/bullet";
import { clamp } from "@/components/_animations/shared/snake-pulse/math";
import type { PulseThrow } from "@/components/_animations/shared/snake-pulse/pulse-throw";
import type { ThrowableSnake } from "@/components/_animations/shared/snake-pulse/snake";
import type { Visual } from "@/components/_animations/section-visuals";
import { resolveZoom } from "@/utils/zoom";
import { shuffleRows } from "./row-shuffle";

// buildConnector extends `deep` past the anchor and the canvas snake clamps its
// head to the path end, so the connector is anchored EMIT_DEEP short of the
// window, putting the terminus exactly on its outer edge.
const EMIT_DEEP = 4;
const REST = 1.5;
// The spinner stays on this long past the last token, so the write reads as
// finishing rather than cutting off the moment the last dash lands.
const LOADER_TAIL = 0.3;
// After the loader collapses, before the strip moves on. The loader's 450ms
// collapse plays out inside it.
const HOLD = 0.9;
const ADVANCE = 0.3375;
const ADVANCE_EASE = cubicBezier(0.6, 0.6, 0, 1);
const STEP = 0.035;
const WAVE = 6;
// The divider and any grid rules are the room the sandbox writes into, not part
// of the write. They land first and quickly, then the halves fill.
const SCAFFOLD = 0.2;
// A sandbox writes before it renders: the code runs first and the preview
// answers a beat later, then the two land together.
const PREVIEW_LAG = 0.3;
// The token commits well before the crest reaches it — otherwise the crest
// paints at ~0.6 opacity and washes out.
const LIT = 2;
const WAVE_AMP = 0.6;

type Conn = { snake: ThrowableSnake; throw: PulseThrow };
type Shot = { conn: Conn; startT: number };
type Phase = "rest" | "emit" | "stream" | "hold" | "advance";
type Lane = "frame" | "preview" | "code";

const noLanes = (): Record<Lane, HTMLElement[]> => ({
  frame: [],
  preview: [],
  code: [],
});

export function createStreamingVisual({
  makeSnake,
  root,
  cleanup,
}: SnakeVisualContext): Visual {
  const stage = root.querySelector<HTMLElement>("[data-reel-stage]");
  const track = root.querySelector<HTMLElement>("[data-reel-track]");
  const slotEls = Array.from(
    root.querySelectorAll<HTMLElement>("[data-reel-slot]")
  );
  // The hub only emits — nothing ever lands on it, so the ring keeps its base
  // spin and never boosts, the same shape as the email Reply hub.
  const spinner = createRingSpinner(
    root.querySelector<HTMLElement>("[data-orbit-ring]")
  );

  let conn: Conn | null = null;
  let shots: Shot[] = [];
  let phase: Phase = "rest";
  let phaseUntil = REST;
  let clock = 0;
  let pitch = 0;
  let offsets: number[] = [];
  let lanes: Record<Lane, HTMLElement[]> = { frame: [], preview: [], code: [] };
  let written: Record<Lane, number> = { frame: 0, preview: 0, code: 0 };
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

  // Document order inside each lane is the reading order its markup is written
  // in, so a lane fills left to right, top to bottom with no per-window list.
  const laneEls = (browser: HTMLElement, lane: Lane) =>
    Array.from(
      browser.querySelectorAll<HTMLElement>(
        `[data-stream-lane="${lane}"]:not([hidden])`
      )
    );

  const collectLanes = (browser: HTMLElement): Record<Lane, HTMLElement[]> => ({
    frame: laneEls(browser, "frame"),
    preview: laneEls(browser, "preview"),
    code: laneEls(browser, "code"),
  });

  // Returns the new settled cursor. `head` is in cells, so a lane's own span
  // decides how fast it reads — that is what lets two lanes of different
  // lengths start and finish together.
  const paintLane = (els: HTMLElement[], head: number, from: number) => {
    let settled = from;
    const commit = clamp(Math.floor(head - WAVE), 0, els.length);
    for (; settled < commit; settled++) {
      els[settled].style.opacity = "1";
      els[settled].style.scale = "";
    }

    const live = clamp(Math.ceil(head), 0, els.length);
    for (let index = settled; index < live; index++) {
      const el = els[index];
      const lit = clamp((head - index) / LIT, 0, 1);
      // Dashes ship at opacity-20 so the crest is a pulse on a visible cell,
      // matching container-stream. Tiles, bars and blocks still arrive 0 → 1.
      el.style.opacity = el.hasAttribute("data-stream-segment")
        ? `${0.2 + 0.8 * lit}`
        : `${lit}`;
      if (!el.hasAttribute("data-stream-segment")) continue;

      const crest = clamp((head - index) / WAVE, 0, 1);
      el.style.scale = `1 ${1 + WAVE_AMP * Math.sin(Math.PI * crest)}`;
    }
    return settled;
  };

  const settleLane = (els: HTMLElement[]) => {
    for (const el of els) {
      el.style.opacity = "1";
      el.style.scale = "";
    }
  };

  const loaderIn = (browser: HTMLElement) =>
    browser.querySelector<HTMLElement>("[data-browser-loader]");

  // The address-bar spinner reads as "the command is still writing", so it
  // collapses out of the pill the moment the last token lands — the same slot
  // width the active state expanded, run backwards.
  const stopLoader = (browser: HTMLElement | null) => {
    const slot = browser ? loaderIn(browser) : null;
    if (!slot) return;
    slot.style.width = "0px";
    slot.style.opacity = "0";
  };

  const clearBrowser = (browser: HTMLElement) => {
    delete browser.dataset.active;
    const slot = loaderIn(browser);
    if (slot) {
      slot.style.width = "";
      slot.style.opacity = "";
    }
    for (const el of browser.querySelectorAll<HTMLElement>(
      "[data-stream-lane]"
    )) {
      el.style.opacity = "";
      el.style.scale = "";
    }
  };

  const resetSlots = () => {
    if (pitch <= 0) return;
    offsets = slotEls.map((_, index) => (index - 1) * pitch);
    for (const [index, slot] of slotEls.entries()) {
      slot.style.translate = `0 ${offsets[index]}px`;
    }
    if (track) track.style.translate = "0px";
  };

  const destroyConn = () => {
    conn?.snake.destroy();
    conn = null;
    shots = [];
  };

  cleanup(destroyConn);

  const build = () => {
    const chips = measureChips(root, ["C"]);
    if (!chips || !stage || !track || slotEls.length === 0) return null;

    const zoom = resolveZoom(root);
    const rootRect = root.getBoundingClientRect();
    const stageRect = stage.getBoundingClientRect();
    if (rootRect.width <= 0 || stageRect.height <= 0) return null;

    pitch = stageRect.height / zoom + 36;
    resetSlots();

    const left = (stageRect.left - rootRect.left) / zoom;
    const centerY =
      (stageRect.top + stageRect.height / 2 - rootRect.top) / zoom;

    conn = createBullet(
      makeSnake,
      buildConnector(
        { x: chips.C.cx + chips.C.r, y: chips.C.cy, side: "right" },
        { x: left - EMIT_DEEP, y: centerY, side: "left" },
        { deep: EMIT_DEEP, root }
      ),
      "purple"
    );
    return conn;
  };

  const arriveBrowser = () => {
    const slot = centerSlot();
    const browser = slot ? browserIn(slot) : null;

    lanes = noLanes();
    written = { frame: 0, preview: 0, code: 0 };

    if (slot && browser) {
      // Nudge the wrapper, never the Browser root — Browser.astro bakes in
      // `transition-all duration-450`, which interpolates every transform motion
      // writes and smears the hit into nothing.
      const nudge = slot.querySelector<HTMLElement>("[data-reel-nudge]");
      if (nudge) nudgeHit(nudge, { axis: "x", amount: 2 });
      browser.dataset.active = "";
      lanes = collectLanes(browser);
    }

    // `emit` parks on an infinite phaseUntil and depends on this handler to move
    // the phase on, so an empty window has to end the run here or the loop
    // freezes until a resize forces a rebuild.
    if (lanes.frame.length + lanes.preview.length + lanes.code.length === 0) {
      endStream();
      return;
    }

    streamStart = clock;
    phase = "stream";
    phaseUntil = Number.POSITIVE_INFINITY;
  };

  const endStream = () => {
    stopLoader(centerBrowser());
    phase = "hold";
    phaseUntil = clock + HOLD;
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
      // still shows its last rows over the card edge, so reshuffling there pops.
      if (wrapped) shuffleRows(browser);
    }

    lanes = noLanes();
    written = { frame: 0, preview: 0, code: 0 };
    phase = "rest";
    phaseUntil = clock + REST;
  };

  const rebuild = () => {
    destroyConn();
    // Read before resetSlots rewrites the offsets: what has to be spared is the
    // window the viewer can currently see, not the one that holds the centre
    // afterwards.
    const visible = centerSlot();
    for (const slot of slotEls) {
      const browser = browserIn(slot);
      if (!browser) continue;
      clearBrowser(browser);
      if (slot !== visible) shuffleRows(browser);
    }
    resetSlots();
    lanes = noLanes();
    written = { frame: 0, preview: 0, code: 0 };
    streamStart = null;
    phase = "rest";
    phaseUntil = clock + REST;
  };

  return {
    rebuild,
    tick: (elapsed, dt) => {
      clock = elapsed;
      spinner.tick(dt);

      const built = conn ?? build();
      if (!built) return;

      for (const shot of shots) shot.conn.throw.update(clock - shot.startT);
      shots = shots.filter((shot) => !shot.conn.throw.done);

      if (streamStart !== null) {
        const run = clock - streamStart;

        // Layout first, and fast: the divider and the grid rules are the room,
        // drawn before either half writes into it.
        written.frame = paintLane(
          lanes.frame,
          (run / SCAFFOLD) * (lanes.frame.length + WAVE),
          written.frame
        );

        if (run >= SCAFFOLD) {
          const write = run - SCAFFOLD;
          const codeHead = write / STEP;
          written.code = paintLane(lanes.code, codeHead, written.code);

          // The preview trails the code by a beat and then fills across what is
          // left of the run, so however many cells each half has, the write and
          // the render still land together.
          const span = (lanes.code.length + WAVE) * STEP;
          const render = write - PREVIEW_LAG;
          if (render > 0) {
            written.preview = paintLane(
              lanes.preview,
              (render / Math.max(span - PREVIEW_LAG, STEP)) *
                (lanes.preview.length + WAVE),
              written.preview
            );
          }

          if (write >= span) {
            settleLane(lanes.code);
            settleLane(lanes.preview);
            streamStart = null;
            phaseUntil = clock + LOADER_TAIL;
          }
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
        case "rest": {
          phase = "emit";
          phaseUntil = Number.POSITIVE_INFINITY;
          shots.push({ conn: built, startT: clock });
          built.throw.play({ onArrive: arriveBrowser });
          return;
        }
        case "stream": {
          endStream();
          return;
        }
        case "hold": {
          phase = "advance";
          advanceStart = clock;
          // Deactivate as the slide starts, not when it lands — the browser's
          // own 450ms transition then plays out under the travel.
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
