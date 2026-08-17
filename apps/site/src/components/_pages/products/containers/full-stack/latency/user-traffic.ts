import { cubicBezier } from "motion";
import { Container } from "@/components/_animations/canvas2d/scene";
import { hitChip } from "@/components/_animations/shared/chips/dom";
import { createSceneSnake } from "@/components/_animations/shared/snake-pulse/canvas-snake";
import type { Point } from "@/components/_animations/shared/snake-pulse/geometry";
import { SAMPLES } from "@/components/_animations/shared/snake-pulse/sample-path";
import type { SnakeLayout } from "@/components/_animations/shared/snake-pulse/snake";
import type { WireGlobe } from "@/components/_animations/shared/globe/create-wire-globe";
import { rnd } from "@/utils/random";

const POLE_END = Math.PI / 2 - 0.03;
// Both coordinates snap to the wire lattice: lat to a drawn parallel, lon to a
// drawn meridian. Nothing may sit or travel off the globe's own lines — a chip
// between lines reads as floating in front of the globe rather than standing on
// it, and a stripe off a meridian flies over the surface instead of lying on
// it. Because lon is fixed and the drawn meridian at that lon rotates by the
// same theta, a chip stays welded to its intersection for its whole life.
// Multiples of globe.parallelStep (15deg); 75 is unusable, since that parallel
// never leaves the browser's column, and below 45 the parallel passes under the
// stage floor.
const LAT_STEPS = [3, 4];
const ROUND_TRIP = 4.2;
// The mock shows five users, one of them behind the browser, so four visible is
// the design's own density — and four is also the largest conflict-free set the
// lattice offers at any rotation. Placement can still come up one short when a
// greedy pick blocks a neighbour, which is where the batch-to-batch variety
// comes from.
const BATCH_SIZE = 4;
const FADE_IN = 0.45;
// The exit is deliberately much shorter than the entry and carries a blur, so
// dismissing a batch reads as a snap rather than a slow dissolve.
const FADE_OUT = 0.18;
const EXIT_BLUR = 2;
// Every beat of a chip's life is offset by its own random amount rather than by
// its index: fixed steps this short read as one simultaneous event, which is
// exactly what a batch must not look like. Each chip therefore arrives, throws
// and leaves on its own clock.
const ENTER_SPREAD = 0.5;
const EXIT_SPREAD = 0.32;
// The first throw of a chip's batch, stratified like the other beats.
const THROW_MIN = 0.15;
const THROW_MAX = 0.9;
// Chips keep throwing for as long as the batch lives, resting a random beat
// between stripes. The gap is per throw rather than per chip, so chips that
// start together drift apart over the batch instead of pulsing in lockstep.
const GAP_MIN = 0.3;
const GAP_MAX = 1.1;
// Must stay clear of LIMB_DEPTH: a chip spawned between the two thresholds is
// marked for death on its first frame and fades out where it appeared, since
// the limb test cannot tell a chip rotating into view from one leaving it.
const MIN_DEPTH = 0.08;
const LIMB_DEPTH = 0.05;
// The globe turns 4deg/s, so a chip needs roughly this much longitude ahead of
// it to finish its throw before the limb fades it out. Checking depth at
// lon + MIN_RUNWAY also picks the entering side for free: a chip near the left
// limb is rotating into view and passes, one near the right limb is leaving
// and fails.
const MIN_RUNWAY = (25 * Math.PI) / 180;
const RUNWAY_DEPTH = 0.05;
const MIN_GAP = 56;
const BAND_TOP = 104;
const BAND_BOTTOM = 236;
const CHIP_RADIUS = 20;
// Keeps a chip clear of the stage's own edges: without it the browser exclusion
// is satisfied most easily out at x=0 and chips spawn half-clipped in the
// corners. 40 is the tightest the batch can afford — because placements are on
// the lattice, the candidate set rotates with the globe, and at 56 the largest
// conflict-free set collapses to 2 for 7 of every 12 degrees of spin, so batch
// sizes visibly pulsed. At 40 it holds at 4 through a whole revolution.
const EDGE_INSET = 40;
const BROWSER_HALF_WIDTH = 104;
// The mock tucks a chip 13px off the browser's edge, so this stays small; a
// wide margin is what pushes chips out to the corners.
const BROWSER_MARGIN = 8;
// Hoisted unlike component style code: these run inside the rAF loop, where
// cubicBezier() would build a fresh solver every frame.
const EASE = cubicBezier(0.6, 0.6, 0, 1);
// Quart-out, the house curve for sub-0.3s UI transitions.
const EXIT_EASE = cubicBezier(0.165, 0.84, 0.44, 1);
const HEAD_EASE = cubicBezier(0.76, 0, 0.24, 1);

type Chip = { wrapper: HTMLElement; inner: HTMLElement | null };

type Live = {
  lat: number;
  lon: number;
  // Absolute times, not offsets from a shared batch start — each chip runs on
  // its own clock.
  enterAt: number;
  nextThrowAt: number;
  throwStart: number;
  exitOffset: number;
  duration: number;
  dismissedAt: number | null;
  snake: ReturnType<typeof createSceneSnake> | null;
  points: Point[];
};

type Slot = { chip: Chip; live: Live | null };

export type UserTraffic = {
  container: Container;
  tick: (elapsed: number) => void;
  // Dismisses the whole batch and queues the next one. Called on the content
  // swap so users and app content change together.
  cycle: (elapsed: number) => void;
  resize: (width: number) => void;
  destroy: () => void;
};

type Orphan = {
  lat: number;
  lon: number;
  throwStart: number;
  duration: number;
  snake: ReturnType<typeof createSceneSnake>;
  points: Point[];
};

export function createUserTraffic(
  globe: WireGlobe,
  root: HTMLElement,
  width: number
): UserTraffic {
  const container = new Container();

  let w = width;
  let now = 0;
  // Stripes whose chip has been dismissed mid-flight. They finish their arc on
  // their own rather than being cut, which is what lets a chip keep throwing
  // right up to the end of its batch — gating throws on "will this finish
  // first?" left the tail of every cycle silent.
  let orphans: Orphan[] = [];
  // The first batch lands on the first frame; after that the caller's cycle()
  // drives every change.
  let spawnAt: number | null = 0;

  const slots: Slot[] = Array.from(
    root.querySelectorAll<HTMLElement>("[data-latency-chip]")
  ).map((wrapper) => ({
    chip: {
      wrapper,
      inner: wrapper.querySelector<HTMLElement>("[data-chip-id]"),
    },
    live: null,
  }));

  const park = (chip: Chip) => {
    chip.wrapper.style.opacity = "0";
    // Removed rather than zeroed: a blur(0px) still forces a compositing layer
    // for every parked chip.
    chip.wrapper.style.removeProperty("filter");
  };

  // Every chip in the mock sits in the outer bands either side of the browser
  // (x = 86, 102 on the left; 386, 402 on the right; the fifth is hidden behind
  // it) and the centre-bottom is left to the bare lattice. So the browser
  // excludes its whole column, not just the band beside it.
  const clearOfBrowser = (x: number) =>
    x + CHIP_RADIUS < w / 2 - BROWSER_HALF_WIDTH - BROWSER_MARGIN ||
    x - CHIP_RADIUS > w / 2 + BROWSER_HALF_WIDTH + BROWSER_MARGIN;

  // Every lattice intersection that is currently placeable. The set rotates
  // with the globe, so it is rebuilt per batch rather than cached.
  const candidates = () => {
    const out: { lat: number; lon: number; x: number; y: number }[] = [];
    const meridians = Math.round((Math.PI * 2) / globe.meridianStep);
    for (const step of LAT_STEPS) {
      const lat = globe.parallelStep * step;
      for (let k = 0; k < meridians; k++) {
        const lon = globe.meridianStep * k;
        const p = globe.project(lat, lon);
        if (
          p.depth > MIN_DEPTH &&
          globe.project(lat, lon + MIN_RUNWAY).depth > RUNWAY_DEPTH &&
          p.y >= BAND_TOP &&
          p.y <= BAND_BOTTOM &&
          p.x >= EDGE_INSET &&
          p.x <= w - EDGE_INSET &&
          clearOfBrowser(p.x)
        ) {
          out.push({ lat, lon, x: p.x, y: p.y });
        }
      }
    }
    return out;
  };

  // Candidates cluster tightly along each parallel, so one unlucky pick can
  // block two others. Greedy over a few random orders reliably reaches the
  // largest conflict-free set, where a single pass often came up short.
  const chooseBatch = () => {
    const pool = candidates();
    let best: ReturnType<typeof candidates> = [];
    for (let attempt = 0; attempt < 8 && best.length < BATCH_SIZE; attempt++) {
      const order = pool
        .map((c) => ({ c, k: Math.random() }))
        .sort((a, b) => a.k - b.k)
        .map((entry) => entry.c);
      const picked: ReturnType<typeof candidates> = [];
      for (const c of order) {
        if (picked.length >= BATCH_SIZE) break;
        if (picked.every((q) => Math.hypot(q.x - c.x, q.y - c.y) > MIN_GAP)) {
          picked.push(c);
        }
      }
      if (picked.length > best.length) best = picked;
    }
    return best;
  };

  // Traces the drawn meridian the chip stands on, at constant lon, so the
  // stripe lies exactly along a globe line for its whole length instead of
  // cutting across the surface. Starting at the chip's own latitude also puts
  // the first stretch under the 40px circle, so it reads as thrown from beneath
  // the chip rather than from a gap above it.
  const traceMeridian = (lat: number, lon: number, into?: Point[]) => {
    const points = into ?? new Array<Point>(SAMPLES + 1);
    for (let i = 0; i <= SAMPLES; i++) {
      points[i] = globe.project(lat + (i / SAMPLES) * (POLE_END - lat), lon);
    }
    return points;
  };

  const spawnBatch = (t: number) => {
    const spots = chooseBatch();
    const free = slots.filter((slot) => !slot.live);
    const count = Math.min(spots.length, free.length);
    // Stratified, not plain uniform: each chip draws from its own band of the
    // spread, so no two ever land on top of each other. Plain rnd() regularly
    // produced batches like [0, 0, 0.02, 0.03] — random on paper, simultaneous
    // on screen. The three orders are shuffled independently, so a chip that
    // arrives first has no particular claim on throwing or leaving first.
    const bands = (spread: number, from = 0) => {
      const order = Array.from({ length: count }, (_, i) => i)
        .map((v) => ({ v, k: Math.random() }))
        .sort((a, b) => a.k - b.k);
      return order.map(
        ({ v }) => from + ((v + rnd(0, 1)) * spread) / Math.max(count, 1)
      );
    };
    const enters = bands(ENTER_SPREAD);
    const throws = bands(THROW_MAX - THROW_MIN, THROW_MIN);
    const exits = bands(EXIT_SPREAD);

    spots.forEach((spot, index) => {
      const slot = free[index];
      if (!slot) return;
      const enterAt = t + enters[index];
      slot.live = {
        lat: spot.lat,
        lon: spot.lon,
        enterAt,
        nextThrowAt: enterAt + throws[index],
        throwStart: 0,
        exitOffset: exits[index],
        duration: ROUND_TRIP * Math.sqrt((POLE_END - spot.lat) / (Math.PI / 2)),
        dismissedAt: null,
        snake: null,
        points: [],
      };
    });
  };

  const kill = (slot: Slot) => {
    const live = slot.live;
    if (live?.snake) {
      orphans.push({
        lat: live.lat,
        lon: live.lon,
        throwStart: live.throwStart,
        duration: live.duration,
        snake: live.snake,
        points: live.points,
      });
    }
    slot.live = null;
    park(slot.chip);
  };

  const dropOrphans = () => {
    for (const orphan of orphans) orphan.snake.destroy();
    orphans = [];
  };

  return {
    container,
    cycle(t) {
      const living = slots.filter((slot) => slot.live);
      let last = t;
      for (const slot of living) {
        if (!slot.live || slot.live.dismissedAt !== null) continue;
        const at = t + slot.live.exitOffset;
        slot.live.dismissedAt = at;
        last = Math.max(last, at);
      }
      // The whole outgoing wave clears before the new batch lands, so the two
      // never overlap on screen.
      spawnAt = living.length > 0 ? last + FADE_OUT : t;
    },
    tick(t) {
      now = t;

      orphans = orphans.filter((orphan) => {
        traceMeridian(orphan.lat, orphan.lon, orphan.points);
        const jp = Math.min((t - orphan.throwStart) / orphan.duration, 1);
        const end = 1 + orphan.snake.body * 1.5;
        orphan.snake.placeHead(
          (jp < 0.5 ? HEAD_EASE(jp * 2) : HEAD_EASE(2 - jp * 2)) * end
        );
        if (jp < 1) return true;
        orphan.snake.destroy();
        return false;
      });

      // Reap the dismissed batch BEFORE spawning: its chips are killed on the
      // same frame the next batch lands, and while they are still in slot.live
      // their stale positions block the new placements.
      for (const slot of slots) {
        const live = slot.live;
        if (
          live &&
          live.dismissedAt !== null &&
          t - live.dismissedAt >= FADE_OUT
        ) {
          kill(slot);
        }
      }

      if (spawnAt !== null && t >= spawnAt) {
        spawnBatch(t);
        spawnAt = null;
      }

      for (const slot of slots) {
        const live = slot.live;
        if (!live) continue;

        const p = globe.project(live.lat, live.lon);

        slot.chip.wrapper.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`;

        if (p.depth < LIMB_DEPTH && live.dismissedAt === null) {
          live.dismissedAt = t;
        }

        const fadeIn = EASE(
          Math.min(Math.max((t - live.enterAt) / FADE_IN, 0), 1)
        );
        // Clamped at the low end too: a staggered dismissal sits in the future
        // for every chip but the first, so the raw ratio starts negative.
        const exit =
          live.dismissedAt === null
            ? 0
            : EXIT_EASE(
                Math.min(Math.max((t - live.dismissedAt) / FADE_OUT, 0), 1)
              );
        slot.chip.wrapper.style.opacity = (fadeIn * (1 - exit)).toFixed(3);
        if (exit > 0) {
          slot.chip.wrapper.style.filter = `blur(${(EXIT_BLUR * exit).toFixed(2)}px)`;
        }

        if (!live.snake && live.dismissedAt === null && t >= live.nextThrowAt) {
          live.throwStart = t;
          if (slot.chip.inner) hitChip(slot.chip.inner);
          const points = traceMeridian(live.lat, live.lon);
          const layout: SnakeLayout = {
            points,
            from: { ...points[0], side: "left" },
            to: { ...points[SAMPLES], side: "left" },
            endFraction: 1,
          };
          live.points = points;
          live.snake = createSceneSnake(layout, "orange", "orange", {
            emergeMask: false,
            width: 2,
          });
          container.addChild(live.snake);
        }

        if (live.snake) {
          traceMeridian(live.lat, live.lon, live.points);
          const jp = Math.min((t - live.throwStart) / live.duration, 1);
          const end = 1 + live.snake.body * 1.5;
          const head =
            (jp < 0.5 ? HEAD_EASE(jp * 2) : HEAD_EASE(2 - jp * 2)) * end;
          live.snake.placeHead(head);
          if (jp >= 1) {
            live.snake.destroy();
            live.snake = null;
            live.nextThrowAt = t + rnd(GAP_MIN, GAP_MAX);
          }
        }
      }
    },
    resize(nextWidth) {
      w = nextWidth;
      for (const slot of slots) kill(slot);
      // Their meridians are about to be re-projected against a new width, so
      // in-flight stripes go rather than snapping across the stage.
      dropOrphans();
      spawnAt = now;
    },
    destroy() {
      for (const slot of slots) {
        kill(slot);
        slot.chip.wrapper.style.removeProperty("transform");
      }
      dropOrphans();
      container.destroy({ children: true });
    },
  };
}
