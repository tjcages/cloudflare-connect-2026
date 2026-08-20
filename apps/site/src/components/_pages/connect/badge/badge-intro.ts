/** Pendulum angle from hanging straight down. Almost 90° to the right. */
export const INTRO_ANGLE = Math.PI * 0.48;
/** Extra card yaw, as if the badge itself was twisted then released. */
export const INTRO_YAW = Math.PI * 0.48;
export const INTRO_ROLL = 0.1;
export const INTRO_YAW_DECAY = 0.985;
export const INTRO_DELAY_MS = 500;

export function introRopePoint(
  pin: { x: number; y: number; z: number },
  length: number,
  along: number,
  angle = INTRO_ANGLE
): { x: number; y: number; z: number } {
  const dist = along * length;
  return {
    x: pin.x + Math.sin(angle) * dist,
    y: pin.y - Math.cos(angle) * dist,
    z: pin.z,
  };
}
