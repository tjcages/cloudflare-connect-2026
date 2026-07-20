import { createEngineContext, type EngineContext } from "./context";

export type RenderSurface = {
  acquireContext(): EngineContext;
  getDpr(): number;
  setDpr(dpr: number): void;
  applyOutputSize(width: number, height: number): void;
  attachContextLossListeners(onLost: (e: Event) => void, onRestored: () => void): void;
  detachContextLossListeners(): void;
  supportsRaf: boolean;
};

export function createCanvasSurface(canvas: HTMLCanvasElement, dprOverride?: number): RenderSurface {
  let onLost: ((e: Event) => void) | null = null;
  let onRestored: (() => void) | null = null;
  return {
    acquireContext() {
      return createEngineContext(canvas);
    },
    getDpr() {
      if (dprOverride !== undefined) return dprOverride;
      const dpr = (typeof window !== "undefined" ? window.devicePixelRatio : 1) ?? 1;
      return dpr * (canvas.currentCSSZoom ?? 1);
    },
    setDpr(dpr: number) {
      dprOverride = dpr;
    },
    applyOutputSize(width: number, height: number) {
      if (canvas.width !== width) canvas.width = width;
      if (canvas.height !== height) canvas.height = height;
    },
    attachContextLossListeners(lost, restored) {
      onLost = lost;
      onRestored = restored;
      canvas.addEventListener("webglcontextlost", lost as EventListener, false);
      canvas.addEventListener("webglcontextrestored", restored as EventListener, false);
    },
    detachContextLossListeners() {
      if (onLost) canvas.removeEventListener("webglcontextlost", onLost as EventListener);
      if (onRestored) canvas.removeEventListener("webglcontextrestored", onRestored as EventListener);
      onLost = null;
      onRestored = null;
    },
    supportsRaf: true,
  };
}

export function createSharedSurface(context: EngineContext, dpr: number): RenderSurface {
  let currentDpr = dpr;
  return {
    acquireContext() {
      return context;
    },
    getDpr() {
      return currentDpr;
    },
    setDpr(next: number) {
      currentDpr = next;
    },
    applyOutputSize() {},
    attachContextLossListeners() {},
    detachContextLossListeners() {},
    supportsRaf: false,
  };
}
