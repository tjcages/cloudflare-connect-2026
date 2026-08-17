import { Container, Graphics, type Sprite } from "pixi.js";
import { createEmergeMask } from "./emerge-mask";
import type { Anchor, Point } from "./geometry";
import { clamp } from "./math";
import { resolveRamp } from "./resolve-color";
import { lerpPoint, SAMPLES } from "./sample-path";
import {
  BODY,
  buildParts,
  pathLength,
  placePart,
  RAMP_STEPS,
  TAPER,
  type SnakeOptions,
} from "./snake-parts";

export type { SnakeOptions } from "./snake-parts";

export type SnakeLayout = {
  points: Point[];
  from: Anchor;
  to: Anchor;
  endFraction: number;
  d?: string;
};

export type ThrowableSnake = {
  placeHead: (headFrac: number, transitionTime?: number) => void;
  body: number;
  destroy: () => void;
};

export type SnakeFactory = (
  layout: SnakeLayout,
  color: string,
  targetColor: string,
  options?: SnakeOptions
) => ThrowableSnake;

export type Snake = ThrowableSnake & {
  container: Container;
  emergeMask: Sprite | null;
};

export function createSnake(
  { points, from, to, endFraction }: SnakeLayout,
  color: string,
  targetColor: string,
  options: SnakeOptions = {}
): Snake {
  const {
    taper = true,
    emergeMask: withEmergeMask = true,
    sourceFade,
    targetFade,
  } = options;

  const emergeMask = withEmergeMask
    ? createEmergeMask(points, from, to, { sourceFade, targetFade })
    : null;
  const container = new Container();
  if (emergeMask) container.mask = emergeMask;

  const pathLen = pathLength(points);
  const bodyFrac = BODY / pathLen;
  const taperFrac = TAPER / pathLen;

  const pointAt = (fraction: number): Point => {
    const sampleIndex = clamp(fraction, 0, 1) * SAMPLES;
    const startIndex = Math.floor(sampleIndex);
    const endIndex = Math.min(SAMPLES, startIndex + 1);
    const progress = sampleIndex - startIndex;
    return lerpPoint(points[startIndex], points[endIndex], progress);
  };

  const parts = buildParts(pathLen, options).map((part) => ({
    ...part,
    graphics: new Graphics(),
    ramp: resolveRamp(color, targetColor, part.shade, RAMP_STEPS),
  }));

  const refreshRamps = () => {
    for (const part of parts) {
      part.ramp = resolveRamp(color, targetColor, part.shade, RAMP_STEPS);
    }
  };

  addEventListener("themechange", refreshRamps);
  for (const part of [...parts].sort((a, b) => b.distance - a.distance)) {
    container.addChild(part.graphics);
  }

  const placeHead = (headFrac: number, transitionTime = -1) => {
    for (const part of parts) {
      const placement = placePart(part, headFrac, transitionTime, {
        bodyFrac,
        taperFrac,
        taper,
        endFraction,
      });

      if (!placement.visible) {
        part.graphics.visible = false;
        continue;
      }
      part.graphics.visible = true;

      const segmentPoints: Point[] = [pointAt(placement.segmentStart)];
      for (
        let k = Math.ceil(placement.segmentStart * SAMPLES);
        k <= Math.floor(placement.segmentEnd * SAMPLES);
        k++
      ) {
        segmentPoints.push(points[k]);
      }
      segmentPoints.push(pointAt(placement.segmentEnd));

      const tint = part.ramp[Math.round(placement.tintProgress * RAMP_STEPS)];

      part.graphics.clear();
      part.graphics.moveTo(segmentPoints[0].x, segmentPoints[0].y);
      for (let k = 1; k < segmentPoints.length; k++) {
        part.graphics.lineTo(segmentPoints[k].x, segmentPoints[k].y);
      }
      part.graphics.stroke({
        width: placement.strokeWidth,
        color: tint,
        cap: "butt",
        join: "round",
      });
    }
  };

  const destroy = () => {
    removeEventListener("themechange", refreshRamps);
    container.destroy({ children: true });
    emergeMask?.destroy();
  };

  return { container, emergeMask, placeHead, body: bodyFrac, destroy };
}
