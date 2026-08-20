export const INTRO_DELAY_MS = 500;
export const INTRO_FADE_MS = 800;
export const INTRO_ROPE_POINTS = 9;

export type BadgePosePoint = { x: number; y: number; z: number };

export type BadgePoseVec3 = {
  x: number;
  y: number;
  z: number;
};

export type BadgePoseSnapshot = {
  event: "down" | "hold" | "up";
  heldMs: number;
  drag: BadgePosePoint | null;
  dragOffset: BadgePosePoint;
  hang: BadgePosePoint;
  tip: BadgePosePoint;
  prev: BadgePosePoint;
  stretch: number;
  card: BadgePosePoint & { rx: number; ry: number; rz: number };
  rope: BadgePosePoint[];
};

export function roundPose(value: number): number {
  return Math.round(value * 10000) / 10000;
}

export function posePoint(x: number, y: number, z: number): BadgePosePoint {
  return { x: roundPose(x), y: roundPose(y), z: roundPose(z) };
}

export function hangingRope(
  tip: BadgePosePoint,
  pin: BadgePosePoint,
  count: number
): BadgePosePoint[] {
  const last = Math.max(count - 1, 1);
  return Array.from({ length: count }, (_, index) => {
    const along = (last - index) / last;
    return posePoint(
      pin.x + (tip.x - pin.x) * along,
      pin.y + (tip.y - pin.y) * along,
      pin.z + (tip.z - pin.z) * along
    );
  });
}

export function hangingStretch(
  tip: BadgePosePoint,
  pin: BadgePosePoint
): number {
  const rest = Math.abs(pin.y) || 1;
  return roundPose(
    Math.hypot(tip.x - pin.x, tip.y - pin.y, tip.z - pin.z) / rest
  );
}

export function cardBottomDragOffsetY(
  tipY: number,
  cardHeight: number,
  cardOverlap: number
): number {
  const centerY = -(cardHeight / 2) + cardOverlap;
  const bottomY = centerY - cardHeight / 2;
  return roundPose(tipY - bottomY);
}

export const INTRO_PIN: BadgePosePoint = { x: 0, y: 0.1256, z: 0 };
export const INTRO_TIP: BadgePosePoint = { x: 0.0839, y: -0.04, z: -0.0168 };

const INTRO_ROPE = hangingRope(INTRO_TIP, INTRO_PIN, INTRO_ROPE_POINTS);

export const INTRO_POSE: BadgePoseSnapshot = {
  event: "hold",
  heldMs: 7072,
  drag: { x: 0.28, y: -0.04, z: -0.056 },
  dragOffset: {
    x: 0,
    y: cardBottomDragOffsetY(INTRO_TIP.y, 0.158, -0.025),
    z: 0,
  },
  hang: { x: 1.7925, y: 2.0232, z: 0 },
  tip: INTRO_TIP,
  prev: posePoint(INTRO_TIP.x, INTRO_TIP.y + 0.0001, INTRO_TIP.z),
  stretch: hangingStretch(INTRO_TIP, INTRO_PIN),
  card: { x: 0, y: -0.104, z: 0.006, rx: 0, ry: -0.2934, rz: 0.0352 },
  rope: INTRO_ROPE,
};

function copyPoint(point: BadgePoseVec3): BadgePosePoint {
  return posePoint(point.x, point.y, point.z);
}

export function captureBadgePose(input: {
  event: BadgePoseSnapshot["event"];
  heldMs: number;
  drag: BadgePoseVec3 | null;
  dragOffset: BadgePoseVec3;
  hang: BadgePoseVec3;
  card: { position: BadgePoseVec3; rotation: BadgePoseVec3 };
  rope: {
    now: readonly BadgePoseVec3[];
    prev: readonly BadgePoseVec3[];
    stretch: number;
  };
}): BadgePoseSnapshot {
  const tip = input.rope.now[0] ?? { x: 0, y: 0, z: 0 };
  const prev = input.rope.prev[0] ?? tip;
  return {
    event: input.event,
    heldMs: Math.round(input.heldMs),
    drag: input.drag ? copyPoint(input.drag) : null,
    dragOffset: copyPoint(input.dragOffset),
    hang: copyPoint(input.hang),
    tip: copyPoint(tip),
    prev: copyPoint(prev),
    stretch: roundPose(input.rope.stretch),
    card: {
      ...copyPoint(input.card.position),
      rx: roundPose(input.card.rotation.x),
      ry: roundPose(input.card.rotation.y),
      rz: roundPose(input.card.rotation.z),
    },
    rope: input.rope.now.map((point) => copyPoint(point)),
  };
}

export function applyPoseToRope(
  rope: {
    now: BadgePoseVec3[];
    prev: BadgePoseVec3[];
    stretch: number;
  },
  pose: BadgePoseSnapshot
) {
  const count = Math.min(pose.rope.length, rope.now.length, rope.prev.length);
  for (let index = 0; index < count; index += 1) {
    const point = pose.rope[index]!;
    rope.now[index]!.x = point.x;
    rope.now[index]!.y = point.y;
    rope.now[index]!.z = point.z;
    rope.prev[index]!.x = point.x;
    rope.prev[index]!.y = point.y;
    rope.prev[index]!.z = point.z;
  }
  if (rope.prev[0]) {
    rope.prev[0].x = pose.prev.x;
    rope.prev[0].y = pose.prev.y;
    rope.prev[0].z = pose.prev.z;
  }
  rope.stretch = pose.stretch;
}

export function applyPoseToCard(
  card: { position: BadgePoseVec3; rotation: BadgePoseVec3 },
  pose: BadgePoseSnapshot
) {
  card.position.x = pose.card.x;
  card.position.y = pose.card.y;
  card.position.z = pose.card.z;
  card.rotation.x = pose.card.rx;
  card.rotation.y = pose.card.ry;
  card.rotation.z = pose.card.rz;
}

export function applyIntroPose(
  rope: {
    now: BadgePoseVec3[];
    prev: BadgePoseVec3[];
    stretch: number;
  },
  card: { position: BadgePoseVec3; rotation: BadgePoseVec3 }
) {
  applyPoseToRope(rope, INTRO_POSE);
  applyPoseToCard(card, INTRO_POSE);
}
