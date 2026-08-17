import { lazy, Suspense, useLayoutEffect, useState } from "react";
import CanvasVisuals from "./CanvasVisuals";

// Lazy so a page whose sections are all on the 2d backend never pulls pixi.js
// into its island graph.
const PixiLayer = lazy(() => import("./PixiLayer"));
import { splitByBackend } from "./shared/snake-pulse/backend";
import type { CanvasVisualContext } from "./canvas-visuals";
import type { SnakeVisualContext } from "./shared/snake-pulse/backend";
import type { Visual } from "./section-visuals";

type Box = { left: number; top: number; width: number; height: number };

function useServedBox(scopeAttr: string, rootAttr: string, keys: string[]) {
  const [box, setBox] = useState<Box | null>(null);
  const signature = keys.join("|");

  useLayoutEffect(() => {
    const scope = document.querySelector<HTMLElement>(`[${scopeAttr}]`);
    if (!scope || keys.length === 0) return;

    const measure = () => {
      const served = Array.from(
        scope.querySelectorAll<HTMLElement>(`[${rootAttr}]`)
      ).filter((el) => keys.includes(el.getAttribute(rootAttr) ?? ""));
      if (served.length === 0) return;

      const scopeRect = scope.getBoundingClientRect();
      let left = Infinity;
      let top = Infinity;
      let right = -Infinity;
      let bottom = -Infinity;
      for (const el of served) {
        const r = el.getBoundingClientRect();
        left = Math.min(left, r.left);
        top = Math.min(top, r.top);
        right = Math.max(right, r.right);
        bottom = Math.max(bottom, r.bottom);
      }
      setBox({
        left: left - scopeRect.left,
        top: top - scopeRect.top,
        width: right - left,
        height: bottom - top,
      });
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(scope);
    return () => ro.disconnect();
  }, [scopeAttr, rootAttr, signature]);

  return box;
}

export default function DualCanvas({
  scopeAttr,
  rootAttr,
  registry,
  canvasOnly,
}: {
  scopeAttr: string;
  rootAttr: string;
  registry: Record<string, { create: (ctx: SnakeVisualContext) => Visual }>;
  canvasOnly?: Record<string, { create: (ctx: CanvasVisualContext) => Visual }>;
}) {
  "use no memo";

  const { canvas, pixi } = splitByBackend(registry);
  const pixiRegistry = { ...pixi };
  const canvasRegistry = { ...canvas, ...canvasOnly };
  const pixiKeys = Object.keys(pixiRegistry);
  const box = useServedBox(scopeAttr, rootAttr, pixiKeys);
  // Pixi reads clientWidth/Height once at init, so the canvas is not rendered
  // until the served roots have been measured.
  return (
    <>
      {pixiKeys.length > 0 && box && (
        <Suspense fallback={null}>
          <PixiLayer
            scopeAttr={scopeAttr}
            rootAttr={rootAttr}
            registry={pixiRegistry}
            box={box}
          />
        </Suspense>
      )}

      {Object.keys(canvasRegistry).length > 0 && (
        <CanvasVisuals
          scopeAttr={scopeAttr}
          rootAttr={rootAttr}
          registry={canvasRegistry}
        />
      )}
    </>
  );
}
