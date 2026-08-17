import { cubicBezier } from "motion";
import { type Application, Container, Graphics } from "pixi.js";
import type { Point } from "@/components/_animations/shared/snake-pulse/geometry";
import { clamp } from "@/components/_animations/shared/snake-pulse/math";
import { resolveDynamicColor } from "@/components/_animations/shared/snake-pulse/resolve-color";
import {
  lerpPoint,
  SAMPLES,
  samplePath,
} from "@/components/_animations/shared/snake-pulse/sample-path";
import type { OrbitProfile } from "./profiles";

const PARTS = 9;
const SEG_MAX_FRAC = 0.24;
const SEG_MIN_FRAC = 0.15;
const W_MIN_FRAC = 0.2;
const SHADES = [1, 2, 3, 4, 5];
const CIRCLE_STEP_SAMPLES = 64;
const REVEAL_EASE = cubicBezier(0.6, 0.6, 0, 1);

type TaperMode = "head-tail" | "center";

type OrbitShape =
  | {
      kind: "circle";
      cx: number;
      cy: number;
      radius: number;
      perimeter: number;
      headStart: number;
    }
  | {
      kind: "rounded-rect";
      points: Point[];
      normals: Point[];
      perimeter: number;
      headStart: number;
    };

export function circleShape(
  cx: number,
  cy: number,
  radius: number
): OrbitShape {
  return {
    kind: "circle",
    cx,
    cy,
    radius,
    perimeter: 2 * Math.PI * radius,
    headStart: -0.25,
  };
}

function roundedRectPath(
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): string {
  const rr = Math.min(r, w / 2, h / 2);
  return [
    `M${x + rr} ${y}`,
    `L${x + w - rr} ${y}`,
    `A${rr} ${rr} 0 0 1 ${x + w} ${y + rr}`,
    `L${x + w} ${y + h - rr}`,
    `A${rr} ${rr} 0 0 1 ${x + w - rr} ${y + h}`,
    `L${x + rr} ${y + h}`,
    `A${rr} ${rr} 0 0 1 ${x} ${y + h - rr}`,
    `L${x} ${y + rr}`,
    `A${rr} ${rr} 0 0 1 ${x + rr} ${y}`,
    "Z",
  ].join(" ");
}

export function roundedRectShape(
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number
): OrbitShape {
  const { points, len } = samplePath(roundedRectPath(x, y, w, h, radius));
  const cx = x + w / 2;
  const cy = y + h / 2;

  const normals: Point[] = points.map((p, i) => {
    const a = points[(i - 1 + SAMPLES) % SAMPLES];
    const b = points[(i + 1) % SAMPLES];
    const tx = b.x - a.x;
    const ty = b.y - a.y;
    const tl = Math.hypot(tx, ty) || 1;
    let nx = -ty / tl;
    let ny = tx / tl;
    if (nx * (p.x - cx) + ny * (p.y - cy) < 0) {
      nx = -nx;
      ny = -ny;
    }
    return { x: nx, y: ny };
  });

  const rr = Math.min(radius, w / 2, h / 2);
  const arc = (Math.PI / 2) * rr;
  const topLen = w - 2 * rr;
  const sideLen = h - 2 * rr;
  const headStart = (2 * topLen + 3 * arc + sideLen + sideLen / 2) / len;

  return { kind: "rounded-rect", points, normals, perimeter: len, headStart };
}

interface OrbitSnakeOptions {
  shape: OrbitShape;
  color: string;
  profile: OrbitProfile;
  taper?: TaperMode;
  parent: Container;
  nudgeX?: () => number;
  onComplete?: () => void;
  onEarlyComplete?: () => void;
  earlyCompleteS?: number;
}

export function createOrbitSnake(app: Application, options: OrbitSnakeOptions) {
  const { color, profile, nudgeX, onComplete, onEarlyComplete } = options;
  const taper = options.taper ?? "head-tail";
  const earlyCompleteS = options.earlyCompleteS ?? 0;
  let shape = options.shape;

  const container = new Container();
  options.parent.addChild(container);

  const peak = PARTS - 1;
  const centerIndex = (PARTS - 1) / 2;
  const widths = profile.widths;
  const parts = Array.from({ length: PARTS }, (_, index) => {
    const distance =
      taper === "center" ? Math.abs(index - centerIndex) : peak - index;
    const distanceRatio =
      taper === "center" ? distance / centerIndex : distance / peak;
    const partWidth =
      taper === "center"
        ? profile.width -
          (profile.width - (profile.widthMin ?? 0)) * distanceRatio
        : widths
          ? widths[Math.min(distance, widths.length - 1)]
          : profile.width * (1 - (1 - W_MIN_FRAC) * distanceRatio);
    const shadeIndex =
      taper === "center"
        ? Math.min(distance, SHADES.length - 1)
        : Math.round(distanceRatio * (SHADES.length - 1));
    return {
      graphics: new Graphics(),
      distance,
      position: (index + 0.5) / PARTS,
      width: partWidth,
      half:
        ((distance === 0 ? SEG_MAX_FRAC : SEG_MIN_FRAC) * profile.bodyFrac) / 2,
      shade: SHADES[shadeIndex],
      color: resolveDynamicColor(color, SHADES[shadeIndex]),
    };
  });

  const refreshColors = () => {
    for (const part of parts) {
      part.color = resolveDynamicColor(color, part.shade);
    }
  };
  addEventListener("themechange", refreshColors);
  for (const part of [...parts].sort((a, b) => b.distance - a.distance)) {
    container.addChild(part.graphics);
  }

  const hide = () => {
    for (const part of parts) part.graphics.visible = false;
  };

  const strokePart = (
    part: (typeof parts)[number],
    headFrac: number,
    width: number,
    offset: number,
    density: number,
    pointAt: (fraction: number, offset: number) => Point
  ) => {
    part.graphics.clear();
    const centerFraction = headFrac - (1 - part.position) * profile.bodyFrac;
    const startFraction = centerFraction - part.half;
    const endFraction = centerFraction + part.half;
    const steps = Math.max(
      2,
      Math.ceil((endFraction - startFraction) * density)
    );
    const start = pointAt(startFraction, offset);
    part.graphics.moveTo(start.x, start.y);
    for (let k = 1; k <= steps; k++) {
      const point = pointAt(
        startFraction + ((endFraction - startFraction) * k) / steps,
        offset
      );
      part.graphics.lineTo(point.x, point.y);
    }
    part.graphics.stroke({
      width,
      color: part.color,
      cap: "butt",
      join: "round",
    });
  };

  let renderedWidthScale = -1;
  const buildLocalCircle = (widthScale: number, radius: number) => {
    for (const part of parts) {
      const width = part.width * widthScale;
      if (width <= 0.05) {
        part.graphics.visible = false;
        continue;
      }
      part.graphics.visible = true;
      strokePart(
        part,
        0,
        width,
        width / 2,
        CIRCLE_STEP_SAMPLES,
        (fraction, offset) => {
          const angle = 2 * Math.PI * fraction;
          const offsetRadius = radius + offset;
          return {
            x: Math.cos(angle) * offsetRadius,
            y: Math.sin(angle) * offsetRadius,
          };
        }
      );
    }
    renderedWidthScale = widthScale;
  };

  const wrap = (fraction: number) => ((fraction % 1) + 1) % 1;
  const lerpAt = (points: Point[], fraction: number): Point => {
    const sampleIndex = wrap(fraction) * SAMPLES;
    const startIndex = Math.floor(sampleIndex) % SAMPLES;
    const endIndex = (startIndex + 1) % SAMPLES;
    const progress = sampleIndex - Math.floor(sampleIndex);
    return lerpPoint(points[startIndex], points[endIndex], progress);
  };
  const pointAt = (fraction: number, offset: number): Point => {
    if (shape.kind !== "rounded-rect") return { x: 0, y: 0 };
    const point = lerpAt(shape.points, fraction);
    const normal = lerpAt(shape.normals, fraction);
    const normalLength = Math.hypot(normal.x, normal.y) || 1;
    return {
      x: point.x + (normal.x / normalLength) * offset,
      y: point.y + (normal.y / normalLength) * offset,
    };
  };

  const strokeAlongPath = (head: number, widthScale: number) => {
    for (const part of parts) {
      const width = part.width * widthScale;
      if (width <= 0.05) {
        part.graphics.visible = false;
        continue;
      }
      part.graphics.visible = true;
      strokePart(part, head, width, part.width / 2, SAMPLES, pointAt);
    }
  };

  const applyShapeTransform = () => {
    renderedWidthScale = -1;
    if (shape.kind === "circle") container.position.set(shape.cx, shape.cy);
    else container.position.set(0, 0);
    container.rotation = 0;
  };

  const render = (head: number, widthScale: number) => {
    if (shape.kind === "circle") {
      if (widthScale !== renderedWidthScale) {
        buildLocalCircle(widthScale, shape.radius);
      }
      container.rotation = (head % 1) * 2 * Math.PI;
    } else {
      strokeAlongPath(head, widthScale);
    }
  };

  let active = false;
  let localT = 0;
  let traveled = 0;
  let lifetime = 0;
  let earlyFired = false;

  const tick = (ticker: { deltaMS: number }) => {
    if (!active) return;
    const dt = ticker.deltaMS / 1000;
    localT += dt;
    if (!earlyFired && localT >= lifetime - earlyCompleteS) {
      earlyFired = true;
      onEarlyComplete?.();
    }
    if (!profile.infinite && localT >= lifetime) {
      active = false;
      hide();
      if (nudgeX) container.x = 0;
      onComplete?.();
      return;
    }

    const cruiseVelocity = profile.cruiseSpeed / shape.perimeter;
    const cruiseEnd = profile.infinite
      ? Number.POSITIVE_INFINITY
      : lifetime - profile.leaveS;
    let velocity: number;
    if (localT < profile.revealS) {
      velocity =
        cruiseVelocity *
        (profile.accelFrom +
          (1 - profile.accelFrom) * REVEAL_EASE(localT / profile.revealS));
    } else if (localT < cruiseEnd) {
      velocity = cruiseVelocity;
    } else {
      const exitProgress = clamp((localT - cruiseEnd) / profile.leaveS, 0, 1);
      velocity = cruiseVelocity * (1 - exitProgress) ** profile.leaveDecel;
    }
    traveled += velocity * dt;

    const reveal =
      localT >= profile.revealS ? 1 : REVEAL_EASE(localT / profile.revealS);
    const exitProgress = clamp((localT - cruiseEnd) / profile.leaveS, 0, 1);
    if (nudgeX) container.x = nudgeX();
    container.alpha = clamp((1 - exitProgress) * 2, 0, 1);
    render(shape.headStart + traveled, reveal * (1 - exitProgress));
  };

  app.ticker.add(tick);
  applyShapeTransform();
  hide();

  return {
    play(lifetimeS?: number) {
      active = true;
      localT = 0;
      traveled = 0;
      earlyFired = false;
      renderedWidthScale = -1;
      container.alpha = 1;
      const [lo, hi] = profile.lifetime;
      lifetime = lifetimeS ?? lo + Math.random() * (hi - lo);
    },
    setShape(nextShape: OrbitShape) {
      shape = nextShape;
      applyShapeTransform();
    },
    destroy() {
      removeEventListener("themechange", refreshColors);
      app.ticker.remove(tick);
      container.destroy({ children: true });
    },
  };
}
