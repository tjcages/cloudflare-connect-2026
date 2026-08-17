import { cubicBezier } from "motion";
import type { Point } from "./geometry";
import { clamp, smoothstep } from "./math";

const PARTS = 9;
const W_MIN = 1;
const LENGTHS = [13, 7, 9, 8, 7];
const SHADES = [1, 2, 3, 4, 5];
const TURN = 0.45;
const STAGGER = 0.05;
const TINT_EASE = cubicBezier(0.6, 0.6, 0, 1);

export const BODY = 64;
export const TAPER = 20;
export const W_MAX = 3;
export const RAMP_STEPS = 32;

export type SnakeOptions = {
  taper?: boolean;
  emergeMask?: boolean;
  blunt?: boolean;
  width?: number;
  /** Fade lengths in px for the emerge mask, per end. Edge connectors fade over
   * the tail of their line rather than a hairline. */
  sourceFade?: number;
  targetFade?: number;
};

export type SnakePart = {
  distance: number;
  position: number;
  width: number;
  half: number;
  rank: number;
  shade: number;
};

export type PartPlacement = {
  visible: boolean;
  segmentStart: number;
  segmentEnd: number;
  strokeWidth: number;
  tintProgress: number;
};

const HIDDEN: PartPlacement = {
  visible: false,
  segmentStart: 0,
  segmentEnd: 0,
  strokeWidth: 0,
  tintProgress: 0,
};

export function pathLength(points: Point[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += Math.hypot(
      points[i].x - points[i - 1].x,
      points[i].y - points[i - 1].y
    );
  }
  return total;
}

export function buildParts(
  pathLen: number,
  { blunt = false, width = W_MAX }: SnakeOptions = {}
): SnakePart[] {
  const centerIndex = (PARTS - 1) / 2;
  return Array.from({ length: blunt ? centerIndex + 1 : PARTS }, (_, index) => {
    const distance = blunt
      ? centerIndex - index
      : Math.abs(index - centerIndex);
    const distanceRatio = distance / centerIndex;
    return {
      distance,
      position: blunt ? (index + 0.5) / PARTS + 0.5 : (index + 0.5) / PARTS,
      width: width - (width - W_MIN) * distanceRatio,
      half: LENGTHS[Math.min(distance, LENGTHS.length - 1)] / 2 / pathLen,
      rank: blunt ? distance : PARTS - 1 - index,
      shade: SHADES[Math.min(distance, SHADES.length - 1)],
    };
  });
}

export const partCenter = (
  part: SnakePart,
  headFrac: number,
  bodyFrac: number
) => headFrac - (1 - part.position) * bodyFrac;

export function placePart(
  part: SnakePart,
  headFrac: number,
  transitionTime: number,
  {
    bodyFrac,
    taperFrac,
    taper,
    endFraction,
  }: {
    bodyFrac: number;
    taperFrac: number;
    taper: boolean;
    endFraction: number;
  }
): PartPlacement {
  const centerFraction = partCenter(part, headFrac, bodyFrac);
  if (centerFraction + part.half < 0 || centerFraction - part.half > 1) {
    return HIDDEN;
  }

  const strokeWidth = taper
    ? Math.max(
        1,
        part.width *
          smoothstep(0, taperFrac, centerFraction) *
          smoothstep(0, taperFrac, endFraction - centerFraction)
      )
    : part.width;
  if (strokeWidth <= 0.05) return HIDDEN;

  return {
    visible: true,
    segmentStart: clamp(centerFraction - part.half, 0, 1),
    segmentEnd: clamp(centerFraction + part.half, 0, 1),
    strokeWidth,
    tintProgress:
      transitionTime < 0
        ? 0
        : TINT_EASE(clamp((transitionTime - part.rank * STAGGER) / TURN, 0, 1)),
  };
}
