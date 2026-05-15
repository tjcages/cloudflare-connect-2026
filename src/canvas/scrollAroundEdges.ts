export type PanelViewportRect = Pick<DOMRect, "left" | "right" | "top" | "bottom">;

export type EdgeScrollStep = {
  /** Horizontal scroll delta for this frame (positive = scroll right). */
  scrollDx: number;
  /** Vertical scroll delta for this frame (positive = scroll down). */
  scrollDy: number;
};

/**
 * Edge auto-pan deltas when the pointer sits inside an edge zone of the panel viewport.
 * Used during canvas layer drag; applied via translate (not native scroll).
 */
export function getCanvasPanelEdgeScrollStep(
  panelViewportRect: PanelViewportRect,
  clientX: number,
  clientY: number,
  options?: { edgePx?: number; maxStepPx?: number },
): EdgeScrollStep {
  const edgePx = options?.edgePx ?? 56;
  const maxStepPx = options?.maxStepPx ?? 14;

  let scrollDx = 0;
  let scrollDy = 0;

  const leftPenetration = panelViewportRect.left + edgePx - clientX;
  if (leftPenetration > 0) {
    const t = Math.min(1, leftPenetration / edgePx);
    scrollDx = -maxStepPx * t;
  }

  const rightPenetration = clientX - (panelViewportRect.right - edgePx);
  if (rightPenetration > 0) {
    const t = Math.min(1, rightPenetration / edgePx);
    scrollDx = maxStepPx * t;
  }

  const topPenetration = panelViewportRect.top + edgePx - clientY;
  if (topPenetration > 0) {
    const t = Math.min(1, topPenetration / edgePx);
    scrollDy = -maxStepPx * t;
  }

  const bottomPenetration = clientY - (panelViewportRect.bottom - edgePx);
  if (bottomPenetration > 0) {
    const t = Math.min(1, bottomPenetration / edgePx);
    scrollDy = maxStepPx * t;
  }

  return { scrollDx, scrollDy };
}
