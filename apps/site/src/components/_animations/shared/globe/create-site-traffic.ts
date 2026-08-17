import { cubicBezier } from "motion";
import { Container, Graphics } from "@/components/_animations/canvas2d/scene";
import type { Point } from "@/components/_animations/shared/snake-pulse/geometry";
import {
  resolveColor,
  resolveDynamicColor,
} from "@/components/_animations/shared/snake-pulse/resolve-color";
import { SAMPLES } from "@/components/_animations/shared/snake-pulse/sample-path";
import { createSceneSnake } from "@/components/_animations/shared/snake-pulse/canvas-snake";
import type { SnakeLayout } from "@/components/_animations/shared/snake-pulse/snake";
import type { WireGlobe } from "./create-wire-globe";

const ROUND_TRIP = 5.5;
const THROW_LIFT = 0.04;
const POLE_END = Math.PI / 2 - 0.03;
const SLOT_COUNT = 6;
const MAX_LIVE = 5;
const FADE = 0.45;
const BUMP_KEYS = [1, 0.95, 1.025, 1];
const BUMP_DELAY = 0.2;
const BUMP_DURATION = 0.45;
const EASE = cubicBezier(0.6, 0.6, 0, 1);
const HEAD_EASE = cubicBezier(0.76, 0, 0.24, 1);

type SiteColor = "purple" | "orange";

type Live = {
  lat: number;
  lon: number;
  color: SiteColor;
  dot: Graphics;
  born: number;
  life: number;
  bumpAt: number;
  throwAt: number;
  duration: number;
  thrown: boolean;
  hit: boolean;
  snake: ReturnType<typeof createSceneSnake> | null;
  points: Point[];
};

type Slot = {
  side: "left" | "right";
  live: Live | null;
  respawnAt: number;
};

export function createSiteTraffic(globe: WireGlobe, width: number) {
  const container = new Container();
  const trails = new Container();
  const dots = new Container();
  container.addChild(trails, dots);

  let w = width;
  let now = 0;

  const slots: Slot[] = Array.from({ length: SLOT_COUNT }, (_, i) => ({
    side: i % 2 ? ("right" as const) : ("left" as const),
    live: null,
    respawnAt: 0.3 + i * 0.5 + Math.random() * 2,
  }));

  const clearOf = (x: number, y: number) =>
    slots.every((s) => {
      if (!s.live) return true;
      const q = globe.project(s.live.lat, s.live.lon);
      return Math.hypot(q.x - x, q.y - y) > 48;
    });

  const place = (side: "left" | "right") => {
    const x0 = side === "left" ? 40 : w / 2 + 50;
    const x1 = side === "left" ? w / 2 - 50 : w - 40;
    for (let i = 0; i < 200; i++) {
      const lat = globe.parallelStep * Math.floor(Math.random() * 6);
      const lon =
        globe.meridianStep *
        Math.floor((Math.random() * Math.PI * 2) / globe.meridianStep);
      const p = globe.project(lat, lon);
      if (
        p.depth > 0.15 &&
        p.x >= x0 &&
        p.x <= x1 &&
        p.y >= 235 &&
        p.y <= 300 &&
        clearOf(p.x, p.y)
      ) {
        return { lat, lon };
      }
    }
    return null;
  };

  const makeDot = (color: SiteColor) => {
    const g = new Graphics();
    g.circle(0, 0, 10).stroke({
      width: 1,
      color: resolveColor(color, 600),
      alpha: 0.1,
    });
    g.circle(0, 0, 1).fill(resolveDynamicColor(color, 1));
    g.alpha = 0;
    return g;
  };

  const buildMeridian = (lat: number, lon: number): SnakeLayout => {
    const points = Array.from({ length: SAMPLES + 1 }, (_, i) =>
      globe.project(lat + (i / SAMPLES) * (POLE_END - lat), lon)
    );
    const from = { ...points[0], side: "left" as const };
    const to = { ...points[SAMPLES], side: "left" as const };
    return { points, from, to, endFraction: 1 };
  };

  const spawn = (slot: Slot, t: number) => {
    if (slots.filter((s) => s.live).length >= MAX_LIVE) {
      slot.respawnAt = t + 0.5 + Math.random();
      return;
    }
    const spot = place(slot.side);
    if (!spot) {
      slot.respawnAt = t + 0.5;
      return;
    }

    const purples = slots.filter((s) => s.live?.color === "purple").length;
    const oranges = slots.filter((s) => s.live?.color === "orange").length;
    const color: SiteColor =
      purples === oranges
        ? Math.random() < 0.5
          ? "purple"
          : "orange"
        : purples < oranges
          ? "purple"
          : "orange";

    const throwAt = 0.5 + Math.random() * 0.8;
    const duration =
      ROUND_TRIP *
      Math.sqrt((POLE_END - spot.lat - THROW_LIFT) / (Math.PI / 2));

    const dot = makeDot(color);
    dots.addChild(dot);
    slot.live = {
      ...spot,
      color,
      dot,
      born: t,
      life: throwAt + duration + 0.4 + Math.random() * 0.4,
      bumpAt: -1,
      throwAt,
      duration,
      thrown: false,
      hit: false,
      snake: null,
      points: [],
    };
  };

  const kill = (slot: Slot, t: number) => {
    slot.live?.snake?.destroy();
    slot.live?.dot.destroy();
    slot.live = null;
    slot.respawnAt = t + 0.4 + Math.random() * 1.2;
  };

  return {
    container,
    tick(t: number) {
      now = t;
      for (const slot of slots) {
        if (!slot.live) {
          if (t >= slot.respawnAt) spawn(slot, t);
          continue;
        }

        const live = slot.live;
        const age = t - live.born;
        const p = globe.project(live.lat, live.lon);
        live.dot.position.set(p.x, p.y);

        if (p.depth < 0.05) live.life = Math.min(live.life, age + FADE);

        const fadeIn = EASE(Math.min(age / FADE, 1));
        const fadeOut = EASE(Math.min(Math.max(live.life - age, 0) / FADE, 1));
        live.dot.alpha = fadeIn * fadeOut;

        if (!live.thrown && age >= live.throwAt) {
          live.thrown = true;
          live.bumpAt = t + BUMP_DELAY;
          const layout = buildMeridian(live.lat + THROW_LIFT, live.lon);
          live.snake = createSceneSnake(layout, live.color, live.color, {
            emergeMask: false,
            width: 2,
          });
          live.points = layout.points;
          trails.addChild(live.snake);
        }

        if (live.snake) {
          const lat0 = live.lat + THROW_LIFT;
          for (let i = 0; i <= SAMPLES; i++) {
            live.points[i] = globe.project(
              lat0 + (i / SAMPLES) * (POLE_END - lat0),
              live.lon
            );
          }
          const jp = Math.min((age - live.throwAt) / live.duration, 1);
          const end = 1 + live.snake.body * 1.5;
          const head =
            (jp < 0.5 ? HEAD_EASE(jp * 2) : HEAD_EASE(2 - jp * 2)) * end;
          live.snake.placeHead(head);
          if (!live.hit && jp > 0.5 && head <= live.snake.body) {
            live.hit = true;
            live.bumpAt = t;
          }
          if (jp >= 1) {
            live.snake.destroy();
            live.snake = null;
          }
        }

        let bump = 1;
        if (
          live.bumpAt >= 0 &&
          t >= live.bumpAt &&
          t - live.bumpAt < BUMP_DURATION
        ) {
          const bp = EASE((t - live.bumpAt) / BUMP_DURATION) * 3;
          const seg = Math.min(Math.floor(bp), 2);
          bump =
            BUMP_KEYS[seg] + (BUMP_KEYS[seg + 1] - BUMP_KEYS[seg]) * (bp - seg);
        }
        live.dot.scale.set((0.6 + 0.4 * fadeIn * fadeOut) * bump);

        if (age >= live.life) kill(slot, t);
      }
    },
    resize(width: number, _height: number) {
      w = width;
      for (const slot of slots) {
        if (slot.live) kill(slot, now);
      }
    },
    destroy() {
      for (const slot of slots) {
        slot.live?.snake?.destroy();
        slot.live?.dot.destroy();
        slot.live = null;
      }
      container.destroy({ children: true });
    },
  };
}
