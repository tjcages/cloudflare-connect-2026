import { createStripesEngineShared, type SharedStripesEngine } from "../engine";
import { createFrameCapState, type FrameCapState, shouldRenderFrame } from "../core/frameCap";
import type { EngineContext } from "../gl/context";
import { setFillRecording } from "../perf/fillRecorder";
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

/** Fill accounting lapses this long after the last stats request. */
const FILL_RECORDING_LINGER_MS = 2000;
let lastStatsRequestMs = -Infinity;

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

/**
 * Ceiling on one batch's packed backbuffer. Handing the drawing buffer over
 * costs the same whatever its size, so a batch only ever splits to keep the
 * allocation bounded — never for speed.
 */
const MAX_BATCH_PIXELS = 8e6;

type Slot = { id: InstanceId; instance: Instance; x: number; y: number; width: number; height: number };

/**
 * Stack this tick's renderers into a column of disjoint backbuffer slots.
 *
 * A column, not a shelf: every slot keeps `x = 0`, so the present pass's
 * viewport is only ever translated vertically. Shifting it horizontally instead
 * moves the fullscreen quad's varying interpolation off its original floating-
 * point path and rounds a stripe edge differently — measured at one column of
 * pixels, max delta 2/255 — while a vertical offset is bit-identical. Packing
 * tighter would buy nothing anyway: the transfer costs the same at any size,
 * and only the allocation would shrink.
 *
 * A batch closes when it would outgrow {@link MAX_BATCH_PIXELS} or the
 * context's texture limit, and the caller flushes each batch with its own
 * transfer.
 */
function packBatches(candidates: Slot[], maxTextureSize: number): Slot[][] {
  const batches: Slot[][] = [];
  let batch: Slot[] = [];
  let width = 0;
  let height = 0;
  for (const slot of candidates) {
    const nextWidth = Math.max(width, slot.width);
    const nextHeight = height + slot.height;
    const fits =
      batch.length === 0 ||
      (nextHeight <= maxTextureSize && nextWidth <= maxTextureSize && nextWidth * nextHeight <= MAX_BATCH_PIXELS);
    if (!fits) {
      batches.push(batch);
      batch = [];
      width = 0;
      height = 0;
    }
    slot.y = height;
    width = Math.max(width, slot.width);
    height += slot.height;
    batch.push(slot);
  }
  if (batch.length > 0) batches.push(batch);
  return batches;
}

// Driven by "tick" messages from the main-thread clock: worker rAF only fires
// while the worker owns a placeholder canvas, which this present path avoids.
//
// Instances render sequentially into one backbuffer, then the whole tick is
// handed to the host in a single `transferToImageBitmap`. That transfer is the
// expensive part of the present path — a fixed ~0.65 ms of worker time each,
// independent of the buffer's size, because the drawing buffer has to be
// reacquired afterwards — so instances are packed into disjoint slots to pay it
// once per tick instead of once per instance. Nothing in the pipeline clears or
// otherwise touches the default framebuffer except the final present pass, so
// slots cannot disturb each other.
function renderTick(): void {
  // One clock read per tick: instances gate against their own maxFps using
  // relative intervals, so a capped tile skips its render here (leaving its last
  // frame on the display canvas) while uncapped tiles on the same tick render
  // every frame. The shared tick loop itself is never slowed.
  const now = performance.now();
  if (now - lastStatsRequestMs > FILL_RECORDING_LINGER_MS) setFillRecording(false);

  const candidates: Slot[] = [];
  for (const [id, instance] of instances) {
    if (!instance.visible) continue;
    const { engine } = instance;
    if (!shouldRenderFrame(instance.frameCap, engine.maxFps, now)) continue;
    candidates.push({ id, instance, x: 0, y: 0, width: engine.outputWidth, height: engine.outputHeight });
  }

  if (candidates.length > 0 && sharedCanvas && context) {
    for (const batch of packBatches(candidates, context.maxTextureSize)) {
      let width = 0;
      let height = 0;
      for (const slot of batch) {
        width = Math.max(width, slot.x + slot.width);
        height = Math.max(height, slot.y + slot.height);
      }
      sizeShared(width, height);
      for (const slot of batch) {
        slot.instance.engine.setPresentOrigin(slot.x, slot.y);
        slot.instance.engine.renderFrame();
      }
      // GL's origin is bottom-left and an ImageBitmap's is top-left, so a slot
      // placed at GL y sits `bufferHeight - y - height` from the bitmap's top.
      const bufferHeight = sharedCanvas.height;
      const slots = batch.map((slot) => ({
        id: slot.id,
        sx: slot.x,
        sy: bufferHeight - slot.y - slot.height,
        width: slot.width,
        height: slot.height,
      }));
      // Always the zero-copy transfer, never `createImageBitmap`: cropping here
      // would mean a synchronous GPU copy plus an `await` that stalls the rest
      // of the tick. The host crops during the blit it was going to do anyway,
      // where a source rect costs it nothing.
      const frame = sharedCanvas.transferToImageBitmap();
      scope.postMessage({ type: "frame", frame, slots }, [frame]);
    }
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
      // Fill accounting only earns its per-bind bookkeeping while something is
      // reading it. Requests arrive on the subscriber's interval, so recording
      // latches on here and lapses again once they stop — see renderTick.
      lastStatsRequestMs = performance.now();
      setFillRecording(true);
      const samples: InstanceStatsSample[] = [];
      for (const [id, instance] of instances) {
        const { engine } = instance;
        samples.push({
          id,
          visible: instance.visible,
          hasSource: instance.hasSource,
          maxFps: engine.maxFps,
          outputWidth: engine.outputWidth,
          outputHeight: engine.outputHeight,
          fieldWidth: engine.fieldWidth,
          fieldHeight: engine.fieldHeight,
          fieldScale: engine.fieldScale,
          passes: engine.passFill.map((pass) => ({ ...pass })),
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
