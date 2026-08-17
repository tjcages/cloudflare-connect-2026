import { cubicBezier } from "motion";
import {
  createPulseThrow,
  type PulseThrow,
  throwArriveTime,
} from "./pulse-throw";
import type { SnakeFactory, SnakeLayout, ThrowableSnake } from "./snake";
import { pathLength } from "./snake-parts";

export const BULLET_SPEED = 96;
export const BULLET_EASE = cubicBezier(0.6, 0.6, 0, 1);
// The old default ease reached the split at 0.525 of its duration; the bullet
// reaches it at 0.321. Holding the difference after the hit keeps the beat of a
// hop the length it has always been, and re-derives itself if the ease moves.
export const BULLET_BEAT = 0.525;

export type BulletOptions = {
  width?: number;
  arrive?: number;
  exitDuration?: number;
  handoff?: number;
};

export type Bullet = {
  snake: ThrowableSnake;
  throw: PulseThrow;
  arriveT: number;
  dwell: number;
};

export const bulletDuration = (layout: SnakeLayout) =>
  pathLength(layout.points) / BULLET_SPEED;

export function createBullet(
  makeSnake: SnakeFactory,
  layout: SnakeLayout,
  color: string,
  targetColor: string = color,
  { width, arrive, exitDuration, handoff }: BulletOptions = {}
): Bullet {
  const snake = makeSnake(layout, color, targetColor, {
    taper: false,
    emergeMask: false,
    blunt: true,
    width,
  });
  const duration = bulletDuration(layout);
  const arriveT = throwArriveTime(duration, BULLET_EASE);
  return {
    snake,
    throw: createPulseThrow(snake, arrive ?? layout.endFraction, {
      duration,
      ease: BULLET_EASE,
      exitDuration,
      handoff,
    }),
    arriveT,
    dwell: Math.max(0, duration * BULLET_BEAT - arriveT),
  };
}
