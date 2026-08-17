import { Container, Node } from "@/components/_animations/canvas2d/scene";
import { resolveZoom } from "@/utils/zoom";
import type { Point } from "./geometry";
import { clamp } from "./math";
import { resolveCssRamp, resolveDynamicCss } from "./resolve-color";
import { lerpPoint, SAMPLES } from "./sample-path";
import type { SnakeFactory } from "./snake";
import {
  BODY,
  buildParts,
  pathLength,
  placePart,
  RAMP_STEPS,
  type SnakeOptions,
  TAPER,
} from "./snake-parts";

export type CanvasPainter = {
  root: Container;
  makeSnake: SnakeFactory;
  paint: () => void;
  destroy: () => void;
};

export function createSceneSnake(
  { points, endFraction }: Parameters<SnakeFactory>[0],
  color: string,
  targetColor: string,
  options: SnakeOptions = {}
) {
  const { taper = true } = options;
  const shifting = color !== targetColor;
  const pathLen = pathLength(points);
  const bodyFrac = BODY / pathLen;
  const taperFrac = TAPER / pathLen;
  const parts = [...buildParts(pathLen, options)].sort(
    (a, b) => b.distance - a.distance
  );

  let head = -1;
  let transition = -1;

  const pointAt = (fraction: number): Point => {
    const sampleIndex = clamp(fraction, 0, 1) * SAMPLES;
    const startIndex = Math.floor(sampleIndex);
    const endIndex = Math.min(SAMPLES, startIndex + 1);
    return lerpPoint(
      points[startIndex],
      points[endIndex],
      sampleIndex - startIndex
    );
  };

  const node = new Node();
  node.render = (target: CanvasRenderingContext2D) => {
    if (head < 0) return;
    for (const part of parts) {
      const placement = placePart(part, head, transition, {
        bodyFrac,
        taperFrac,
        taper,
        endFraction,
      });
      if (!placement.visible) continue;
      target.beginPath();
      const from = pointAt(placement.segmentStart);
      target.moveTo(from.x, from.y);
      for (
        let k = Math.ceil(placement.segmentStart * SAMPLES);
        k <= Math.floor(placement.segmentEnd * SAMPLES);
        k++
      ) {
        target.lineTo(points[k].x, points[k].y);
      }
      const to = pointAt(placement.segmentEnd);
      target.lineTo(to.x, to.y);
      target.lineWidth = placement.strokeWidth;
      target.lineCap = "butt";
      target.lineJoin = "round";
      target.strokeStyle = shifting
        ? resolveCssRamp(color, targetColor, part.shade, RAMP_STEPS)[
            Math.round(placement.tintProgress * RAMP_STEPS)
          ]
        : resolveDynamicCss(color, part.shade);
      target.stroke();
    }
  };

  return Object.assign(node, {
    body: bodyFrac,
    placeHead: (headFrac: number, transitionTime = -1) => {
      head = headFrac;
      transition = transitionTime;
    },
    destroy: () => node.parent?.removeChild(node),
  });
}

export function createCanvasPainter(host: HTMLElement): CanvasPainter {
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  canvas.className = "pointer-events-none absolute inset-0 size-full";
  host.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  const root = new Container();
  let width = 0;
  let height = 0;
  let scale = 0;

  const resize = () => {
    const zoom = resolveZoom(host);
    const dpr = (window.devicePixelRatio || 1) * zoom;
    const w = host.clientWidth;
    const h = host.clientHeight;
    if (w === width && h === height && dpr === scale) return;
    width = w;
    height = h;
    scale = dpr;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  };

  const paint = () => {
    if (!ctx) return;
    resize();
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.clearRect(0, 0, width, height);
    root.render(ctx);
  };

  const makeSnake: SnakeFactory = (layout, color, targetColor, options) => {
    const snake = createSceneSnake(layout, color, targetColor, options);
    root.addChild(snake);
    return snake;
  };

  return {
    root,
    makeSnake,
    paint,
    destroy: () => {
      root.removeChildren();
      canvas.remove();
    },
  };
}
