import { animate, cubicBezier, motionValue } from "motion";
import { Container, Graphics } from "pixi.js";
import type { IconBoxDirection } from "../../../grid/types";
import {
  ICON_BOX_CENTER_STROKE_LONG,
  ICON_BOX_CENTER_STROKE_SHORT,
  ICON_BOX_CENTER_STROKE_TRAVEL_PX,
  getIconBoxCenterStrokeAnchors,
  type IconBoxLayoutSpec,
} from "../../../lib/icon-box/layout";

const CENTER_STROKE_EASE = cubicBezier(0.6, 0.6, 0, 1);
const CENTER_STROKE_LEG_SEC = 0.2;

const randomUnitInterval = (): number => {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0]! / (0xffffffff + 1);
};

const CENTER_STROKE_Z_INDEX = 41;

/** CSS-style negative delay: sample offset/duration as if the loop already ran for `elapsedSec`. */
export const sampleCenterStrokeLoopPhase = (
  elapsedSec: number,
  travel: number,
): { offset: number; nextOffset: number; duration: number } => {
  const legSec = CENTER_STROKE_LEG_SEC;
  const cycleSec = legSec * 2;
  const t = ((elapsedSec % cycleSec) + cycleSec) % cycleSec;

  if (t < legSec) {
    const progress = t / legSec;
    const eased = CENTER_STROKE_EASE(progress);
    return {
      offset: -travel + eased * 2 * travel,
      nextOffset: travel,
      duration: legSec * (1 - progress),
    };
  }

  const progress = (t - legSec) / legSec;
  const eased = CENTER_STROKE_EASE(progress);
  return {
    offset: travel - eased * 2 * travel,
    nextOffset: -travel,
    duration: legSec * (1 - progress),
  };
};

export const buildIconBoxCenterStrokeAt = (
  anchor: { x: number; y: number },
  direction: IconBoxDirection,
  themeFillRgb: number,
): { strokeRoot: Container; disposeCenterStrokeAnim: () => void } => {
  const strokeRoot = new Container();
  strokeRoot.zIndex = CENTER_STROKE_Z_INDEX;
  strokeRoot.position.set(anchor.x, anchor.y);

  const strokeW = direction === "horizontal" ? ICON_BOX_CENTER_STROKE_LONG : ICON_BOX_CENTER_STROKE_SHORT;
  const strokeH = direction === "horizontal" ? ICON_BOX_CENTER_STROKE_SHORT : ICON_BOX_CENTER_STROKE_LONG;

  const gfx = new Graphics();
  gfx.rect(-strokeW / 2, -strokeH / 2, strokeW, strokeH).fill({ color: themeFillRgb });
  strokeRoot.addChild(gfx);

  const disposeCenterStrokeAnim = startIconBoxCenterStrokeLoop(strokeRoot, anchor, direction);
  return { strokeRoot, disposeCenterStrokeAnim };
};

export const buildIconBoxCenterStrokes = (
  spec: IconBoxLayoutSpec,
  direction: IconBoxDirection,
  themeFillRgb: number,
): { strokeRoots: Container[]; disposeCenterStrokeAnim: () => void } => {
  const anchors = getIconBoxCenterStrokeAnchors(spec);
  const strokeRoots: Container[] = [];
  const disposers: Array<() => void> = [];

  for (const anchor of anchors) {
    const { strokeRoot, disposeCenterStrokeAnim } = buildIconBoxCenterStrokeAt(anchor, direction, themeFillRgb);
    strokeRoots.push(strokeRoot);
    disposers.push(disposeCenterStrokeAnim);
  }

  return {
    strokeRoots,
    disposeCenterStrokeAnim: () => {
      for (const dispose of disposers) {
        dispose();
      }
    },
  };
};

export const startIconBoxCenterStrokeLoop = (
  strokeRoot: Container,
  anchor: { x: number; y: number },
  direction: IconBoxDirection,
): (() => void) => {
  const travel = ICON_BOX_CENTER_STROKE_TRAVEL_PX;
  const offset = motionValue(0);

  const applyOffset = (delta: number) => {
    if (direction === "horizontal") {
      strokeRoot.position.x = anchor.x + delta;
      strokeRoot.position.y = anchor.y;
    } else {
      strokeRoot.position.x = anchor.x;
      strokeRoot.position.y = anchor.y + delta;
    }
  };

  const unsub = offset.on("change", applyOffset);

  let cancelled = false;
  let activeControls: ReturnType<typeof animate> | null = null;

  const runLoop = async () => {
    const cycleSec = CENTER_STROKE_LEG_SEC * 2;
    const phase = sampleCenterStrokeLoopPhase(randomUnitInterval() * cycleSec, travel);
    offset.set(phase.offset);
    let nextOffset = phase.nextOffset;
    let pendingDuration: number | null = phase.duration;

    while (!cancelled) {
      const duration = pendingDuration ?? CENTER_STROKE_LEG_SEC;
      pendingDuration = null;
      if (duration <= 0) {
        nextOffset = nextOffset === travel ? -travel : travel;
        continue;
      }

      activeControls = animate(offset, nextOffset, {
        duration,
        ease: CENTER_STROKE_EASE,
      });
      await activeControls.finished;
      activeControls = null;
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
