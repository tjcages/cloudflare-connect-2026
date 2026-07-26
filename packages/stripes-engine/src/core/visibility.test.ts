import { describe, expect, it } from "vitest";
import {
  DEFAULT_PRELOAD_ROOT_MARGIN,
  DEFAULT_RENDER_ROOT_MARGIN,
  expandRevealViewport,
  type GateRect,
  isRevealGateOpen,
  REVEAL_GATE_RATIO,
  REVEAL_VIEWPORT_ROOT_MARGIN,
} from "./visibility";

const VIEWPORT_HEIGHT = 800;
const viewport: GateRect = { top: 0, left: 0, right: 1200, bottom: VIEWPORT_HEIGHT };

/** An element `height` tall whose top edge sits at `top` in viewport coordinates. */
function element(top: number, height: number, left = 0, width = 400): GateRect {
  return { top, bottom: top + height, left, right: left + width };
}

/** What an IntersectionObserver would report as `intersectionRatio` for this element. */
function intersectionRatio(rect: GateRect, root: GateRect = viewport): number {
  const w = Math.max(0, Math.min(rect.right, root.right) - Math.max(rect.left, root.left));
  const h = Math.max(0, Math.min(rect.bottom, root.bottom) - Math.max(rect.top, root.top));
  const area = (rect.right - rect.left) * (rect.bottom - rect.top);
  return area <= 0 ? 0 : (w * h) / area;
}

describe("render gate defaults", () => {
  it("renders on any on-screen pixel, and preloads far ahead of it", () => {
    expect(DEFAULT_RENDER_ROOT_MARGIN).toBe("0px");
    expect(DEFAULT_PRELOAD_ROOT_MARGIN).toBe("200% 0px");
  });
});

describe("reveal gate — element-relative clause", () => {
  it("holds below a quarter of the element's own height", () => {
    expect(isRevealGateOpen(element(VIEWPORT_HEIGHT - 99, 400), viewport)).toBe(false);
  });

  it("opens at exactly a quarter of the element's own height", () => {
    expect(isRevealGateOpen(element(VIEWPORT_HEIGHT - 100, 400), viewport)).toBe(true);
  });

  it("stays open for an element wholly inside the viewport", () => {
    expect(isRevealGateOpen(element(100, 400), viewport)).toBe(true);
  });

  it("holds for a one-pixel sliver, which is enough to render but not to reveal", () => {
    expect(isRevealGateOpen(element(VIEWPORT_HEIGHT - 1, 400), viewport)).toBe(false);
  });

  it("holds again once the element leaves", () => {
    expect(isRevealGateOpen(element(VIEWPORT_HEIGHT + 10, 400), viewport)).toBe(false);
    expect(isRevealGateOpen(element(-410, 400), viewport)).toBe(false);
  });
});

describe("reveal gate — viewport-relative clause is what makes it deadlock-proof", () => {
  it("an element taller than 1/ratio viewports can never satisfy an element-relative test", () => {
    const tall = element(0, VIEWPORT_HEIGHT * 5);
    let best = 0;
    for (let top = -VIEWPORT_HEIGHT * 5; top <= VIEWPORT_HEIGHT; top += 10) {
      best = Math.max(best, intersectionRatio(element(top, VIEWPORT_HEIGHT * 5)));
    }
    expect(intersectionRatio(tall)).toBeLessThan(REVEAL_GATE_RATIO);
    // The cap is viewport/element — 0.2 here — so `threshold: 0.25` never fires.
    expect(best).toBeCloseTo(0.2, 5);
    expect(best).toBeLessThan(REVEAL_GATE_RATIO);
  });

  it("but the gate still opens for it, off a quarter of the VIEWPORT height", () => {
    const tall = VIEWPORT_HEIGHT * 5;
    expect(isRevealGateOpen(element(VIEWPORT_HEIGHT - 199, tall), viewport)).toBe(false);
    expect(isRevealGateOpen(element(VIEWPORT_HEIGHT - 200, tall), viewport)).toBe(true);
  });

  it("opens even for an absurdly tall element (100 viewports)", () => {
    const tall = VIEWPORT_HEIGHT * 100;
    expect(isRevealGateOpen(element(VIEWPORT_HEIGHT - 200, tall), viewport)).toBe(true);
    expect(intersectionRatio(element(VIEWPORT_HEIGHT - 200, tall))).toBeLessThan(0.01);
  });

  it("is reachable at some scroll position for EVERY element height — no deadlock by construction", () => {
    for (const height of [1, 10, 200, 799, 800, 801, 3200, 3201, 80000]) {
      const reachable = [];
      for (let top = -height - VIEWPORT_HEIGHT; top <= VIEWPORT_HEIGHT + height; top += 1) {
        if (isRevealGateOpen(element(top, height), viewport)) reachable.push(top);
      }
      expect(reachable.length, `height ${height} never opens the reveal gate`).toBeGreaterThan(0);
    }
  });
});

describe("reveal gate — guards", () => {
  it("holds while the element is off to the side, however tall it is on screen", () => {
    expect(isRevealGateOpen(element(0, 400, -500, 400), viewport)).toBe(false);
    expect(isRevealGateOpen(element(0, 400, 1200, 400), viewport)).toBe(false);
  });

  it("opens off a single on-screen column, since the gate is a vertical measure", () => {
    expect(isRevealGateOpen(element(0, 400, -399, 400), viewport)).toBe(true);
  });

  it("holds for a degenerate element or viewport", () => {
    expect(isRevealGateOpen(element(0, 0), viewport)).toBe(false);
    expect(isRevealGateOpen(element(0, 400), { top: 0, left: 0, right: 1200, bottom: 0 })).toBe(false);
  });
});

describe("reveal viewport observer root", () => {
  it("shrinks the root by the gate ratio, top and bottom", () => {
    expect(REVEAL_VIEWPORT_ROOT_MARGIN).toBe("-25% 0px");
  });

  it("recovers the true viewport from the shrunken root bounds", () => {
    const shrunk: GateRect = { top: 200, left: 0, right: 1200, bottom: 600 };
    expect(expandRevealViewport(shrunk)).toEqual(viewport);
  });

  it("recovers a scrolled-iframe root too, keeping the horizontal bounds", () => {
    const shrunk: GateRect = { top: 150, left: 40, right: 440, bottom: 350 };
    expect(expandRevealViewport(shrunk)).toEqual({ top: 50, left: 40, right: 440, bottom: 450 });
  });

  it("agrees with the gate exactly where the viewport clause bites", () => {
    // An element far taller than the viewport intersects the shrunken root at
    // precisely the point the viewport-relative clause opens: its top edge
    // crosses the shrunken root's bottom edge.
    const tall = VIEWPORT_HEIGHT * 5;
    const shrunk: GateRect = { top: 200, left: 0, right: 1200, bottom: 600 };
    const held = element(601, tall);
    const revealing = element(599, tall);
    expect(held.top < shrunk.bottom).toBe(false);
    expect(revealing.top < shrunk.bottom).toBe(true);
    expect(isRevealGateOpen(held, expandRevealViewport(shrunk))).toBe(false);
    expect(isRevealGateOpen(revealing, expandRevealViewport(shrunk))).toBe(true);
  });
});
