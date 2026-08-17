import { type Application, Container, Graphics } from "pixi.js";
import type { Ticker } from "@/components/pixi/Pixi";
import { createSnake } from "./shared/snake-pulse/snake";
import type { SnakeVisualContext } from "./shared/snake-pulse/backend";
import { resolveZoom } from "@/utils/zoom";

export type VisualContext = SnakeVisualContext & {
  app: Application;
  layer: Container;
};

export type Visual = {
  tick: (elapsed: number, dt: number) => void;
  rebuild: () => void;
};

type VisualDef = {
  create: (ctx: VisualContext) => Visual;
  mask?: boolean;
};

type SectionVisualsOptions =
  | { scopeAttr: string; rootAttr: string; registry: Record<string, VisualDef> }
  | { scopeAttr: string; rootAttr?: string; visuals: VisualDef[] };

export function createSectionVisuals(options: SectionVisualsOptions): Ticker {
  return ({ app, cleanup }) => {
    const canvas = app.canvas as HTMLCanvasElement;
    const scope = canvas.closest<HTMLElement>(`[${options.scopeAttr}]`);
    if (!scope) return;

    const roots: { root: HTMLElement; def: VisualDef }[] =
      "registry" in options
        ? Array.from(
            scope.querySelectorAll<HTMLElement>(`[${options.rootAttr}]`)
          ).flatMap((root) => {
            const key = root.getAttribute(options.rootAttr);
            const def = key === null ? undefined : options.registry[key];
            return def ? [{ root, def }] : [];
          })
        : (() => {
            const root = options.rootAttr
              ? scope.querySelector<HTMLElement>(`[${options.rootAttr}]`)
              : scope;
            if (!root) return [];
            return options.visuals.map((def) => ({ root, def }));
          })();

    const cards = roots.map(({ root, def }) => {
      const layer = new Container();
      app.stage.addChild(layer);

      let mask: Graphics | undefined;
      if (def.mask !== false) {
        mask = new Graphics();
        layer.addChild(mask);
        layer.mask = mask;
      }

      return { root, layer, mask, def };
    });

    const layout = () => {
      const zoom = resolveZoom(canvas);
      const cr = canvas.getBoundingClientRect();
      for (const { root, layer, mask } of cards) {
        const r = root.getBoundingClientRect();
        layer.position.set((r.left - cr.left) / zoom, (r.top - cr.top) / zoom);
        mask
          ?.clear()
          .rect(0, 0, r.width / zoom, r.height / zoom)
          .fill(0xffffff);
      }
    };

    layout();

    const visuals = cards.map(({ root, layer, def }) => ({
      root,
      visual: def.create({
        app,
        layer,
        root,
        cleanup,
        makeSnake: (snakeLayout, color, target, options) => {
          const snake = createSnake(snakeLayout, color, target, options);
          layer.addChild(snake.container);
          return snake;
        },
      }),
      elapsed: 0,
    }));

    const visible = new Map<HTMLElement, boolean>();
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        visible.set(entry.target as HTMLElement, entry.isIntersecting);
      }
    });
    for (const root of new Set(visuals.map((item) => item.root))) {
      visible.set(root, false);
      io.observe(root);
    }

    const tick = (ticker: { deltaMS: number }) => {
      const dt = ticker.deltaMS / 1000;
      for (const item of visuals) {
        if (!visible.get(item.root)) continue;
        item.elapsed += dt;
        item.visual.tick(item.elapsed, dt);
      }
    };
    app.ticker.add(tick);

    let raf = 0;
    let lastW = scope.clientWidth;
    let lastH = scope.clientHeight;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const w = scope.clientWidth;
        const h = scope.clientHeight;
        if (w === lastW && h === lastH) return;
        lastW = w;
        lastH = h;
        layout();
        for (const { visual } of visuals) visual.rebuild();
      });
    });
    ro.observe(scope);

    cleanup(() => {
      app.ticker.remove(tick);
      io.disconnect();
      ro.disconnect();
      cancelAnimationFrame(raf);
    });
  };
}
