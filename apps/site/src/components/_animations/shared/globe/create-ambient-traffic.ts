import { cubicBezier } from "motion";
import { Container } from "@/components/_animations/canvas2d/scene";
import type { Point } from "@/components/_animations/shared/snake-pulse/geometry";
import { SAMPLES } from "@/components/_animations/shared/snake-pulse/sample-path";
import { createSceneSnake } from "@/components/_animations/shared/snake-pulse/canvas-snake";
import type { SnakeLayout } from "@/components/_animations/shared/snake-pulse/snake";
import type { WireGlobe } from "./create-wire-globe";

const POLE_END = Math.PI / 2 - 0.03;
const AIM_LAT = (70 * Math.PI) / 180;
const SPREAD_LAT = (45 * Math.PI) / 180;
const FLOOR_LAT = (24 * Math.PI) / 180;
const LAT_STEP = (1.5 * Math.PI) / 180;
const RUNWAY = 34;
const TRIP = 3.2;
const SLOT_COUNT = 5;
const MIN_DEPTH = 0.38;
const MIN_OFFSET = 44;
const MIN_GAP = 48;
const HEAD_EASE = cubicBezier(0.76, 0, 0.24, 1);

type Live = {
  lon: number;
  lat0: number;
  born: number;
  trip: number;
  snake: ReturnType<typeof createSceneSnake>;
  points: Point[];
};

type Slot = { live: Live | null; respawnAt: number };

export function createAmbientTraffic(globe: WireGlobe, height: number) {
  const container = new Container();

  let h = height;
  let now = 0;

  const slots: Slot[] = Array.from({ length: SLOT_COUNT }, (_, i) => ({
    live: null,
    respawnAt: 0.3 + i * 0.5 + Math.random() * 0.5,
  }));

  const clearOf = (x: number) =>
    slots.every(
      (s) =>
        !s.live ||
        Math.abs(globe.project(SPREAD_LAT, s.live.lon).x - x) > MIN_GAP
    );

  const pickLon = () => {
    const poleX = globe.project(Math.PI / 2, 0).x;
    for (let i = 0; i < 120; i++) {
      const lon =
        globe.meridianStep *
        Math.floor((Math.random() * Math.PI * 2) / globe.meridianStep);
      const p = globe.project(AIM_LAT, lon);
      if (
        p.depth > MIN_DEPTH &&
        Math.abs(p.x - poleX) > MIN_OFFSET &&
        clearOf(globe.project(SPREAD_LAT, lon).x)
      ) {
        return lon;
      }
    }
    return null;
  };

  const launchLat = (lon: number) => {
    for (let lat = POLE_END; lat > FLOOR_LAT; lat -= LAT_STEP) {
      if (globe.project(lat, lon).y > h + RUNWAY) return lat;
    }
    return FLOOR_LAT;
  };

  const traceMeridian = (lon: number, lat0: number, into?: Point[]) => {
    const points = into ?? new Array<Point>(SAMPLES + 1);
    for (let i = 0; i <= SAMPLES; i++) {
      points[i] = globe.project(lat0 + (i / SAMPLES) * (POLE_END - lat0), lon);
    }
    return points;
  };

  const spawn = (slot: Slot, t: number) => {
    const lon = pickLon();
    if (lon === null) {
      slot.respawnAt = t + 0.4;
      return;
    }

    const lat0 = launchLat(lon);
    const points = traceMeridian(lon, lat0);
    const layout: SnakeLayout = {
      points,
      from: { ...points[0], side: "left" },
      to: { ...points[SAMPLES], side: "left" },
      endFraction: 1,
    };
    const snake = createSceneSnake(layout, "orange", "orange", {
      emergeMask: false,
      width: 2,
    });
    container.addChild(snake);

    slot.live = {
      lon,
      lat0,
      born: t,
      trip: TRIP * (0.8 + Math.random() * 0.5),
      snake,
      points,
    };
  };

  const kill = (slot: Slot, t: number) => {
    slot.live?.snake.destroy();
    slot.live = null;
    slot.respawnAt = t + 0.2 + Math.random() * 1.5;
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
        traceMeridian(live.lon, live.lat0, live.points);

        const progress = Math.min((t - live.born) / live.trip, 1);
        const end = 1 + live.snake.body * 1.5;
        const head =
          (progress < 0.5
            ? HEAD_EASE(progress * 2)
            : HEAD_EASE(2 - progress * 2)) * end;
        live.snake.placeHead(head);

        if (progress >= 1) kill(slot, t);
      }
    },
    resize(_width: number, nextHeight: number) {
      h = nextHeight;
      for (const slot of slots) {
        if (slot.live) kill(slot, now);
      }
    },
    destroy() {
      for (const slot of slots) slot.live?.snake.destroy();
      container.destroy({ children: true });
    },
  };
}
