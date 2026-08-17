import { Container, Graphics } from "pixi.js";
import { CELL_SIZE } from "../../../constants";
import type { IProductsBox } from "../../box/types";
import { CANVAS_WIDTH, resolveOuterSpan } from "../utils/outer";
import { clamp } from "@/components/_animations/shared/snake-pulse/math";
import { resolveCssColor } from "@/components/_animations/shared/snake-pulse/resolve-color";

const DASH_PERIOD_PX = 8;
const DASH_PX = 3;

const SOFT = 6;
const WIPE_IN_SECONDS = 0.13;
const WIPE_OUT_SECONDS = 0.13;
const MAX_REVEAL = 0.45;
const MIN_VISIBLE = 0.1;

const FADE_IN = 0.04;
const FADE_OUT = 0.96;

type Geometry = {
  x1: number;
  y: number;
  width: number;
  drift: number;
  durationMs: number;
};

function rollGeometry(xMin: number, span: number, cy: number): Geometry {
  const maxWidth = Math.max(16, Math.min(span * 0.4, 48));
  let width = 8 * (2 + Math.round(Math.random() * 2));
  if (width > maxWidth) width = Math.floor(maxWidth / 8) * 8;

  const maxDrift = Math.max(
    Math.floor(Math.max(span - width - 4, 8) / 8) * 8,
    8
  );
  const drift = Math.min(8 * (3 + Math.floor(Math.random() * 5)), maxDrift);

  const x1 = Math.round(
    xMin + Math.random() * Math.max(span - width - drift, 0)
  );
  const offset = Math.round(CELL_SIZE * 0.16 + Math.random() * CELL_SIZE * 0.2);
  const y = Math.random() < 0.5 ? cy - offset : cy + offset;

  const durationMs = 700 + Math.random() * 700;

  return { x1, y, width, drift, durationMs };
}

const lerp = (a: number, b: number, p: number) => a + (b - a) * p;

function lerpRGB(a: number, b: number, p: number): number {
  const ar = (a >>> 16) & 255;
  const ag = (a >>> 8) & 255;
  const ab = a & 255;
  const br = (b >>> 16) & 255;
  const bg = (b >>> 8) & 255;
  const bb = b & 255;
  const r = Math.round(lerp(ar, br, p));
  const g = Math.round(lerp(ag, bg, p));
  const bl = Math.round(lerp(ab, bb, p));
  return (r << 16) + (g << 8) + bl;
}

export function createDashedStrokes(
  boxes: IProductsBox[],
  layer: Container,
  cleanup: (fn: () => void) => void,
  canvasWidth = CANVAS_WIDTH
): { tick: (dt: number) => void } {
  const connectors = boxes
    .filter((box) => box.connectToEdge)
    .map((box) => ({
      span: resolveOuterSpan(box, canvasWidth),
      color: box.color,
    }))
    .filter(({ span }) => span.side === "left");

  const container = new Container();
  layer.addChild(container);

  const particles = connectors.flatMap(({ span, color }) => {
    const width = span.xMax - span.xMin;
    const edgeX = span.xMin;
    const boxX = span.xMax;
    const border = resolveCssColor("var(--color-border-default)");
    const box100 = resolveCssColor(`var(--color-chips-background-${color})`);
    const box200 = resolveCssColor(`var(--color-dynamic-${color}-6)`);
    const starCount = clamp(Math.round(width / 150), 3, 6);
    const particleCount = Math.round(starCount * 1.25);

    return Array.from({ length: particleCount }, () => {
      const graphics = new Graphics();
      container.addChild(graphics);
      return {
        graphics,
        edgeX,
        boxX,
        color,
        border,
        box100,
        box200,
        xMin: span.xMin,
        span: width,
        cy: span.cy,
        geometry: rollGeometry(span.xMin, width, span.cy),
        elapsed: 0,
        delay: Math.random() * 1400,
      };
    });
  });

  const refreshColors = () => {
    const border = resolveCssColor("var(--color-border-default)");
    for (const particle of particles) {
      particle.border = border;
      particle.box100 = resolveCssColor(
        `var(--color-chips-background-${particle.color})`
      );
      particle.box200 = resolveCssColor(
        `var(--color-dynamic-${particle.color}-6)`
      );
    }
  };
  addEventListener("themechange", refreshColors);

  cleanup(() => {
    removeEventListener("themechange", refreshColors);
    container.destroy({ children: true });
  });

  return {
    tick(dt) {
      const deltaMS = dt * 1000;
      for (const particle of particles) {
        if (particle.delay > 0) {
          particle.delay -= deltaMS;
          particle.graphics.visible = false;
          continue;
        }

        particle.elapsed += deltaMS;
        if (particle.elapsed >= particle.geometry.durationMs) {
          particle.elapsed = 0;
          particle.geometry = rollGeometry(
            particle.xMin,
            particle.span,
            particle.cy
          );
        }

        const { x1, y, width, drift, durationMs } = particle.geometry;
        const progress = particle.elapsed / durationMs;

        const opacity = clamp(
          Math.min(progress / FADE_IN, (1 - progress) / (1 - FADE_OUT)),
          0,
          1
        );
        if (opacity <= 0) {
          particle.graphics.visible = false;
          continue;
        }

        const elementLeft = x1 + drift * progress;
        const elementRight = elementLeft + width;

        const durationS = durationMs / 1000;
        const revealEnd = Math.min(WIPE_IN_SECONDS / durationS, MAX_REVEAL);
        const hideStart = Math.max(
          1 - WIPE_OUT_SECONDS / durationS,
          revealEnd + MIN_VISIBLE
        );

        let leadingWindow: number;
        if (progress <= revealEnd) {
          leadingWindow = lerp(-width, 0, progress / revealEnd);
        } else if (progress <= hideStart) {
          leadingWindow = 0;
        } else {
          leadingWindow = lerp(
            0,
            -width / 2,
            (progress - hideStart) / (1 - hideStart)
          );
        }

        const trailingWindow =
          progress <= hideStart
            ? -width
            : lerp(
                -width,
                -width / 2,
                (progress - hideStart) / (1 - hideStart)
              );

        const trailingEdge = trailingWindow + width - SOFT;
        const leadingEdge = leadingWindow + width + SOFT;
        const gradientSpan = particle.boxX - particle.edgeX;

        particle.graphics.visible = true;
        particle.graphics.alpha = 1;
        particle.graphics.clear();
        // Absolute dash phase keeps the pattern fixed while its window moves.
        for (
          let dx = Math.ceil(elementLeft / DASH_PERIOD_PX) * DASH_PERIOD_PX;
          dx < elementRight;
          dx += DASH_PERIOD_PX
        ) {
          const a = Math.max(dx, elementLeft);
          const b = Math.min(dx + DASH_PX, elementRight);
          if (b <= a) continue;

          const dashCenter = (a + b) / 2;
          const localCenter = dashCenter - elementLeft;

          const trailingAlpha = clamp(
            (localCenter - trailingEdge) / (2 * SOFT),
            0,
            1
          );
          const leadingAlpha = clamp(
            (leadingEdge - localCenter) / (2 * SOFT),
            0,
            1
          );
          const dashAlpha = opacity * trailingAlpha * leadingAlpha;
          if (dashAlpha <= 0.001) continue;

          const colorProgress = clamp(
            (dashCenter - particle.edgeX) / gradientSpan,
            0,
            1
          );
          let color: number;
          if (colorProgress <= 0.6) color = particle.border;
          else if (colorProgress <= 0.8)
            color = lerpRGB(
              particle.border,
              particle.box100,
              (colorProgress - 0.6) / 0.2
            );
          else
            color = lerpRGB(
              particle.box100,
              particle.box200,
              (colorProgress - 0.8) / 0.2
            );

          particle.graphics
            .moveTo(a, y)
            .lineTo(b, y)
            .stroke({ width: 1, color, alpha: dashAlpha, cap: "butt" });
        }
      }
    },
  };
}
