import { animate, cubicBezier, motionValue } from "motion";
import { Container, Graphics } from "pixi.js";
import {
  ICON_BOX_2X1_CENTER_STROKE_HEIGHT,
  ICON_BOX_2X1_CENTER_STROKE_TRAVEL_PX,
  ICON_BOX_2X1_CENTER_STROKE_WIDTH,
  getIconBox2x1CenterStrokeAnchor,
} from "../../../lib/icon-box/layout";

/**
 * `cubicBezier(0.6, 0.6, 1, 1)` is linear (both control points on the y=x diagonal).
 * `(0.6, 0.6, 0, 1)` matches icon-box line-enable easing — fast settle, soft landing.
 */
const CENTER_STROKE_EASE = cubicBezier(0.6, 0.6, 0, 1);
/** Edge ↔ opposite edge (full travel). */
const CENTER_STROKE_LEG_SEC = 0.2;
/** Center → first edge uses half the full-leg duration. */
const CENTER_STROKE_FIRST_LEG_RATIO = 0.5;

const randomUnitInterval = (): number => {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0]! / (0xffffffff + 1);
};

/** Above inner edge ticks (39) and corner markers (40); below icons (50). */
const CENTER_STROKE_Z_INDEX = 41;

export const buildIconBox2x1CenterStroke = (
  themeFillRgb: number,
): { strokeRoot: Container; disposeCenterStrokeAnim: () => void } => {
  const anchor = getIconBox2x1CenterStrokeAnchor();
  const strokeRoot = new Container();
  strokeRoot.zIndex = CENTER_STROKE_Z_INDEX;
  strokeRoot.position.set(anchor.x, anchor.y);

  const gfx = new Graphics();
  const halfW = ICON_BOX_2X1_CENTER_STROKE_WIDTH / 2;
  const halfH = ICON_BOX_2X1_CENTER_STROKE_HEIGHT / 2;
  gfx.rect(-halfW, -halfH, ICON_BOX_2X1_CENTER_STROKE_WIDTH, ICON_BOX_2X1_CENTER_STROKE_HEIGHT).fill({
    color: themeFillRgb,
  });
  strokeRoot.addChild(gfx);

  const disposeCenterStrokeAnim = startIconBox2x1CenterStrokeLoop(strokeRoot, anchor.x);
  return { strokeRoot, disposeCenterStrokeAnim };
};

/**
 * Oscillates ±travel from center. Uses `motionValue` + `animate` (same pattern as connector hit nudge)
 * because Motion does not reliably ease Pixi `ObservablePoint` targets.
 */
export const startIconBox2x1CenterStrokeLoop = (strokeRoot: Container, anchorX: number): (() => void) => {
  const travel = ICON_BOX_2X1_CENTER_STROKE_TRAVEL_PX;
  const offsetX = motionValue(0);

  const unsub = offsetX.on("change", (dx) => {
    strokeRoot.position.x = anchorX + dx;
  });

  let cancelled = false;
  let activeControls: ReturnType<typeof animate> | null = null;

  const runLoop = async () => {
    let nextOffset = randomUnitInterval() < 0.5 ? -travel : travel;
    let isFirstLeg = true;

    while (!cancelled) {
      const duration = isFirstLeg ? CENTER_STROKE_LEG_SEC * CENTER_STROKE_FIRST_LEG_RATIO : CENTER_STROKE_LEG_SEC;
      activeControls = animate(offsetX, nextOffset, {
        duration,
        ease: CENTER_STROKE_EASE,
      });
      await activeControls.finished;
      activeControls = null;
      isFirstLeg = false;
      if (cancelled) {
        break;
      }

      nextOffset = nextOffset === travel ? -travel : travel;
    }
  };

  void runLoop();

  return () => {
    cancelled = true;
    activeControls?.stop();
    unsub();
  };
};
