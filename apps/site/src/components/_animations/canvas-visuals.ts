import type { Container } from "./canvas2d/scene";
import {
  type CanvasPainter,
  createCanvasPainter,
} from "./shared/snake-pulse/canvas-snake";
import type { SnakeVisualContext } from "./shared/snake-pulse/backend";
import type { Visual } from "./section-visuals";

const MAX_STEP = 0.1;

export type FrameTicker = {
  add: (fn: (ticker: { deltaMS: number }) => void) => void;
  remove: (fn: (ticker: { deltaMS: number }) => void) => void;
};

export type CanvasVisualContext = SnakeVisualContext & {
  layer: Container;
  host: HTMLElement;
  ticker: FrameTicker;
};

type CanvasVisualDef = {
  create: (ctx: CanvasVisualContext) => Visual;
};

export type CanvasVisualRegistry = Record<string, CanvasVisualDef>;

export function createCanvasVisuals(
  scope: HTMLElement,
  { rootAttr, registry }: { rootAttr: string; registry: CanvasVisualRegistry }
): () => void {
  const cleanupFunctions: (() => void)[] = [];
  const cleanup = (fn: () => void) => cleanupFunctions.push(fn);
  const dispose = () => {
    for (let i = cleanupFunctions.length - 1; i >= 0; i--)
      cleanupFunctions[i]();
  };

  // The scope element can itself be the root (a section with a single visual),
  // and querySelectorAll only walks descendants.
  const found = Array.from(
    scope.querySelectorAll<HTMLElement>(`[${rootAttr}]`)
  );
  if (scope.hasAttribute(rootAttr)) found.unshift(scope);

  const tickers = new Set<(ticker: { deltaMS: number }) => void>();
  const ticker: FrameTicker = {
    add: (fn) => tickers.add(fn),
    remove: (fn) => tickers.delete(fn),
  };

  const visuals = found.flatMap((root) => {
    const key = root.getAttribute(rootAttr);
    const def = key === null ? undefined : registry[key];
    if (!def) return [];

    const layer = document.createElement("div");
    layer.setAttribute("aria-hidden", "true");
    layer.setAttribute("data-visual-layer", "");
    layer.className = "pointer-events-none absolute inset-0 size-full";
    root.appendChild(layer);
    cleanup(() => layer.remove());

    const painter: CanvasPainter = createCanvasPainter(layer);
    cleanup(painter.destroy);

    return [
      {
        root,
        layer,
        painter,
        create: def.create,
        visual: null as Visual | null,
        elapsed: 0,
      },
    ];
  });

  if (visuals.length === 0) return dispose;

  const visible = new Map<HTMLElement, boolean>();
  let frame = 0;
  let last = 0;

  const step = (now: number) => {
    frame = requestAnimationFrame(step);
    const dt = Math.min((now - last) / 1000, MAX_STEP);
    last = now;
    for (const item of visuals) {
      if (!visible.get(item.root)) continue;
      // Built on first paint-visible frame, not at mount: island-rendered chips
      // may not exist yet when this runner starts.
      item.visual ??= item.create({
        layer: item.painter.root,
        host: item.layer,
        ticker,
        root: item.root,
        cleanup,
        makeSnake: item.painter.makeSnake,
      });
      item.elapsed += dt;
      item.visual.tick(item.elapsed, dt);
      for (const fn of tickers) fn({ deltaMS: dt * 1000 });
      item.painter.paint();
    }
  };

  const sync = () => {
    const anyVisible = Array.from(visible.values()).some(Boolean);
    if (anyVisible && !frame) {
      last = performance.now();
      frame = requestAnimationFrame(step);
    } else if (!anyVisible && frame) {
      cancelAnimationFrame(frame);
      frame = 0;
    }
  };

  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      visible.set(entry.target as HTMLElement, entry.isIntersecting);
    }
    sync();
  });
  for (const root of new Set(visuals.map((item) => item.root))) {
    visible.set(root, false);
    io.observe(root);
  }

  let resizeFrame = 0;
  let lastW = scope.clientWidth;
  let lastH = scope.clientHeight;
  const ro = new ResizeObserver(() => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => {
      const w = scope.clientWidth;
      const h = scope.clientHeight;
      if (w === lastW && h === lastH) return;
      lastW = w;
      lastH = h;
      for (const item of visuals) item.visual?.rebuild();
    });
  });
  ro.observe(scope);

  cleanup(() => {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    cancelAnimationFrame(resizeFrame);
    io.disconnect();
    ro.disconnect();
  });

  return dispose;
}
