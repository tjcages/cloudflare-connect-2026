import type { EngineConfig } from "../config/types";
import {
  DEFAULT_PRELOAD_ROOT_MARGIN,
  DEFAULT_RENDER_ROOT_MARGIN,
  expandRevealViewport,
  type GateRect,
  isRevealGateOpen,
  REVEAL_GATE_RATIO,
  REVEAL_VIEWPORT_ROOT_MARGIN,
} from "../core/visibility";
import { paintFramesOverlay } from "../frames/framesPaint";
import { createVideoFramePump, inferMediaKind, loadImageFrame, type VideoFramePump } from "./media";
import type { FrameSlot, InstanceId, InstanceStatsSample, MainToWorkerMessage, WorkerToMainMessage } from "./protocol";
import type { SharedShaderSourceSpec } from "./shaderSourceRenderer";
import SharedShaderWorker from "./sharedWorker?worker&inline";
import {
  publishStats,
  setStatsCollector,
  statsEnabled,
  type StripesInstanceStats,
  type StripesPassStats,
} from "./stats";

export type SharedShaderHandle = {
  setConfig(config: Partial<EngineConfig>): void;
  triggerReveal(): void;
  unregister(): void;
};

export type RegisterSharedShaderOptions = {
  canvas: HTMLCanvasElement;
  /** Media source URL. Optional when `shaderSource` supplies the texture instead. */
  src?: string;
  /** Inferred from `src` when omitted; pass only for extension-less srcs (e.g. `blob:`). */
  mediaKind?: "image" | "video";
  /**
   * Render the source texture from Shadertoy-style GLSL inside the worker —
   * no media fetch, no per-frame transfer, and the same shared GL pipeline.
   * Takes precedence over `src`.
   */
  shaderSource?: SharedShaderSourceSpec;
  /** Clamp the device pixel ratio the instance renders at. */
  maxDpr?: number;
  config?: Partial<EngineConfig>;
  revealDelayMs?: number;
  loop?: boolean;
  muted?: boolean;
  autoPlay?: boolean;
  rootMargin?: string;
  preloadRootMargin?: string;
  /** Called when the "wave" trail's 0..1 activity changes meaningfully. */
  onWaterActivity?: (activity: number) => void;
  /** Human-readable name for this instance in the debug stats readout. */
  label?: string;
};

type RegisteredInstance = {
  id: InstanceId;
  canvas: HTMLCanvasElement;
  displayCtx: CanvasRenderingContext2D | null;
  src: string;
  mediaKind: "image" | "video" | "shader";
  renderObserver: IntersectionObserver;
  revealObserver: IntersectionObserver;
  revealViewportObserver: IntersectionObserver;
  preloadObserver: IntersectionObserver | null;
  resizeObserver: ResizeObserver;
  pump: VideoFramePump | null;
  visible: boolean;
  revealGateOpen: boolean;
  disposed: boolean;
  imageRequested: boolean;
  revealDelayMs: number;
  revealArmed: boolean;
  revealTimer: ReturnType<typeof setTimeout> | null;
  onWaterActivity: ((activity: number) => void) | null;
  label: string;
  blits: number;
  /** Latest known frame cap, mirrored from config so the pump can throttle. */
  maxFps: number;
};

const FALLBACK_SIZE = 320;

let worker: Worker | null = null;
let workerMessageHandler: ((event: MessageEvent<WorkerToMainMessage>) => void) | null = null;
const instances = new Map<InstanceId, RegisteredInstance>();
let nextId = 0;
let clockRafId = 0;
let tickInFlight = false;
let visibleCount = 0;

const statsCollector = {
  start(intervalMs: number): void {
    statsSampledAt = performance.now();
    for (const instance of instances.values()) instance.blits = 0;
    if (statsTimer) clearInterval(statsTimer);
    statsTimer = setInterval(sampleStats, intervalMs);
  },
  stop(): void {
    if (statsTimer) clearInterval(statsTimer);
    statsTimer = null;
    statsPending = false;
  },
};

let statsTimer: ReturnType<typeof setInterval> | null = null;
let statsSampledAt = 0;
let statsPending = false;

function basename(src: string): string {
  const path = src.split("?")[0] ?? src;
  return path.slice(path.lastIndexOf("/") + 1) || src;
}

// Rates are per-window, so blit counters are drained here and the elapsed time
// is measured rather than assumed — a throttled or backgrounded tab reports the
// interval it actually got, not the one that was requested.
function emitStats(samples: InstanceStatsSample[]): void {
  const now = performance.now();
  const elapsed = Math.max(1, now - statsSampledAt);
  statsSampledAt = now;

  const byId = new Map(samples.map((sample) => [sample.id, sample]));
  const rows: StripesInstanceStats[] = [];
  let rendering = 0;
  let revealOpen = 0;
  let megapixelsPerFrame = 0;
  let shadedMegapixelsPerFrame = 0;
  let blits = 0;

  for (const [id, instance] of instances) {
    const sample = byId.get(id);
    const outputWidth = sample?.outputWidth ?? 0;
    const outputHeight = sample?.outputHeight ?? 0;
    const megapixels = (outputWidth * outputHeight) / 1e6;
    // A pass counts as output-resolution when its target matches the blit
    // size — those are the ones `fieldScale` provably cannot shrink.
    const passes: StripesPassStats[] = (sample?.passes ?? []).map((pass) => ({
      ...pass,
      atOutputResolution: pass.width === outputWidth && pass.height === outputHeight,
    }));
    const shadedMegapixels = passes.reduce((sum, pass) => sum + pass.pixels, 0) / 1e6;
    const instanceBlits = instance.blits;
    instance.blits = 0;
    blits += instanceBlits;
    if (instance.visible) {
      rendering++;
      megapixelsPerFrame += megapixels;
      shadedMegapixelsPerFrame += shadedMegapixels;
    }
    if (instance.revealGateOpen) revealOpen++;
    const size = readSize(instance.canvas);
    rows.push({
      id,
      label: instance.label,
      rendering: instance.visible,
      revealGateOpen: instance.revealGateOpen,
      cssWidth: size.cssWidth,
      cssHeight: size.cssHeight,
      outputWidth,
      outputHeight,
      megapixels,
      fieldWidth: sample?.fieldWidth ?? 0,
      fieldHeight: sample?.fieldHeight ?? 0,
      fieldScale: sample?.fieldScale ?? 0,
      shadedMegapixels,
      passes,
      maxFps: sample?.maxFps ?? 0,
      fps: (instanceBlits * 1000) / elapsed,
    });
  }

  publishStats({
    total: instances.size,
    rendering,
    paused: instances.size - rendering,
    revealOpen,
    megapixelsPerFrame,
    shadedMegapixelsPerFrame,
    blitsPerSecond: (blits * 1000) / elapsed,
    sampleMs: elapsed,
    instances: rows,
  });
}

function sampleStats(): void {
  if (statsPending) return;
  // Nothing has registered on this page yet, so there is no worker to answer.
  // Report the empty snapshot directly rather than leaving the subscriber
  // waiting forever on a reply that cannot arrive.
  if (!worker) {
    emitStats([]);
    return;
  }
  statsPending = true;
  post({ type: "statsRequest" });
}

setStatsCollector(statsCollector);

// The worker renders one tick per main-thread rAF: worker rAF stalls without a
// placeholder canvas, and the main clock pauses with the tab exactly like rAF.
// The loop parks itself once every instance is offscreen — the worker skips
// invisible instances anyway, so ticking through an all-hidden page is pure
// wakeup cost — and visibility transitions restart it.
function clockFrame(): void {
  if (visibleCount === 0 || instances.size === 0) {
    clockRafId = 0;
    return;
  }
  clockRafId = requestAnimationFrame(clockFrame);
  if (tickInFlight) return;
  tickInFlight = true;
  post({ type: "tick" });
}

function startClock(): void {
  if (!clockRafId) clockRafId = requestAnimationFrame(clockFrame);
}

function stopClock(): void {
  if (clockRafId) cancelAnimationFrame(clockRafId);
  clockRafId = 0;
  tickInFlight = false;
}

// Present frames on an sRGB canvas so HEX values keep the same appearance.
//
// One bitmap carries every instance that rendered on the tick, packed into
// disjoint slots, so each is cropped out here with a source rect on the blit
// that has to happen anyway — free, and it keeps the worker off
// `createImageBitmap`, a synchronous GPU copy per instance per frame.
function presentFrame(frame: ImageBitmap, slots: readonly FrameSlot[]): void {
  for (const slot of slots) {
    const instance = instances.get(slot.id);
    if (!instance || instance.disposed) continue;
    const ctx = instance.displayCtx;
    if (!ctx) continue;
    const canvas = ctx.canvas;
    if (canvas.width !== slot.width || canvas.height !== slot.height) {
      canvas.width = slot.width;
      canvas.height = slot.height;
    }
    ctx.clearRect(0, 0, slot.width, slot.height);
    ctx.drawImage(frame, slot.sx, slot.sy, slot.width, slot.height, 0, 0, slot.width, slot.height);
    // Straight onto the blit: the frames overlay draws text, and only the host
    // can measure a document font.
    if (slot.frames) paintFramesOverlay(ctx, slot.frames);
    if (statsEnabled()) instance.blits++;
  }
  frame.close();
}

function post(message: MainToWorkerMessage, transfer?: Transferable[]): void {
  if (!worker) return;
  if (transfer && transfer.length > 0) worker.postMessage(message, transfer);
  else worker.postMessage(message);
}

function ensureWorker(): Worker {
  if (worker) return worker;
  const next = new SharedShaderWorker();
  workerMessageHandler = (event: MessageEvent<WorkerToMainMessage>) => {
    const data = event.data;
    if (data.type === "error") {
      console.error(`[stripes-engine:shared] ${data.id ?? "worker"}: ${data.message}`);
    } else if (data.type === "tock") {
      tickInFlight = false;
    } else if (data.type === "frame") {
      presentFrame(data.frame, data.slots);
    } else if (data.type === "needsSource") {
      const instance = instances.get(data.id);
      if (!instance || instance.disposed) return;
      if (instance.mediaKind === "image") {
        instance.imageRequested = false;
        void loadImageFrameOnce(instance, instance.src);
      }
    } else if (data.type === "waterActivity") {
      const instance = instances.get(data.id);
      if (!instance || instance.disposed) return;
      instance.onWaterActivity?.(data.activity);
    } else if (data.type === "stats") {
      statsPending = false;
      if (statsEnabled()) emitStats(data.instances);
    }
  };
  next.addEventListener("message", workerMessageHandler);
  worker = next;
  return next;
}

function teardownWorker(): void {
  stopClock();
  visibleCount = 0;
  if (!worker) return;
  post({ type: "terminate" });
  if (workerMessageHandler) worker.removeEventListener("message", workerMessageHandler);
  worker.terminate();
  worker = null;
  workerMessageHandler = null;
}

function readDpr(canvas: HTMLCanvasElement, maxDpr?: number): number {
  const dpr = (window.devicePixelRatio || 1) * (canvas.currentCSSZoom ?? 1);
  return maxDpr != null ? Math.min(dpr, maxDpr) : dpr;
}

// Fallback root for the reveal gate when `rootBounds` is null (cross-origin iframe).
function documentViewport(): GateRect {
  const root = document.documentElement;
  return { top: 0, left: 0, right: root.clientWidth, bottom: root.clientHeight };
}

function readSize(canvas: HTMLCanvasElement): { cssWidth: number; cssHeight: number } {
  const cssWidth = canvas.clientWidth || FALLBACK_SIZE;
  const cssHeight = canvas.clientHeight || FALLBACK_SIZE;
  return { cssWidth, cssHeight };
}

function startMedia(instance: RegisteredInstance, src: string): void {
  // Shader sources render inside the worker; there is no media to start.
  if (instance.mediaKind === "shader") return;
  if (instance.revealDelayMs > 0 && !instance.revealArmed) {
    instance.revealArmed = true;
    instance.revealTimer = setTimeout(() => {
      instance.revealTimer = null;
      if (!instance.disposed) startMedia(instance, src);
    }, instance.revealDelayMs);
    return;
  }
  if (instance.revealTimer) return;
  if (instance.mediaKind === "video") {
    instance.pump?.start((bmp) => {
      post({ type: "source", id: instance.id, frame: bmp, isStream: true }, [bmp]);
    });
    return;
  }
  void loadImageFrameOnce(instance, src);
}

async function loadImageFrameOnce(instance: RegisteredInstance, src: string): Promise<void> {
  if (instance.imageRequested) return;
  instance.imageRequested = true;
  try {
    const frame = await loadImageFrame(src);
    if (instance.disposed) {
      frame.close();
      return;
    }
    post({ type: "source", id: instance.id, frame, isStream: false }, [frame]);
  } catch (error) {
    console.error(`[stripes-engine:shared] ${instance.id}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function stopMedia(instance: RegisteredInstance): void {
  if (instance.mediaKind === "video") instance.pump?.stop();
}

export function registerSharedShader(opts: RegisterSharedShaderOptions): SharedShaderHandle {
  ensureWorker();

  const id: InstanceId = `shared-${nextId++}`;
  const { canvas } = opts;
  const src = opts.src ?? "";
  const mediaKind = opts.shaderSource ? "shader" : (opts.mediaKind ?? inferMediaKind(src));

  // Present on a 2D display-p3 context: readbacks honor a P3-tagged ImageBitmap,
  // but the compositor paints bitmaprenderer canvases as sRGB (clipping P3).
  const displayCtx = canvas.getContext("2d", { colorSpace: "display-p3" });
  const { cssWidth, cssHeight } = readSize(canvas);
  const dpr = readDpr(canvas, opts.maxDpr);

  post({
    type: "register",
    id,
    cssWidth,
    cssHeight,
    dpr,
    config: opts.config,
    shaderSource: opts.shaderSource,
  });

  const pump =
    mediaKind === "video"
      ? createVideoFramePump({
          src,
          loop: opts.loop ?? true,
          muted: opts.muted ?? true,
          autoPlay: opts.autoPlay ?? true,
          getMaxFps: () => instance.maxFps,
        })
      : null;

  const instance: RegisteredInstance = {
    id,
    canvas,
    displayCtx,
    src,
    mediaKind,
    pump,
    visible: false,
    disposed: false,
    imageRequested: false,
    revealDelayMs: opts.revealDelayMs ?? 0,
    revealArmed: false,
    revealTimer: null,
    onWaterActivity: opts.onWaterActivity ?? null,
    label: opts.label ?? (mediaKind === "shader" ? "shader" : basename(src)),
    blits: 0,
    maxFps: opts.config?.maxFps ?? 0,
    revealGateOpen: false,
    renderObserver: undefined as unknown as IntersectionObserver,
    revealObserver: undefined as unknown as IntersectionObserver,
    revealViewportObserver: undefined as unknown as IntersectionObserver,
    preloadObserver: null,
    resizeObserver: undefined as unknown as ResizeObserver,
  };

  // RENDER GATE: any on-screen pixel renders, so a visible canvas is never
  // frozen and nothing offscreen burns GPU. `rootMargin` stays a public prop for
  // consumers that want to widen it; only the default is tight.
  const renderObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const visible = entry.isIntersecting;
        if (visible === instance.visible) continue;
        instance.visible = visible;
        visibleCount += visible ? 1 : -1;
        post({ type: "visibility", id, visible });
        if (visible) {
          startClock();
          startMedia(instance, src);
        } else {
          stopMedia(instance);
        }
      }
    },
    { rootMargin: opts.rootMargin ?? DEFAULT_RENDER_ROOT_MARGIN },
  );

  // REVEAL GATE: the reveal is a one-shot animation and the viewer has to be
  // able to see it, so its clock only advances once a meaningful slice of the
  // element is on screen. Both observers below are only trigger sources — the
  // decision itself is `isRevealGateOpen`, computed from the rects, so a fast
  // scroll that skips threshold buckets still lands on the right answer.
  //
  // The first observer covers the element-relative clause (its 0.25 threshold
  // fires exactly at that crossing). The second covers the viewport-relative
  // clause: for an element taller than 1/ratio viewports, `intersectionRatio`
  // is capped below 0.25 and could never fire, so a root shrunk by the same
  // ratio provides that crossing instead.
  const syncRevealGate = (element: GateRect, viewport: GateRect): void => {
    const open = isRevealGateOpen(element, viewport);
    if (open === instance.revealGateOpen) return;
    instance.revealGateOpen = open;
    post({ type: "revealGate", id, open });
  };
  const revealObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) syncRevealGate(entry.boundingClientRect, entry.rootBounds ?? documentViewport());
    },
    { rootMargin: DEFAULT_RENDER_ROOT_MARGIN, threshold: [0, REVEAL_GATE_RATIO] },
  );
  const revealViewportObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const viewport = entry.rootBounds ? expandRevealViewport(entry.rootBounds) : documentViewport();
        syncRevealGate(entry.boundingClientRect, viewport);
      }
    },
    { rootMargin: REVEAL_VIEWPORT_ROOT_MARGIN },
  );

  // Preload gate, separate from the render gate above. A tight render `rootMargin`
  // keeps offscreen instances from rendering, but images must still load ahead of
  // the viewport to avoid pop-in — so this wider `preloadRootMargin` starts the
  // image load only, then disconnects after the first intersection. Video decode
  // stays driven purely by the render observer (visibility start/stop).
  let preloadObserver: IntersectionObserver | null = null;
  if (mediaKind === "image") {
    preloadObserver = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        preloadObserver?.disconnect();
        startMedia(instance, src);
      },
      { rootMargin: opts.preloadRootMargin ?? DEFAULT_PRELOAD_ROOT_MARGIN },
    );
  }

  const resizeObserver = new ResizeObserver(() => {
    const size = readSize(canvas);
    post({ type: "resize", id, cssWidth: size.cssWidth, cssHeight: size.cssHeight, dpr: readDpr(canvas, opts.maxDpr) });
  });

  let pointerInside = false;
  let lastClientX = Number.NaN;
  let lastClientY = Number.NaN;
  const hitTest = (clientX: number, clientY: number) => {
    const rect = canvas.getBoundingClientRect();
    const inside = clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
    if (inside) {
      pointerInside = true;
      const zoom = canvas.currentCSSZoom ?? 1;
      post({ type: "cursor", id, x: (clientX - rect.left) / zoom, y: (clientY - rect.top) / zoom });
    } else if (pointerInside) {
      pointerInside = false;
      post({ type: "cursor", id, x: null });
    }
  };
  const onPointerMove = (e: PointerEvent) => {
    lastClientX = e.clientX;
    lastClientY = e.clientY;
    hitTest(lastClientX, lastClientY);
  };
  // Scrolling moves the canvas under a stationary pointer, which fires no
  // pointer event; re-test so the cursor doesn't stick inside or outside.
  const onScroll = () => {
    if (!Number.isNaN(lastClientX)) hitTest(lastClientX, lastClientY);
  };
  const onDocumentLeave = () => {
    if (!pointerInside) return;
    pointerInside = false;
    post({ type: "cursor", id, x: null });
  };
  const onPointerDown = (e: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    const inside =
      e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
    if (!inside) return;
    const zoom = canvas.currentCSSZoom ?? 1;
    post({ type: "click", id, x: (e.clientX - rect.left) / zoom, y: (e.clientY - rect.top) / zoom });
  };

  instance.renderObserver = renderObserver;
  instance.revealObserver = revealObserver;
  instance.revealViewportObserver = revealViewportObserver;
  instance.preloadObserver = preloadObserver;
  instance.resizeObserver = resizeObserver;
  instances.set(id, instance);
  startClock();

  renderObserver.observe(canvas);
  revealObserver.observe(canvas);
  revealViewportObserver.observe(canvas);
  preloadObserver?.observe(canvas);
  resizeObserver.observe(canvas);
  window.addEventListener("pointermove", onPointerMove);
  document.addEventListener("pointerleave", onDocumentLeave);
  window.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("scroll", onScroll, true);

  return {
    setConfig(config: Partial<EngineConfig>) {
      if (config.maxFps != null) instance.maxFps = config.maxFps;
      post({ type: "setConfig", id, config });
    },
    triggerReveal() {
      post({ type: "reveal", id });
    },
    unregister() {
      if (instance.disposed) return;
      instance.disposed = true;
      if (instance.visible) {
        instance.visible = false;
        visibleCount -= 1;
      }
      if (instance.revealTimer) {
        clearTimeout(instance.revealTimer);
        instance.revealTimer = null;
      }
      renderObserver.disconnect();
      revealObserver.disconnect();
      revealViewportObserver.disconnect();
      preloadObserver?.disconnect();
      resizeObserver.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerleave", onDocumentLeave);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("scroll", onScroll, true);
      instance.pump?.dispose();
      post({ type: "unregister", id });
      instances.delete(id);
      if (instances.size === 0) teardownWorker();
    },
  };
}
