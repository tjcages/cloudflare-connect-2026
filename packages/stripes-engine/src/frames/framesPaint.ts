import type { FrameBox } from "./frameBoxes";

/**
 * Everything needed to paint one instance's frames, and nothing that needs a
 * GL context — the shared path builds this in the worker and posts it, so it
 * has to survive structured cloning.
 */
export type FramesOverlay = {
  boxes: FrameBox[];
  cssWidth: number;
  cssHeight: number;
  /** CSS px → device px on the target canvas. */
  scale: number;
  color: number;
  coordinateColor: number;
  fontSizePx: number;
  /** 0..1 fade, ramped in once the reveal has settled. */
  alpha: number;
};

type Frames2dContext = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

const FRAME_FONT_STACK = `"Paper Mono", "SFMono-Regular", Menlo, Monaco, Consolas, monospace`;
const CORNER_SIZE_PX = 3;
const CHIP_PADDING_PX = 8;
const CHIP_LEADING_PX = 6;

// The engine treats config hex as display-p3 component values, so the overlay
// has to as well or a frame drawn in a stripe's own colour reads duller than
// the stripe. Falls back to sRGB on a context that was not asked for P3.
function cssColor(p3: boolean, color: number, alpha: number): string {
  const r = (color >> 16) & 255;
  const g = (color >> 8) & 255;
  const b = color & 255;
  if (!p3) return `rgb(${r} ${g} ${b} / ${alpha})`;
  return `color(display-p3 ${r / 255} ${g / 255} ${b / 255} / ${alpha})`;
}

// Spec'd on both 2D contexts; the DOM lib only declares it on the on-screen one.
function isP3(ctx: Frames2dContext): boolean {
  const attributes = (ctx as { getContextAttributes?(): { colorSpace?: string } }).getContextAttributes?.();
  return attributes?.colorSpace === "display-p3";
}

/**
 * Draw `overlay` over whatever the context already holds — the caller owns
 * clearing, because the shared path paints straight onto the blit.
 */
export function paintFramesOverlay(ctx: Frames2dContext, overlay: FramesOverlay): void {
  if (overlay.alpha <= 0 || overlay.boxes.length === 0) return;
  const { fontSizePx } = overlay;
  const p3 = isP3(ctx);

  ctx.save();
  ctx.setTransform(overlay.scale, 0, 0, overlay.scale, 0, 0);
  ctx.lineWidth = 1;
  ctx.font = `${fontSizePx}px ${FRAME_FONT_STACK}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  const frameColor = cssColor(p3, overlay.color, 0.92 * overlay.alpha);
  const chipColor = cssColor(p3, overlay.color, overlay.alpha);
  const labelColor = cssColor(p3, overlay.coordinateColor, overlay.alpha);

  for (const box of overlay.boxes) {
    ctx.strokeStyle = frameColor;
    ctx.strokeRect(box.x, box.y, box.width, box.height);

    ctx.fillStyle = frameColor;
    const cornerOffset = CORNER_SIZE_PX / 2;
    for (const [cornerX, cornerY] of [
      [box.x, box.y],
      [box.x + box.width, box.y],
      [box.x, box.y + box.height],
      [box.x + box.width, box.y + box.height],
    ] as const) {
      ctx.fillRect(cornerX - cornerOffset, cornerY - cornerOffset, CORNER_SIZE_PX, CORNER_SIZE_PX);
    }

    // Measured here rather than where the boxes are built: in the shared path
    // that runs in a worker, which cannot see the document's fonts.
    const metrics = ctx.measureText(box.label);
    const chipWidth = Math.ceil(metrics.width) + CHIP_PADDING_PX;
    const chipHeight = fontSizePx + CHIP_LEADING_PX;
    const chipY = box.labelY + chipHeight <= overlay.cssHeight ? box.labelY : Math.max(0, box.labelY - chipHeight);
    const ascent = metrics.actualBoundingBoxAscent || fontSizePx * 0.75;
    const descent = metrics.actualBoundingBoxDescent || fontSizePx * 0.2;

    ctx.fillStyle = chipColor;
    ctx.fillRect(box.labelX, chipY, chipWidth, chipHeight);
    ctx.fillStyle = labelColor;
    ctx.fillText(box.label, box.labelX + chipWidth * 0.5, chipY + chipHeight * 0.5 + (ascent - descent) * 0.5);
  }

  ctx.restore();
}
