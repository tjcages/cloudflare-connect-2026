/**
 * The shared coordinator runs two independent gates per instance.
 *
 * - The RENDER gate decides whether the instance renders at all. It opens as
 *   soon as any pixel of the canvas is on screen, so a visible canvas can never
 *   look frozen, and nothing offscreen burns GPU.
 * - The REVEAL gate decides whether the reveal animation's clock advances. It
 *   opens once a meaningful slice of the element is on screen, so the one-shot
 *   reveal is not spent while the element is a sliver at the viewport edge.
 */

/** `rootMargin` for the render gate: any on-screen pixel renders. */
export const DEFAULT_RENDER_ROOT_MARGIN = "0px";

/**
 * `rootMargin` for the preload gate. Deliberately wide and unchanged: the source
 * bitmap must be decoded and uploaded before the render gate opens, otherwise
 * the first on-screen frames are empty and the reveal — which triggers on the
 * first source — would stall waiting on a fetch, in view.
 */
export const DEFAULT_PRELOAD_ROOT_MARGIN = "200% 0px";

/** Fraction of the reference height that must be on screen to open the reveal gate. */
export const REVEAL_GATE_RATIO = 0.25;

/**
 * `rootMargin` for the observer that reports the viewport-relative clause. An
 * element intersects this shrunken root exactly when at least `REVEAL_GATE_RATIO`
 * of the viewport height is covered by it (or when it is short enough to sit
 * wholly inside the viewport, in which case the element-relative clause already
 * holds). It exists because `intersectionRatio` thresholds are element-relative
 * and get arbitrarily coarse for elements much taller than the viewport.
 */
export const REVEAL_VIEWPORT_ROOT_MARGIN = `-${REVEAL_GATE_RATIO * 100}% 0px`;

export type GateRect = { top: number; bottom: number; left: number; right: number };

/**
 * True when the reveal clock may advance: at least one pixel is horizontally on
 * screen AND the on-screen height reaches `ratio` of the SMALLER of the element
 * height and the viewport height.
 *
 * Taking the minimum is what makes the gate deadlock-proof. A pure
 * element-relative test (`intersectionRatio >= 0.25`) is capped by
 * `viewport / element`, so anything taller than `1 / ratio` viewports could
 * never satisfy it and would hold its reveal forever. The on-screen height can
 * always reach `min(elementHeight, viewportHeight)`, so the condition is
 * reachable for an element of any size.
 */
export function isRevealGateOpen(element: GateRect, viewport: GateRect, ratio = REVEAL_GATE_RATIO): boolean {
  const visibleWidth = Math.min(element.right, viewport.right) - Math.max(element.left, viewport.left);
  if (visibleWidth <= 0) return false;
  const visibleHeight = Math.min(element.bottom, viewport.bottom) - Math.max(element.top, viewport.top);
  if (visibleHeight <= 0) return false;
  const reference = Math.min(element.bottom - element.top, viewport.bottom - viewport.top);
  if (reference <= 0) return false;
  return visibleHeight >= reference * ratio;
}

/**
 * Recover the true viewport from the `rootBounds` of an observer configured with
 * {@link REVEAL_VIEWPORT_ROOT_MARGIN}, so both reveal observers feed the same
 * decision function instead of each contributing its own boolean.
 */
export function expandRevealViewport(shrunkRoot: GateRect, ratio = REVEAL_GATE_RATIO): GateRect {
  const height = (shrunkRoot.bottom - shrunkRoot.top) / (1 - 2 * ratio);
  const inset = height * ratio;
  return {
    top: shrunkRoot.top - inset,
    bottom: shrunkRoot.bottom + inset,
    left: shrunkRoot.left,
    right: shrunkRoot.right,
  };
}
