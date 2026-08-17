import { Container, Graphics } from "@/components/_animations/canvas2d/scene";
import { resolveCssColor } from "@/components/_animations/shared/snake-pulse/resolve-color";

const RADIUS = 300;
const CENTER_DROP = 330;
const TILT = (20 * Math.PI) / 180;
const SPIN = (4 * Math.PI) / 180;
const PARALLEL_STEP = (15 * Math.PI) / 180;
const MERIDIAN_STEP = (12 * Math.PI) / 180;
const SAMPLE_STEP = (4 * Math.PI) / 180;
const CLIP_MARGIN = 8;
const STROKE = "var(--color-border-muted)";
const LINE_WIDTH = 1;

type WireGlobePoint = { x: number; y: number; depth: number };

export type WireGlobe = {
  container: Container;
  parallelStep: number;
  meridianStep: number;
  project: (lat: number, lon: number) => WireGlobePoint;
  advance: (dt: number) => void;
  resize: (w: number, h: number) => void;
  destroy: () => void;
};

export type WireGlobeOptions = {
  centerDrop?: number;
  stroke?: string;
};

export function createWireGlobe(
  width: number,
  height: number,
  {
    centerDrop = CENTER_DROP,
    stroke: strokeSource = STROKE,
  }: WireGlobeOptions = {}
): WireGlobe {
  if (!Number.isFinite(centerDrop)) {
    throw new Error("createWireGlobe: centerDrop must be a finite number");
  }

  const container = new Container();
  const parallels = new Graphics();
  const meridians = new Graphics();
  container.addChild(parallels, meridians);

  let stroke = resolveCssColor(strokeSource);
  const cosT = Math.cos(TILT);
  const sinT = Math.sin(TILT);

  let w = width;
  let h = height;
  let theta = 0;

  const project = (lat: number, lon: number): WireGlobePoint => {
    const cp = Math.cos(lat);
    const x3 = cp * Math.sin(lon + theta);
    const y3 = Math.sin(lat);
    const z3 = cp * Math.cos(lon + theta);
    return {
      x: w / 2 + RADIUS * x3,
      y: h / 2 + centerDrop - RADIUS * (y3 * cosT - z3 * sinT),
      depth: y3 * sinT + z3 * cosT,
    };
  };

  const horizonPoint = (
    a: WireGlobePoint,
    b: WireGlobePoint
  ): WireGlobePoint => {
    const f = a.depth / (a.depth - b.depth);
    return {
      x: a.x + (b.x - a.x) * f,
      y: a.y + (b.y - a.y) * f,
      depth: 0,
    };
  };

  const drawLine = (
    g: Graphics,
    pointAt: (i: number) => WireGlobePoint,
    steps: number
  ) => {
    let pen = false;
    let prev: WireGlobePoint | null = null;
    for (let i = 0; i <= steps; i++) {
      const p = pointAt(i);
      const inY = p.y > -CLIP_MARGIN && p.y < h + CLIP_MARGIN;
      const visible = p.depth > 0 && inY;
      if (visible) {
        if (pen) {
          g.lineTo(p.x, p.y);
        } else {
          if (prev && prev.depth <= 0 && inY) {
            const m = horizonPoint(p, prev);
            g.moveTo(m.x, m.y);
            g.lineTo(p.x, p.y);
          } else {
            g.moveTo(p.x, p.y);
          }
        }
        pen = true;
      } else {
        if (pen && prev && p.depth <= 0 && prev.depth > 0 && inY) {
          const m = horizonPoint(prev, p);
          g.lineTo(m.x, m.y);
        }
        pen = false;
      }
      prev = p;
    }
  };

  const drawParallels = () => {
    parallels.clear();
    const steps = Math.ceil((Math.PI * 2) / SAMPLE_STEP);
    for (
      let lat = -Math.PI / 2 + PARALLEL_STEP;
      lat < Math.PI / 2 - PARALLEL_STEP / 2;
      lat += PARALLEL_STEP
    ) {
      drawLine(
        parallels,
        (i) => project(lat, (i / steps) * Math.PI * 2),
        steps
      );
    }
    parallels.circle(w / 2, h / 2 + centerDrop, RADIUS);
    parallels.stroke({
      width: LINE_WIDTH,
      color: stroke,
      cap: "round",
      join: "round",
    });
  };

  const drawMeridians = () => {
    meridians.clear();
    const steps = Math.ceil(Math.PI / SAMPLE_STEP);
    for (let lon = 0; lon < Math.PI * 2; lon += MERIDIAN_STEP) {
      drawLine(
        meridians,
        (i) => project(-Math.PI / 2 + (i / steps) * Math.PI, lon),
        steps
      );
    }
    meridians.stroke({
      width: LINE_WIDTH,
      color: stroke,
      cap: "round",
      join: "round",
    });
  };

  drawParallels();
  drawMeridians();

  const redrawForTheme = () => {
    stroke = resolveCssColor(strokeSource);
    drawParallels();
    drawMeridians();
  };

  addEventListener("themechange", redrawForTheme);

  return {
    container,
    parallelStep: PARALLEL_STEP,
    meridianStep: MERIDIAN_STEP,
    project,
    advance(dt) {
      theta += SPIN * dt;
      drawMeridians();
    },
    resize(width, height) {
      w = width;
      h = height;
      drawParallels();
      drawMeridians();
    },
    destroy() {
      removeEventListener("themechange", redrawForTheme);
      container.destroy({ children: true });
    },
  };
}
