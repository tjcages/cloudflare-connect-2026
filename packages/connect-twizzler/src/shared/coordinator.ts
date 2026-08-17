import type { TwizzlerSettings } from "../twizzler";
import type { InstanceId, MainToWorkerMessage, WorkerToMainMessage } from "./protocol";
import TwizzlerWorker from "./worker?worker&inline";

export type SharedTwizzlerHandle = {
  readonly supported: boolean;
  setPaused(paused: boolean): void;
  setSettings(settings: Partial<TwizzlerSettings>): void;
  unregister(): void;
};

export type RegisterSharedTwizzlerOptions = {
  canvas: HTMLCanvasElement;
  settings?: Partial<TwizzlerSettings>;
  rootMargin?: string;
  maxFps?: number;
  maxDpr?: number;
  paused?: boolean;
  onReady?: () => void;
};

type RegisteredInstance = {
  id: InstanceId;
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  observer: IntersectionObserver;
  resizeObserver: ResizeObserver;
  motionQuery: MediaQueryList;
  motionListener: (event: MediaQueryListEvent) => void;
  onReady?: () => void;
  ready: boolean;
  visible: boolean;
  paused: boolean;
  maxDpr: number;
};

const instances = new Map<InstanceId, RegisteredInstance>();
let worker: Worker | null = null;
let workerMessageHandler: ((event: MessageEvent<WorkerToMainMessage>) => void) | null = null;
let nextId = 0;
let rafId = 0;
let tickInFlight = false;

function supported(): boolean {
  return typeof Worker !== "undefined" && typeof OffscreenCanvas !== "undefined";
}

function post(message: MainToWorkerMessage, transfer?: Transferable[]): void {
  if (!worker) return;
  if (transfer?.length) worker.postMessage(message, transfer);
  else worker.postMessage(message);
}

function anyRendering(): boolean {
  return [...instances.values()].some((instance) => instance.visible && !instance.paused);
}

function clockFrame(now: number): void {
  rafId = requestAnimationFrame(clockFrame);
  if (tickInFlight || !anyRendering()) return;
  tickInFlight = true;
  post({ type: "tick", now });
}

function syncClock(): void {
  if (instances.size > 0 && !rafId) rafId = requestAnimationFrame(clockFrame);
  if (instances.size === 0 && rafId) {
    cancelAnimationFrame(rafId);
    rafId = 0;
    tickInFlight = false;
  }
}

function ensureWorker(): Worker {
  if (worker) return worker;
  const next = new TwizzlerWorker();
  workerMessageHandler = (event) => {
    const message = event.data;
    if (message.type === "tock") {
      tickInFlight = false;
      return;
    }
    if (message.type === "error") {
      console.error(`[connect-twizzler] ${message.id ?? "worker"}: ${message.message}`);
      return;
    }
    const instance = instances.get(message.id);
    if (!instance) {
      message.frame.close();
      return;
    }
    const { canvas, context } = instance;
    if (canvas.width !== message.width) canvas.width = message.width;
    if (canvas.height !== message.height) canvas.height = message.height;
    context.clearRect(0, 0, message.width, message.height);
    context.drawImage(message.frame, 0, 0);
    message.frame.close();
    if (!instance.ready) {
      instance.ready = true;
      instance.onReady?.();
    }
  };
  next.addEventListener("message", workerMessageHandler);
  worker = next;
  return next;
}

function teardownWorker(): void {
  if (!worker) return;
  post({ type: "terminate" });
  if (workerMessageHandler) worker.removeEventListener("message", workerMessageHandler);
  worker.terminate();
  worker = null;
  workerMessageHandler = null;
}

function outputSize(canvas: HTMLCanvasElement, maxDpr: number): { width: number; height: number } {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(maxDpr, Math.max(1, window.devicePixelRatio || 1));
  return {
    width: Math.max(1, Math.round((rect.width || canvas.clientWidth || 320) * dpr)),
    height: Math.max(1, Math.round((rect.height || canvas.clientHeight || 180) * dpr)),
  };
}

export function registerSharedTwizzler(options: RegisterSharedTwizzlerOptions): SharedTwizzlerHandle {
  if (!supported()) {
    return { supported: false, setPaused() {}, setSettings() {}, unregister() {} };
  }

  ensureWorker();
  const id = `twizzler-${nextId++}`;
  const context = options.canvas.getContext("2d", { colorSpace: "display-p3" });
  if (!context) return { supported: false, setPaused() {}, setSettings() {}, unregister() {} };
  const maxDpr = Math.max(1, options.maxDpr ?? 1.5);
  const size = outputSize(options.canvas, maxDpr);
  const motionQuery = matchMedia("(prefers-reduced-motion: reduce)");

  post({
    type: "register",
    id,
    width: size.width,
    height: size.height,
    settings: options.settings,
    maxFps: Math.max(1, options.maxFps ?? 30),
    reducedMotion: motionQuery.matches,
  });

  const instance = {
    id,
    canvas: options.canvas,
    context,
    onReady: options.onReady,
    ready: false,
    visible: false,
    paused: options.paused ?? false,
    maxDpr,
  } as RegisteredInstance;

  const observer = new IntersectionObserver(
    ([entry]) => {
      instance.visible = entry?.isIntersecting ?? false;
      post({ type: "visibility", id, visible: instance.visible && !instance.paused });
    },
    { rootMargin: options.rootMargin ?? "160px" },
  );
  const resizeObserver = new ResizeObserver(() => {
    const next = outputSize(options.canvas, instance.maxDpr);
    post({ type: "resize", id, width: next.width, height: next.height });
  });
  const motionListener = (event: MediaQueryListEvent) => {
    post({ type: "reducedMotion", id, reducedMotion: event.matches });
  };

  instance.observer = observer;
  instance.resizeObserver = resizeObserver;
  instance.motionQuery = motionQuery;
  instance.motionListener = motionListener;
  instances.set(id, instance);
  observer.observe(options.canvas);
  resizeObserver.observe(options.canvas);
  motionQuery.addEventListener("change", motionListener);
  syncClock();

  return {
    supported: true,
    setPaused(paused) {
      instance.paused = paused;
      post({ type: "visibility", id, visible: instance.visible && !paused });
    },
    setSettings(settings) {
      post({ type: "settings", id, settings });
    },
    unregister() {
      observer.disconnect();
      resizeObserver.disconnect();
      motionQuery.removeEventListener("change", motionListener);
      post({ type: "unregister", id });
      instances.delete(id);
      syncClock();
      if (instances.size === 0) teardownWorker();
    },
  };
}
