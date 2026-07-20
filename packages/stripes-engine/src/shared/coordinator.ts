import type { EngineConfig } from "../config/types";
import { createVideoFramePump, loadImageFrame, type VideoFramePump } from "./media";
import type { InstanceId, MainToWorkerMessage, WorkerToMainMessage } from "./protocol";
import SharedShaderWorker from "./sharedWorker?worker&inline";

export type SharedShaderHandle = {
  setConfig(config: Partial<EngineConfig>): void;
  triggerReveal(): void;
  unregister(): void;
};

export type RegisterSharedShaderOptions = {
  canvas: HTMLCanvasElement;
  src: string;
  mediaKind: "image" | "video";
  config?: Partial<EngineConfig>;
  revealDelayMs?: number;
  loop?: boolean;
  muted?: boolean;
  autoPlay?: boolean;
  rootMargin?: string;
  preloadRootMargin?: string;
};

type RegisteredInstance = {
  id: InstanceId;
  canvas: HTMLCanvasElement;
  displayCtx: CanvasRenderingContext2D | null;
  src: string;
  mediaKind: "image" | "video";
  intersectionObserver: IntersectionObserver;
  preloadObserver: IntersectionObserver | null;
  resizeObserver: ResizeObserver;
  pump: VideoFramePump | null;
  visible: boolean;
  disposed: boolean;
  imageRequested: boolean;
  revealDelayMs: number;
  revealArmed: boolean;
  revealTimer: ReturnType<typeof setTimeout> | null;
};

const DEFAULT_ROOT_MARGIN = "200% 0px";
const FALLBACK_SIZE = 320;

let worker: Worker | null = null;
let workerMessageHandler: ((event: MessageEvent<WorkerToMainMessage>) => void) | null = null;
const instances = new Map<InstanceId, RegisteredInstance>();
let nextId = 0;
let clockRafId = 0;
let tickInFlight = false;

// The worker renders one tick per main-thread rAF: worker rAF stalls without a
// placeholder canvas, and the main clock pauses with the tab exactly like rAF.
function clockFrame(): void {
  clockRafId = requestAnimationFrame(clockFrame);
  if (tickInFlight || instances.size === 0) return;
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

// Present on a 2D display-p3 context: readbacks honor a P3-tagged ImageBitmap,
// but the compositor paints bitmaprenderer canvases as sRGB (clipping P3).
function presentFrame(instance: RegisteredInstance, frame: ImageBitmap): void {
  const ctx = instance.displayCtx;
  if (!ctx) {
    frame.close();
    return;
  }
  const canvas = ctx.canvas;
  if (canvas.width !== frame.width || canvas.height !== frame.height) {
    canvas.width = frame.width;
    canvas.height = frame.height;
  }
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(frame, 0, 0);
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
      const instance = instances.get(data.id);
      if (!instance || instance.disposed) {
        data.frame.close();
        return;
      }
      presentFrame(instance, data.frame);
    } else if (data.type === "needsSource") {
      const instance = instances.get(data.id);
      if (!instance || instance.disposed) return;
      if (instance.mediaKind === "image") {
        instance.imageRequested = false;
        void loadImageFrameOnce(instance, instance.src);
      }
    }
  };
  next.addEventListener("message", workerMessageHandler);
  worker = next;
  return next;
}

function teardownWorker(): void {
  stopClock();
  if (!worker) return;
  post({ type: "terminate" });
  if (workerMessageHandler) worker.removeEventListener("message", workerMessageHandler);
  worker.terminate();
  worker = null;
  workerMessageHandler = null;
}

function readDpr(): number {
  return window.devicePixelRatio || 1;
}

function readSize(canvas: HTMLCanvasElement): { cssWidth: number; cssHeight: number } {
  const cssWidth = canvas.clientWidth || FALLBACK_SIZE;
  const cssHeight = canvas.clientHeight || FALLBACK_SIZE;
  return { cssWidth, cssHeight };
}

function startMedia(instance: RegisteredInstance, src: string): void {
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
  const { canvas, src, mediaKind } = opts;

  const displayCtx = canvas.getContext("2d", { colorSpace: "display-p3" });
  const { cssWidth, cssHeight } = readSize(canvas);
  const dpr = readDpr();

  post({
    type: "register",
    id,
    cssWidth,
    cssHeight,
    dpr,
    config: opts.config,
  });

  const pump =
    mediaKind === "video"
      ? createVideoFramePump({
          src,
          loop: opts.loop ?? true,
          muted: opts.muted ?? true,
          autoPlay: opts.autoPlay ?? true,
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
    intersectionObserver: undefined as unknown as IntersectionObserver,
    preloadObserver: null,
    resizeObserver: undefined as unknown as ResizeObserver,
  };

  const intersectionObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const visible = entry.isIntersecting;
        if (visible === instance.visible) continue;
        instance.visible = visible;
        post({ type: "visibility", id, visible });
        if (visible) startMedia(instance, src);
        else stopMedia(instance);
      }
    },
    { rootMargin: opts.rootMargin ?? DEFAULT_ROOT_MARGIN },
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
      { rootMargin: opts.preloadRootMargin ?? DEFAULT_ROOT_MARGIN },
    );
  }

  const resizeObserver = new ResizeObserver(() => {
    const size = readSize(canvas);
    post({ type: "resize", id, cssWidth: size.cssWidth, cssHeight: size.cssHeight, dpr: readDpr() });
  });

  let pointerInside = false;
  const onPointerMove = (e: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    const inside =
      e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
    if (inside) {
      pointerInside = true;
      const zoom = canvas.currentCSSZoom ?? 1;
      post({ type: "cursor", id, x: (e.clientX - rect.left) / zoom, y: (e.clientY - rect.top) / zoom });
    } else if (pointerInside) {
      pointerInside = false;
      post({ type: "cursor", id, x: null });
    }
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

  instance.intersectionObserver = intersectionObserver;
  instance.preloadObserver = preloadObserver;
  instance.resizeObserver = resizeObserver;
  instances.set(id, instance);
  startClock();

  intersectionObserver.observe(canvas);
  preloadObserver?.observe(canvas);
  resizeObserver.observe(canvas);
  window.addEventListener("pointermove", onPointerMove);
  document.addEventListener("pointerleave", onDocumentLeave);
  window.addEventListener("pointerdown", onPointerDown);

  return {
    setConfig(config: Partial<EngineConfig>) {
      post({ type: "setConfig", id, config });
    },
    triggerReveal() {
      post({ type: "reveal", id });
    },
    unregister() {
      if (instance.disposed) return;
      instance.disposed = true;
      if (instance.revealTimer) {
        clearTimeout(instance.revealTimer);
        instance.revealTimer = null;
      }
      intersectionObserver.disconnect();
      preloadObserver?.disconnect();
      resizeObserver.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerleave", onDocumentLeave);
      window.removeEventListener("pointerdown", onPointerDown);
      instance.pump?.dispose();
      post({ type: "unregister", id });
      instances.delete(id);
      if (instances.size === 0) teardownWorker();
    },
  };
}
