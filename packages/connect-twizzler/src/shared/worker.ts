/// <reference lib="webworker" />

import {
  advanceTwizzlerAnimationTime,
  normalizeTwizzlerSettings,
  renderTwizzler,
  type TwizzlerSettings,
} from "../twizzler";
import type { InstanceId, MainToWorkerMessage, WorkerToMainMessage } from "./protocol";

type WorkerScope = {
  addEventListener(type: "message", listener: (event: MessageEvent<MainToWorkerMessage>) => void): void;
  postMessage(message: WorkerToMainMessage, transfer?: Transferable[]): void;
  close(): void;
};

type Instance = {
  canvas: OffscreenCanvas;
  settings: TwizzlerSettings;
  visible: boolean;
  reducedMotion: boolean;
  maxFps: number;
  lastFrameAt: number;
  lastTickAt: number;
  animationTime: number;
  dirty: boolean;
};

const scope = self as unknown as WorkerScope;
const instances = new Map<InstanceId, Instance>();

function renderInstance(id: InstanceId, instance: Instance, now: number): void {
  if (!instance.visible) return;
  if (instance.reducedMotion && !instance.dirty) return;
  const interval = instance.maxFps > 0 ? 1000 / instance.maxFps : 0;
  if (!instance.dirty && interval > 0 && now - instance.lastFrameAt < interval - 1) return;

  const deltaSec = instance.lastTickAt > 0 ? Math.min(0.1, Math.max(0, now - instance.lastTickAt) / 1000) : 0;
  instance.lastTickAt = now;
  if (!instance.reducedMotion) {
    instance.animationTime = advanceTwizzlerAnimationTime(instance.animationTime, deltaSec, instance.settings.speed);
  }
  renderTwizzler(instance.canvas, instance.canvas.width, instance.canvas.height, instance.animationTime, {
    ...instance.settings,
    speed: 1,
  });
  instance.lastFrameAt = now;
  instance.dirty = false;
  const frame = instance.canvas.transferToImageBitmap();
  scope.postMessage({ type: "frame", id, frame, width: instance.canvas.width, height: instance.canvas.height }, [
    frame,
  ]);
}

function handle(message: MainToWorkerMessage): void {
  switch (message.type) {
    case "register": {
      instances.set(message.id, {
        canvas: new OffscreenCanvas(message.width, message.height),
        settings: normalizeTwizzlerSettings(message.settings),
        visible: false,
        reducedMotion: message.reducedMotion,
        maxFps: message.maxFps,
        lastFrameAt: Number.NEGATIVE_INFINITY,
        lastTickAt: 0,
        animationTime: 0,
        dirty: true,
      });
      return;
    }
    case "resize": {
      const instance = instances.get(message.id);
      if (!instance) return;
      if (instance.canvas.width !== message.width) instance.canvas.width = message.width;
      if (instance.canvas.height !== message.height) instance.canvas.height = message.height;
      instance.dirty = true;
      return;
    }
    case "settings": {
      const instance = instances.get(message.id);
      if (!instance) return;
      instance.settings = normalizeTwizzlerSettings(message.settings);
      instance.dirty = true;
      return;
    }
    case "visibility": {
      const instance = instances.get(message.id);
      if (!instance) return;
      instance.visible = message.visible;
      instance.lastTickAt = 0;
      if (message.visible) instance.dirty = true;
      return;
    }
    case "reducedMotion": {
      const instance = instances.get(message.id);
      if (!instance) return;
      instance.reducedMotion = message.reducedMotion;
      instance.dirty = true;
      return;
    }
    case "tick": {
      for (const [id, instance] of instances) renderInstance(id, instance, message.now);
      scope.postMessage({ type: "tock" });
      return;
    }
    case "unregister": {
      instances.delete(message.id);
      return;
    }
    case "terminate": {
      instances.clear();
      scope.close();
      return;
    }
  }
}

scope.addEventListener("message", (event) => {
  try {
    handle(event.data);
  } catch (error) {
    const id = "id" in event.data ? event.data.id : undefined;
    scope.postMessage({ type: "error", id, message: error instanceof Error ? error.message : String(error) });
    if (event.data.type === "tick") scope.postMessage({ type: "tock" });
  }
});
