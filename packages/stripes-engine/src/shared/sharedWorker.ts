import { createStripesEngineShared, type SharedStripesEngine } from "../engine";
import type { EngineContext } from "../gl/context";
import type { EngineSource } from "../source/sourceTexture";
import type { InstanceId, MainToWorkerMessage, SharedSourceFrame, WorkerToMainMessage } from "./protocol";

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

function sizeShared(width: number, height: number): void {
  if (!sharedCanvas) return;
  if (sharedCanvas.width !== width) sharedCanvas.width = width;
  if (sharedCanvas.height !== height) sharedCanvas.height = height;
}

// Driven by "tick" messages from the main-thread clock: worker rAF only fires
// while the worker owns a placeholder canvas, which this present path avoids.
function renderTick(): void {
  for (const [id, instance] of instances) {
    if (!instance.visible) continue;
    const { engine } = instance;
    sizeShared(engine.outputWidth, engine.outputHeight);
    engine.renderFrame();
    if (!sharedCanvas) continue;
    const frame = sharedCanvas.transferToImageBitmap();
    scope.postMessage({ type: "frame", id, frame }, [frame]);
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
      });
      if (message.config) engine.setConfig(message.config);
      instances.set(message.id, { engine, visible: false, hasSource: false });
      return;
    }
    case "tick": {
      renderTick();
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
      if (!instance.hasSource) instance.engine.triggerReveal();
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
