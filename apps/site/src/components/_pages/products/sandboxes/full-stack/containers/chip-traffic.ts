import { cubicBezier } from "motion";
import { Container } from "@/components/_animations/canvas2d/scene";
import { hitChip } from "@/components/_animations/shared/chips/dom";
import { createSceneSnake } from "@/components/_animations/shared/snake-pulse/canvas-snake";
import type { Point } from "@/components/_animations/shared/snake-pulse/geometry";
import { SAMPLES } from "@/components/_animations/shared/snake-pulse/sample-path";
import type { SnakeLayout } from "@/components/_animations/shared/snake-pulse/snake";
import type { WireGlobe } from "@/components/_animations/shared/globe/create-wire-globe";
import { pick, rnd } from "@/utils/random";

const POLE_END = Math.PI / 2 - 0.03;
const LAT_STEPS = [3, 4];
const ROUND_TRIP = 4.2;
const FADE_IN = 0.45;
const FADE_OUT = 0.18;
const EXIT_BLUR = 2;
const FIRST_SPREAD = 2;
const LIFE_MIN = 8;
const LIFE_MAX = 14;
const RESPAWN_MIN = 0.4;
const RESPAWN_MAX = 1.8;
const BLOCKED_RETRY = 0.25;
const GAP_MIN = 0.3;
const GAP_MAX = 1.1;
const MIN_DEPTH = 0.08;
const LIMB_DEPTH = 0.05;
const MIN_RUNWAY = (25 * Math.PI) / 180;
const RUNWAY_DEPTH = 0.05;
const MIN_GAP = 56;
const BAND_TOP = 104;
const BAND_BOTTOM = 236;
const CHIP_RADIUS = 24;
const EDGE_INSET = 40;
const BOX_HALF_WIDTH = 120;
const BOX_BOTTOM = 204;
const EASE = cubicBezier(0.6, 0.6, 0, 1);
const EXIT_EASE = cubicBezier(0.165, 0.84, 0.44, 1);
const HEAD_EASE = cubicBezier(0.76, 0, 0.24, 1);

type Chip = { wrapper: HTMLElement; inner: HTMLElement | null };

type SideKey = "left" | "right";

type Spot = { lat: number; lon: number; x: number; y: number };

type Live = {
  lat: number;
  lon: number;
  enterAt: number;
  dieAt: number;
  dismissedAt: number | null;
  duration: number;
  throwStart: number;
  side: SideKey | null;
  snake: ReturnType<typeof createSceneSnake> | null;
  points: Point[];
};

type Slot = { chip: Chip; live: Live | null; spawnAt: number | null };

type Side = { slot: Slot | null; nextAt: number };

export type ChipTraffic = {
  container: Container;
  tick: (elapsed: number) => void;
  visibleChips: () => HTMLElement[];
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

export function createChipTraffic(
  globe: WireGlobe,
  root: HTMLElement,
  width: number
): ChipTraffic {
  const container = new Container();

  let w = width;
  let now = 0;
  let orphans: Orphan[] = [];

  const slots: Slot[] = Array.from(
    root.querySelectorAll<HTMLElement>("[data-sandbox-chip]")
  ).map((wrapper) => ({
    chip: {
      wrapper,
      inner: wrapper.querySelector<HTMLElement>("[data-chip-id]"),
    },
    live: null,
    spawnAt: null,
  }));

  const sides: Record<SideKey, Side> = {
    left: { slot: null, nextAt: FADE_IN + rnd(GAP_MIN, GAP_MAX) },
    right: { slot: null, nextAt: FADE_IN + rnd(GAP_MIN, GAP_MAX) },
  };

  const stagger = (t: number) => {
    slots.forEach((slot, index) => {
      slot.spawnAt =
        t + ((index + rnd(0, 1)) * FIRST_SPREAD) / Math.max(slots.length, 1);
    });
  };

  stagger(0);

  const park = (chip: Chip) => {
    chip.wrapper.style.opacity = "0";
    chip.wrapper.style.removeProperty("filter");
    chip.wrapper.removeAttribute("data-active-container");
  };

  const clearOfBox = (x: number, y: number) =>
    x + CHIP_RADIUS < w / 2 - BOX_HALF_WIDTH ||
    x - CHIP_RADIUS > w / 2 + BOX_HALF_WIDTH ||
    y - CHIP_RADIUS > BOX_BOTTOM;

  const candidates = () => {
    const out: Spot[] = [];
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
          clearOfBox(p.x, p.y)
        ) {
          out.push({ lat, lon, x: p.x, y: p.y });
        }
      }
    }
    return out;
  };

  const traceMeridian = (lat: number, lon: number, into?: Point[]) => {
    const points = into ?? new Array<Point>(SAMPLES + 1);
    for (let i = 0; i <= SAMPLES; i++) {
      points[i] = globe.project(lat + (i / SAMPLES) * (POLE_END - lat), lon);
    }
    return points;
  };

  const taken = () =>
    slots.flatMap((slot) =>
      slot.live ? [globe.project(slot.live.lat, slot.live.lon)] : []
    );

  const spawn = (slot: Slot, t: number, pool: Spot[]) => {
    const clear = taken();
    const free = pool.filter((c) =>
      clear.every((q) => Math.hypot(q.x - c.x, q.y - c.y) > MIN_GAP)
    );
    if (free.length === 0) {
      slot.spawnAt = t + BLOCKED_RETRY;
      return;
    }
    const spot = pick(free);
    slot.spawnAt = null;
    slot.live = {
      lat: spot.lat,
      lon: spot.lon,
      enterAt: t,
      dieAt: t + rnd(LIFE_MIN, LIFE_MAX),
      dismissedAt: null,
      duration: ROUND_TRIP * Math.sqrt((POLE_END - spot.lat) / (Math.PI / 2)),
      throwStart: 0,
      side: null,
      snake: null,
      points: [],
    };
  };

  const releaseSide = (live: Live, t: number) => {
    if (!live.side) return;
    sides[live.side].slot = null;
    sides[live.side].nextAt = t + rnd(GAP_MIN, GAP_MAX);
    live.side = null;
  };

  const startThrow = (key: SideKey, t: number) => {
    const ready = slots.filter(
      (slot) =>
        slot.live &&
        !slot.live.snake &&
        slot.live.dismissedAt === null &&
        t - slot.live.enterAt >= FADE_IN &&
        (globe.project(slot.live.lat, slot.live.lon).x < w / 2
          ? "left"
          : "right") === key
    );
    if (ready.length === 0) {
      sides[key].nextAt = t + BLOCKED_RETRY;
      return;
    }
    const slot = pick(ready);
    const live = slot.live;
    if (!live) return;

    live.throwStart = t;
    live.side = key;
    sides[key].slot = slot;
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
  };

  const kill = (slot: Slot, t: number) => {
    const live = slot.live;
    if (live) {
      if (live.snake) {
        orphans.push({
          lat: live.lat,
          lon: live.lon,
          throwStart: live.throwStart,
          duration: live.duration,
          snake: live.snake,
          points: live.points,
        });
      }
      releaseSide(live, live.snake ? live.throwStart + live.duration : t);
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
    visibleChips: () =>
      slots.flatMap((slot) =>
        slot.live &&
        slot.live.dismissedAt === null &&
        now - slot.live.enterAt >= FADE_IN
          ? [slot.chip.wrapper]
          : []
      ),
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

      for (const slot of slots) {
        const live = slot.live;
        if (
          live &&
          live.dismissedAt !== null &&
          t - live.dismissedAt >= FADE_OUT
        ) {
          kill(slot, t);
          slot.spawnAt = t + rnd(RESPAWN_MIN, RESPAWN_MAX);
        }
      }

      const due = slots.filter(
        (slot) => !slot.live && slot.spawnAt !== null && t >= slot.spawnAt
      );
      if (due.length > 0) {
        const pool = candidates();
        for (const slot of due) spawn(slot, t, pool);
      }

      for (const slot of slots) {
        const live = slot.live;
        if (!live) continue;

        const p = globe.project(live.lat, live.lon);

        slot.chip.wrapper.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`;

        if (
          live.dismissedAt === null &&
          (p.depth < LIMB_DEPTH || t >= live.dieAt)
        ) {
          live.dismissedAt = t;
        }

        const fadeIn = EASE(
          Math.min(Math.max((t - live.enterAt) / FADE_IN, 0), 1)
        );
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

        if (live.snake) {
          traceMeridian(live.lat, live.lon, live.points);
          const jp = Math.min((t - live.throwStart) / live.duration, 1);
          const end = 1 + live.snake.body * 1.5;
          live.snake.placeHead(
            (jp < 0.5 ? HEAD_EASE(jp * 2) : HEAD_EASE(2 - jp * 2)) * end
          );
          if (jp >= 1) {
            live.snake.destroy();
            live.snake = null;
            releaseSide(live, t);
          }
        }
      }

      for (const key of ["left", "right"] as const) {
        if (sides[key].slot || t < sides[key].nextAt) continue;
        startThrow(key, t);
      }
    },
    resize(nextWidth) {
      w = nextWidth;
      for (const slot of slots) kill(slot, now);
      dropOrphans();
      for (const key of ["left", "right"] as const) {
        sides[key].slot = null;
        sides[key].nextAt = now + FADE_IN + rnd(GAP_MIN, GAP_MAX);
      }
      stagger(now);
    },
    destroy() {
      for (const slot of slots) {
        kill(slot, now);
        slot.chip.wrapper.style.removeProperty("transform");
      }
      dropOrphans();
      container.destroy({ children: true });
    },
  };
}
