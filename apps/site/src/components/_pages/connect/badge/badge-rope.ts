import { Vector3 } from "three";
import type { BadgeTune } from "./badge-tune";

export const BADGE_CHAIN_BONES = 4;
export const BADGE_ROPE_POINTS = BADGE_CHAIN_BONES + 1;
export const CONSTRAINT_ITERS = 4;
export const SLEEP_EPS = 0.0009;
export const DRAG_LIMIT_UP = 0;
export const STRETCH_RETURN = 0.1;
export const BADGE_MAX_STRETCH = 1.55;
export const BADGE_MIN_STRETCH = 0.72;

export type RopeState = {
  now: Vector3[];
  prev: Vector3[];
  restPoints: Vector3[];
  rest: number;
  pin: Vector3;
  stretch: number;
};

export function snapRopeToRest(rope: RopeState) {
  for (let index = 0; index < rope.now.length; index += 1) {
    rope.now[index]!.copy(rope.restPoints[index]!);
    rope.prev[index]!.copy(rope.restPoints[index]!);
  }
}

export function ropeIsAsleep(rope: RopeState) {
  if (Math.abs(rope.stretch - 1) > 0.02) return false;
  let maxOff = 0;
  for (let index = 0; index < rope.now.length; index += 1) {
    const now = rope.now[index]!;
    const rest = rope.restPoints[index]!;
    const prev = rope.prev[index]!;
    maxOff = Math.max(
      maxOff,
      Math.hypot(now.x - rest.x, now.y - rest.y, now.z - rest.z),
      Math.hypot(now.x - prev.x, now.y - prev.y, now.z - prev.z)
    );
  }
  return maxOff < SLEEP_EPS;
}

function solveDistance(
  a: Vector3,
  b: Vector3,
  rest: number,
  pinA: boolean,
  pinB: boolean,
  stiffness: number
) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dz = b.z - a.z;
  const dist = Math.hypot(dx, dy, dz) || 0.0001;
  const shift = ((dist - rest) / dist) * stiffness;
  const px = dx * shift;
  const py = dy * shift;
  const pz = dz * shift;
  if (!pinA) {
    const scale = pinB ? 2 : 1;
    a.x += px * scale;
    a.y += py * scale;
    a.z += pz * scale;
  }
  if (!pinB) {
    const scale = pinA ? 2 : 1;
    b.x -= px * scale;
    b.y -= py * scale;
    b.z -= pz * scale;
  }
}

export function projectInextensible(rope: RopeState, rest = rope.rest) {
  const last = rope.now.length - 1;
  rope.now[last]!.copy(rope.pin);
  for (let index = last - 1; index >= 0; index -= 1) {
    const point = rope.now[index]!;
    const parent = rope.now[index + 1]!;
    const dx = point.x - parent.x;
    const dy = point.y - parent.y;
    const dz = point.z - parent.z;
    const dist = Math.hypot(dx, dy, dz) || 0.0001;
    const scale = rest / dist;
    point.x = parent.x + dx * scale;
    point.y = parent.y + dy * scale;
    point.z = parent.z + dz * scale;
  }
}

export function preventStrapCatch(rope: RopeState, tune: BadgeTune) {
  const last = rope.now.length - 1;
  const tip = rope.now[0]!;
  const pin = rope.now[last]!;
  const minHang = rope.rest * 0.45;
  if (tip.y > pin.y - minHang) tip.y = pin.y - minHang;

  for (let index = 1; index < last; index += 1) {
    const point = rope.now[index]!;
    const below = rope.now[index - 1]!;
    if (point.y < below.y + 0.001) point.y = below.y + 0.001;
  }

  const halfW = tune.cardWidth * 0.5;
  const foldY = 0.008;
  for (let index = 1; index < last; index += 1) {
    const point = rope.now[index]!;
    const relX = point.x - tip.x;
    const relY = point.y - tip.y;
    if (relY < foldY && Math.abs(relX) < halfW) {
      point.y = tip.y + foldY;
      const sign = Math.sign(relX) || Math.sign(tip.x) || 1;
      point.x = tip.x + sign * halfW;
    }
  }
}

export function applySway(rope: RopeState, follow: number) {
  const last = rope.now.length - 1;
  const tip = rope.now[0]!;
  for (let index = 1; index < last; index += 1) {
    const along = 1 - index / last;
    const lag = along * along;
    const point = rope.now[index]!;
    point.x += (tip.x * lag - point.x) * follow;
    point.z += (tip.z * lag - point.z) * follow;
  }
}

export function updateStretch(
  rope: RopeState,
  drag: Vector3 | null,
  dragLimitDown: number
) {
  const last = rope.now.length - 1;
  const total = Math.max(rope.rest * last, 1e-6);
  const tip = rope.now[0]!;
  const span = Math.hypot(
    tip.x - rope.pin.x,
    tip.y - rope.pin.y,
    tip.z - rope.pin.z
  );
  let target = Math.min(
    BADGE_MAX_STRETCH,
    Math.max(BADGE_MIN_STRETCH, span / total)
  );
  if (drag && drag.y < 0) {
    target = Math.max(target, 1 + Math.min(-drag.y, dragLimitDown) / total);
  }
  const mix = drag ? 0.28 : STRETCH_RETURN;
  rope.stretch += (target - rope.stretch) * mix;
}

export function constrainRope(
  rope: RopeState,
  drag: Vector3 | null,
  stiffness: number
) {
  const last = rope.now.length - 1;
  const rest = rope.rest * rope.stretch;
  for (let iter = 0; iter < CONSTRAINT_ITERS; iter += 1) {
    for (let index = 0; index < last; index += 1) {
      solveDistance(
        rope.now[index]!,
        rope.now[index + 1]!,
        rest,
        false,
        index + 1 === last,
        stiffness
      );
    }
    rope.now[last]!.copy(rope.pin);
    if (drag) {
      const tip = rope.now[0]!;
      tip.x += (drag.x - tip.x) * 0.18;
      tip.y += (drag.y - tip.y) * 0.16;
      tip.z += (drag.z - tip.z) * 0.18;
    }
  }
  projectInextensible(rope, rest);
  if (rope.stretch <= 1.01) {
    for (let index = 0; index < last; index += 1) {
      rope.prev[index]!.y = rope.now[index]!.y;
    }
  }
}

export function stepRope(
  rope: RopeState,
  drag: Vector3 | null,
  dt: number,
  reducedMotion: boolean,
  tune: BadgeTune
) {
  const last = rope.now.length - 1;
  if (reducedMotion) {
    snapRopeToRest(rope);
    return;
  }

  if (!drag && ropeIsAsleep(rope)) {
    snapRopeToRest(rope);
    return;
  }

  const gravity = tune.gravity * dt * dt;
  for (let index = 0; index < last; index += 1) {
    const point = rope.now[index]!;
    const previous = rope.prev[index]!;
    const damp = index === 0 ? tune.dampingTip : tune.dampingCord;
    const vx = (point.x - previous.x) * damp;
    const vy = (point.y - previous.y) * tune.dampingY;
    const vz = (point.z - previous.z) * damp;
    previous.copy(point);
    point.x += vx;
    point.y += vy + gravity;
    point.z += vz;
  }

  if (drag) {
    const tip = rope.now[0]!;
    tip.x += (drag.x - tip.x) * tune.dragFollow;
    tip.y += (drag.y - tip.y) * tune.dragFollow * 0.7;
    tip.z += (drag.z - tip.z) * tune.dragFollow;
  }

  updateStretch(rope, drag, tune.dragLimitDown);
  constrainRope(rope, drag, tune.constraintStiffness);

  if (!drag) {
    const tip = rope.now[0]!;
    tip.x += -tip.x * tune.restPull;
    tip.z += -tip.z * tune.restPull;
  }
  applySway(rope, tune.swayFollow);
  preventStrapCatch(rope, tune);
  projectInextensible(rope, rope.rest * rope.stretch);
  preventStrapCatch(rope, tune);
  rope.now[last]!.copy(rope.pin);
}
