import { createStripesEngineShared, type SharedStripesEngine } from "../engine";
import { createFrameCapState, type FrameCapState, shouldRenderFrame } from "../core/frameCap";
import type { EngineContext } from "../gl/context";
import type { EngineSource } from "../source/sourceTexture";
import type {
  InstanceId,
  InstanceStatsSample,
  MainToWorkerMessage,
  SharedSourceFrame,
  WorkerToMainMessage,
} from "./protocol";

type WorkerScope = {
  postMessage(message: WorkerToMainMessage, transfer?: Transferable[]): void;
  addEventListener(type: "message", listener: (event: MessageEvent<MainToWorkerMessage>) => void): void;
  close(): void;
};

const scope = self as unknown as WorkerScope;

type GlColorSpaceCtx = WebGL2RenderingContext & {
  drawingBufferColorSpace?: string;
  unpackColorSpace?: string;
};

type Instance = {
  engine: SharedStripesEngine;
  visible: boolean;
  hasSource: boolean;
  pendingReveal: boolean;
  frameCap: FrameCapState;
};

const SHARED_GL_ATTRIBUTES: WebGLContextAttributes = {
  alpha: true,
  premultipliedAlpha: true,
  antialias: false,
};

let sharedCanvas: OffscreenCanvas | null = null;
let sharedGl: WebGL2RenderingContext | null = null;
let context: EngineContext | null = null;

const instances = new Map<InstanceId, Instance>();

function applyColorSpace(gl: WebGL2RenderingContext): void {
  const ext = gl as GlColorSpaceCtx;
  ext.drawingBufferColorSpace = "display-p3";
  ext.unpackColorSpace = "display-p3";
}

function buildContext(gl: WebGL2RenderingContext): EngineContext {
  applyColorSpace(gl);
  const ext = gl as GlColorSpaceCtx;
  const isP3 = (ext.drawingBufferColorSpace ?? "srgb") === "display-p3";
  const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
  return { gl, isP3, maxTextureSize };
}

function ensureContext(): EngineContext {
  if (context && sharedGl) return context;
  const canvas = new OffscreenCanvas(1, 1);
  const gl = canvas.getContext("webgl2", SHARED_GL_ATTRIBUTES);
  if (!gl) throw new Error("WebGL2 is required but not available in worker");
  gl.getExtension("EXT_color_buffer_float");
  canvas.addEventListener("webglcontextlost", onContextLost as EventListener, false);
  canvas.addEventListener("webglcontextrestored", onContextRestored as EventListener, false);
  sharedCanvas = canvas;
  sharedGl = gl;
  context = buildContext(gl);
  return context;
}

function onContextLost(e: Event): void {
  e.preventDefault();
}

function onContextRestored(): void {
  if (!sharedGl) return;
  const next = buildContext(sharedGl);
  context = next;
  for (const [id, instance] of instances) {
    instance.engine.rebuild(next);
    scope.postMessage({ type: "needsSource", id });
  }
}

// Grow-only: consumer instances range from 160×160 tiles to ~3000×1700 surfaces
// and all share this one backbuffer, so reallocating to each instance's exact
// size churned the drawing buffer several times per frame. Only enlarge (never
// shrink) so the buffer settles at the per-dimension max and stops thrashing.
function sizeShared(width: number, height: number): void {
  if (!sharedCanvas) return;
  if (width > sharedCanvas.width) sharedCanvas.width = width;
  if (height > sharedCanvas.height) sharedCanvas.height = height;
}

// Driven by "tick" messages from the main-thread clock: worker rAF only fires
// while the worker owns a placeholder canvas, which this present path avoids.
// Instances render strictly sequentially — they share one backbuffer, so each
// bitmap must be produced before the next instance overwrites it.
function renderTick(): void {
  // One clock read per tick: instances gate against their own maxFps using
  // relative intervals, so a capped tile skips its render here (leaving its last
  // frame on the display canvas) while uncapped tiles on the same tick render
  // every frame. The shared tick loop itself is never slowed.
  const now = performance.now();
  for (const [id, instance] of instances) {
    if (!instance.visible) continue;
    const { engine } = instance;
    if (!shouldRenderFrame(instance.frameCap, engine.maxFps, now)) continue;
    const outW = engine.outputWidth;
    const outH = engine.outputHeight;
    sizeShared(outW, outH);
    engine.renderFrame();
    if (!sharedCanvas) continue;
    // The present pass renders with gl.viewport(0, 0, outW, outH), i.e. into the
    // bottom-left corner of the (possibly larger) backbuffer. The host crops
    // that corner back out — see `presentFrame` in the coordinator.
    //
    // Always the zero-copy transfer, never `createImageBitmap`: cropping here
    // would mean a synchronous GPU copy plus an `await` that stalls every later
    // instance on this tick. The backbuffer is grow-only, so instances smaller
    // than it ship the whole buffer and the host crops during the blit it was
    // going to do anyway — a source rect costs it nothing.
    const frame = sharedCanvas.transferToImageBitmap();
    scope.postMessage({ type: "frame", id, frame, outWidth: outW, outHeight: outH }, [frame]);
  }
  scope.postMessage({ type: "tock" });
}

function asEngineSource(source: SharedSourceFrame): EngineSource {
  return source as unknown as EngineSource;
}

function closeFrame(frame: SharedSourceFrame): void {
  (frame as { close?: () => void }).close?.();
}

function handle(message: MainToWorkerMessage): void {
  switch (message.type) {
    case "register": {
      const ctx = ensureContext();
      const engine = createStripesEngineShared({
        context: ctx,
        width: message.cssWidth,
        height: message.cssHeight,
        dpr: message.dpr,
        seed: message.seed,
        onWaterActivity: (activity) => {
          scope.postMessage({ type: "waterActivity", id: message.id, activity });
        },
      });
      if (message.config) engine.setConfig(message.config);
      // Both gates live on the main thread: hold the reveal clock until the
      // coordinator's reveal observers say the element is worth revealing.
      engine.setRevealGate(false);
      instances.set(message.id, {
        engine,
        visible: false,
        hasSource: false,
        pendingReveal: false,
        frameCap: createFrameCapState(),
      });
      return;
    }
    case "tick": {
      // A throwing render must still post "tock" — the main-thread clock
      // deadlocks otherwise, because `tickInFlight` would never clear.
      try {
        renderTick();
      } catch (error) {
        scope.postMessage({ type: "error", message: error instanceof Error ? error.message : String(error) });
        scope.postMessage({ type: "tock" });
      }
      return;
    }
    case "resize": {
      const instance = instances.get(message.id);
      if (!instance) return;
      instance.engine.setDpr(message.dpr);
      instance.engine.resize(message.cssWidth, message.cssHeight);
      return;
    }
    case "visibility": {
      const instance = instances.get(message.id);
      if (!instance) return;
      instance.visible = message.visible;
      // renderTick skips invisible instances, so nothing would drive the wave
      // trail's activity back down — the host would hold the last value for as
      // long as the instance stays offscreen.
      if (!message.visible) instance.engine.settle();
      // A source that arrived while offscreen deferred its reveal so it plays in
      // view rather than two viewports away. Fire it now, once, on first sight.
      if (message.visible && instance.pendingReveal) {
        instance.pendingReveal = false;
        instance.engine.triggerReveal();
      }
      return;
    }
    case "source": {
      const instance = instances.get(message.id);
      if (!instance) {
        if (message.frame) closeFrame(message.frame);
        return;
      }
      if (!message.frame) {
        instance.engine.setSource(null);
        instance.hasSource = false;
        return;
      }
      if (message.isStream && instance.hasSource) {
        instance.engine.updateSourceFrame(asEngineSource(message.frame));
        closeFrame(message.frame);
        return;
      }
      instance.engine.setSource(asEngineSource(message.frame));
      // Reveal on the first source only. If the instance is already visible, play
      // it now (unchanged behavior); otherwise defer until it enters the viewport.
      if (!instance.hasSource) {
        if (instance.visible) instance.engine.triggerReveal();
        else instance.pendingReveal = true;
      }
      instance.hasSource = true;
      closeFrame(message.frame);
      return;
    }
    case "setConfig": {
      const instance = instances.get(message.id);
      if (!instance) return;
      instance.engine.setConfig(message.config);
      return;
    }
    case "cursor": {
      const instance = instances.get(message.id);
      if (!instance) return;
      instance.engine.setCursor(message.x, message.y);
      return;
    }
    case "click": {
      const instance = instances.get(message.id);
      if (!instance) return;
      instance.engine.click(message.x, message.y);
      return;
    }
    case "revealGate": {
      const instance = instances.get(message.id);
      if (!instance) return;
      instance.engine.setRevealGate(message.open);
      return;
    }
    case "reveal": {
      const instance = instances.get(message.id);
      if (!instance) return;
      instance.engine.triggerReveal();
      return;
    }
    case "unregister": {
      const instance = instances.get(message.id);
      if (!instance) return;
      instance.engine.dispose();
      instances.delete(message.id);
      return;
    }
    case "statsRequest": {
      const samples: InstanceStatsSample[] = [];
      for (const [id, instance] of instances) {
        samples.push({
          id,
          visible: instance.visible,
          hasSource: instance.hasSource,
          maxFps: instance.engine.maxFps,
          outputWidth: instance.engine.outputWidth,
          outputHeight: instance.engine.outputHeight,
        });
      }
      scope.postMessage({ type: "stats", instances: samples });
      return;
    }
    case "terminate": {
      for (const instance of instances.values()) instance.engine.dispose();
      instances.clear();
      scope.close();
      return;
    }
  }
}

scope.addEventListener("message", (event) => {
  const message = event.data;
  try {
    handle(message);
  } catch (error) {
    const id = "id" in message ? message.id : undefined;
    scope.postMessage({ type: "error", id, message: error instanceof Error ? error.message : String(error) });
  }
});

scope.postMessage({ type: "ready" });
