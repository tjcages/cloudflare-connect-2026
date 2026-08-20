export const INTRO_DELAY_MS = 500;
export const POSE_LOG_MS = 1000;

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

export function logBadgePose(snapshot: BadgePoseSnapshot) {
  console.log("[badge-pose]", JSON.stringify(snapshot));
}

export function introDragTip(
  dragLimitX: number,
  inwardZ: number
): { x: number; z: number } {
  return { x: dragLimitX, z: -dragLimitX * inwardZ };
}

export function introHeldTwist(
  dragX: number,
  tune: {
    twistPos: number;
    twistMax: number;
    rollPos: number;
    rollMax: number;
  }
): { y: number; z: number } {
  const twist = Math.max(
    -tune.twistMax,
    Math.min(tune.twistMax, -dragX * tune.twistPos)
  );
  const roll = Math.max(
    -tune.rollMax,
    Math.min(tune.rollMax, dragX * tune.rollPos)
  );
  return { y: twist, z: roll };
}
