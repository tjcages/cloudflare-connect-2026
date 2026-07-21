import { useEffect, useMemo, useRef, useState } from "react";
import type { StripesEngine } from "@necatikcl/stripes-engine";
import type { ExperimentCategory, ExperimentDefinition, ExperimentInstance } from "./experiments/types";

const TEXTURE_URL = "/textures/cf-base.png";
const MAX_LIVE_INSTANCES = 8;
const VISIBILITY_ROOT_MARGIN = "600px 0px";
const DEACTIVATE_LINGER_MS = 500;
const CATEGORY_ORDER: ExperimentCategory[] = ["trail", "click", "reveal", "ambience", "stars"];
const CATEGORY_CHIP: Record<ExperimentCategory, string> = {
  trail: "bg-sky-500/15 text-sky-300",
  click: "bg-amber-500/15 text-amber-300",
  reveal: "bg-emerald-500/15 text-emerald-300",
  ambience: "bg-violet-500/15 text-violet-300",
  stars: "bg-rose-500/15 text-rose-300",
};

const experimentModules = import.meta.glob<{ default: ExperimentDefinition }>("./experiments/*.experiment.{ts,tsx}", {
  eager: true,
});
const EXPERIMENTS: ExperimentDefinition[] = Object.values(experimentModules)
  .map((m) => m.default)
  .sort((a, b) => {
    const byCategory = CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category);
    return byCategory !== 0 ? byCategory : a.id.localeCompare(b.id);
  });

type TileEntry = {
  el: Element;
  setWantLive: (live: boolean) => void;
  intersecting: boolean;
  lastVisibleAt: number;
  live: boolean;
  lingerTimer: number;
};

type LifecycleManager = {
  register(el: Element, setWantLive: (live: boolean) => void): void;
  unregister(el: Element): void;
  dispose(): void;
};

function createLifecycleManager(maxLive: number): LifecycleManager {
  const tiles = new Map<Element, TileEntry>();

  const liveCount = () => {
    let n = 0;
    for (const t of tiles.values()) if (t.live) n++;
    return n;
  };

  const activate = (t: TileEntry) => {
    t.live = true;
    t.setWantLive(true);
  };

  const deactivate = (t: TileEntry) => {
    t.live = false;
    t.setWantLive(false);
  };

  const findVictim = (): TileEntry | null => {
    let victim: TileEntry | null = null;
    for (const t of tiles.values()) {
      if (!t.live || t.intersecting) continue;
      if (!victim || t.lastVisibleAt < victim.lastVisibleAt) victim = t;
    }
    return victim;
  };

  const reconcile = () => {
    for (const t of tiles.values()) {
      if (t.intersecting) {
        if (t.lingerTimer) {
          window.clearTimeout(t.lingerTimer);
          t.lingerTimer = 0;
        }
        if (!t.live) {
          if (liveCount() < maxLive) {
            activate(t);
          } else {
            const victim = findVictim();
            if (victim) {
              deactivate(victim);
              activate(t);
            }
          }
        }
      } else if (t.live && !t.lingerTimer) {
        t.lingerTimer = window.setTimeout(() => {
          t.lingerTimer = 0;
          if (!t.intersecting && t.live) {
            deactivate(t);
            reconcile();
          }
        }, DEACTIVATE_LINGER_MS);
      }
    }
  };

  const io = new IntersectionObserver(
    (entries) => {
      const now = performance.now();
      for (const entry of entries) {
        const t = tiles.get(entry.target);
        if (!t) continue;
        t.intersecting = entry.isIntersecting;
        if (entry.isIntersecting) t.lastVisibleAt = now;
      }
      reconcile();
    },
    { rootMargin: VISIBILITY_ROOT_MARGIN },
  );

  return {
    register(el, setWantLive) {
      tiles.set(el, { el, setWantLive, intersecting: false, lastVisibleAt: 0, live: false, lingerTimer: 0 });
      io.observe(el);
    },
    unregister(el) {
      const t = tiles.get(el);
      if (!t) return;
      if (t.lingerTimer) window.clearTimeout(t.lingerTimer);
      io.unobserve(el);
      tiles.delete(el);
      reconcile();
    },
    dispose() {
      for (const t of tiles.values()) if (t.lingerTimer) window.clearTimeout(t.lingerTimer);
      tiles.clear();
      io.disconnect();
    },
  };
}

function pointerToEnginePoint(canvas: HTMLCanvasElement, e: PointerEvent): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  const engineW = Number.parseFloat(canvas.style.width) || rect.width || 1;
  const engineH = Number.parseFloat(canvas.style.height) || rect.height || 1;
  return {
    x: ((e.clientX - rect.left) * engineW) / Math.max(1, rect.width),
    y: ((e.clientY - rect.top) * engineH) / Math.max(1, rect.height),
  };
}

function wireEnginePointer(canvas: HTMLCanvasElement, engine: StripesEngine): () => void {
  const onMove = (e: PointerEvent) => {
    const point = pointerToEnginePoint(canvas, e);
    engine.setCursor(point.x, point.y);
  };
  const onLeave = () => engine.setCursor(null);
  const onDown = (e: PointerEvent) => {
    const point = pointerToEnginePoint(canvas, e);
    engine.click(point.x, point.y);
    canvas.setPointerCapture?.(e.pointerId);
  };
  const onUp = (e: PointerEvent) => {
    canvas.releasePointerCapture?.(e.pointerId);
  };
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerleave", onLeave);
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onUp);
  return () => {
    canvas.removeEventListener("pointermove", onMove);
    canvas.removeEventListener("pointerleave", onLeave);
    canvas.removeEventListener("pointerdown", onDown);
    canvas.removeEventListener("pointerup", onUp);
    canvas.removeEventListener("pointercancel", onUp);
  };
}

function ExperimentTile({
  def,
  manager,
  stripesDebug,
}: {
  def: ExperimentDefinition;
  manager: LifecycleManager;
  stripesDebug: boolean;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const instanceRef = useRef<ExperimentInstance | null>(null);
  const deadCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const stripesDebugRef = useRef(stripesDebug);
  stripesDebugRef.current = stripesDebug;
  const [wantLive, setWantLive] = useState(false);
  const [epoch, setEpoch] = useState(0);
  const [hasReplay, setHasReplay] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    manager.register(el, setWantLive);
    return () => manager.unregister(el);
  }, [manager]);

  useEffect(() => {
    if (!wantLive) return;
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || canvas === deadCanvasRef.current) return;
    const cssW = Math.max(1, Math.round(container.clientWidth));
    const cssH = Math.max(1, Math.round(container.clientHeight));
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    const instance = def.create({ canvas, container, textureUrl: TEXTURE_URL });
    instanceRef.current = instance;
    instance.engine?.resize(cssW, cssH);
    if (stripesDebugRef.current) instance.engine?.setConfig({ stripesEnabled: false });
    setHasReplay(!!instance.replay);
    const unwire = instance.engine && def.pointer !== "custom" ? wireEnginePointer(canvas, instance.engine) : null;
    const resizeObserver = new ResizeObserver(() => {
      const w = Math.max(1, Math.round(container.clientWidth));
      const h = Math.max(1, Math.round(container.clientHeight));
      if (canvas.style.width === `${w}px` && canvas.style.height === `${h}px`) return;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      instance.engine?.resize(w, h);
    });
    resizeObserver.observe(container);
    return () => {
      resizeObserver.disconnect();
      unwire?.();
      instance.destroy();
      instanceRef.current = null;
      canvas.getContext("webgl2")?.getExtension("WEBGL_lose_context")?.loseContext();
      deadCanvasRef.current = canvas;
      setEpoch((e) => e + 1);
    };
  }, [wantLive, epoch, def, manager]);

  useEffect(() => {
    instanceRef.current?.engine?.setConfig({ stripesEnabled: !stripesDebug });
  }, [stripesDebug, wantLive, epoch]);

  return (
    <article className="flex flex-col overflow-hidden rounded-xl border border-white/10 bg-neutral-900/60">
      <div ref={containerRef} className="relative aspect-[16/10] overflow-hidden bg-neutral-950">
        <canvas key={epoch} ref={canvasRef} className="absolute top-0 left-0" />
        {!wantLive && (
          <div className="absolute inset-0 grid place-items-center">
            <span className="text-[11px] tracking-widest text-neutral-600 uppercase">paused</span>
          </div>
        )}
      </div>
      <div className="flex flex-col gap-1.5 px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-medium text-neutral-100">{def.title}</h2>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] tracking-wider uppercase ${CATEGORY_CHIP[def.category]}`}
          >
            {def.category}
          </span>
          <span className="ml-auto flex items-center gap-1.5 text-[11px] text-neutral-500">
            <span className={`size-1.5 rounded-full ${wantLive ? "bg-emerald-400" : "bg-neutral-600"}`} />
            {wantLive ? "live" : "paused"}
          </span>
          {wantLive && hasReplay && (
            <button
              type="button"
              onClick={() => instanceRef.current?.replay?.()}
              className="rounded-md border border-white/15 px-2 py-0.5 text-[11px] text-neutral-300 transition-colors hover:bg-white/10 hover:text-white"
            >
              Replay
            </button>
          )}
        </div>
        <p className="text-xs leading-relaxed text-neutral-400">{def.blurb}</p>
      </div>
    </article>
  );
}

export function ExperimentsApp() {
  const [filter, setFilter] = useState<ExperimentCategory | "all">("all");
  const [stripesDebug, setStripesDebug] = useState(false);
  const managerRef = useRef<LifecycleManager | null>(null);
  managerRef.current ??= createLifecycleManager(MAX_LIVE_INSTANCES);
  const manager = managerRef.current;

  useEffect(() => {
    return () => manager.dispose();
  }, [manager]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "KeyS" || !e.shiftKey || e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      const target = e.target;
      if (target instanceof HTMLElement) {
        const tag = target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable) return;
      }
      e.preventDefault();
      setStripesDebug((on) => !on);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const visible = useMemo(
    () => (filter === "all" ? EXPERIMENTS : EXPERIMENTS.filter((d) => d.category === filter)),
    [filter],
  );

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-200">
      <header className="mx-auto flex max-w-[1800px] flex-wrap items-center gap-3 px-6 pt-8 pb-4">
        <h1 className="text-lg font-semibold text-white">Stripes Experiments</h1>
        <span className="text-xs text-neutral-500">
          {visible.length} of {EXPERIMENTS.length}
        </span>
        <span className="text-xs text-neutral-500">
          <kbd className="rounded border border-white/15 px-1.5 py-0.5 font-mono text-[10px] text-neutral-300">
            Shift+S
          </kbd>{" "}
          toggles stripes off to inspect the raw field
        </span>
        <nav className="ml-auto flex flex-wrap gap-1.5">
          {(["all", ...CATEGORY_ORDER] as const).map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => setFilter(category)}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                filter === category
                  ? "border-white/25 bg-white/10 text-white"
                  : "border-white/10 text-neutral-400 hover:text-neutral-200"
              }`}
            >
              {category}
            </button>
          ))}
        </nav>
      </header>
      <main className="mx-auto grid max-w-[1800px] grid-cols-1 gap-5 px-6 pb-12 min-[900px]:grid-cols-2">
        {visible.map((def) => (
          <ExperimentTile key={def.id} def={def} manager={manager} stripesDebug={stripesDebug} />
        ))}
      </main>
      {stripesDebug && (
        <div className="pointer-events-none fixed bottom-4 left-4 z-50 rounded-full border border-amber-400/30 bg-amber-500/15 px-3 py-1 font-mono text-[10px] tracking-widest text-amber-200 uppercase backdrop-blur-sm">
          Debug · Stripes off · Shift+S
        </div>
      )}
    </div>
  );
}
