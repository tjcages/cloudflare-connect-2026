export const INTRO_DELAY_MS = 500;

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
