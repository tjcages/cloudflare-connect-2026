export type Slot = { x: number; y: number };

export const STAGE_WIDTH = 480;
export const STAGE_HEIGHT = 240;
export const STAGE_CENTRE_Y = STAGE_HEIGHT / 2;
export const CHIP_RADIUS = 24;

// x is offset from the stage centre, y is measured from the stage top, both in
// the 480x240 design space. Two constraints on every centre:
//   - fully inside the stage: x 24..456, y 24..216 (no chip is ever clipped at
//     rest, so the frame edge never cuts one in half)
//   - clear of the 332x60 tray: y <= 66 or y >= 174, or |x| >= 190
export const SLOT_SETS: readonly (readonly Slot[])[] = [
  [
    { x: -140, y: 40 },
    { x: 154, y: 36 },
    { x: -178, y: 196 },
    { x: 140, y: 194 },
  ],
  [
    { x: -160, y: 52 },
    { x: 16, y: 36 },
    { x: 150, y: 192 },
  ],
  [
    { x: -198, y: 44 },
    { x: -64, y: 196 },
    { x: 44, y: 190 },
    { x: 124, y: 38 },
    { x: 196, y: 194 },
  ],
];

export const POOL_SIZE = Math.max(...SLOT_SETS.map((set) => set.length));

export const POOLS = ["a", "b"] as const;

export type PoolName = (typeof POOLS)[number];

export function slotOffset(slot: Slot): { x: number; y: number } {
  return { x: slot.x, y: slot.y - STAGE_CENTRE_Y };
}

// Departing chips keep full opacity, so they have to actually leave the frame.
// Walk the outward ray until the whole chip clears the stage bounds.
export function exitDistance(x: number, y: number): number {
  const length = Math.hypot(x, y) || 1;
  const ux = x / length;
  const uy = y / length;
  const limitX = STAGE_WIDTH / 2 + CHIP_RADIUS;
  const limitY = STAGE_HEIGHT / 2 + CHIP_RADIUS;

  const axis = (position: number, unit: number, limit: number) => {
    if (unit > 0) return (limit - position) / unit;
    if (unit < 0) return (-limit - position) / unit;
    return Number.POSITIVE_INFINITY;
  };

  return Math.min(axis(x, ux, limitX), axis(y, uy, limitY)) + CHIP_RADIUS;
}
