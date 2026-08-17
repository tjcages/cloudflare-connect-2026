import {
  type Application,
  CanvasRenderer,
  WebGLRenderer,
  WebGPURenderer,
} from "pixi.js";

export const isDestroyed = (app: Application) => {
  if (!app.ticker) return true;
  if (!app.renderer) return true;
  if (!app.stage) return true;

  if (app.renderer instanceof WebGLRenderer)
    return app.renderer.gl.isContextLost();

  if (app.renderer instanceof CanvasRenderer)
    return app.renderer.canvasContext.activeContext.isContextLost();

  if (app.renderer instanceof WebGPURenderer)
    return app.renderer.gpu.device.lost;

  return false;
};
