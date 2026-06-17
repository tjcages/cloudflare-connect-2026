import { type Application, WebGLRenderer } from "pixi.js";

export const isDestroyed = (app: Application) => {
  if (!app.ticker) return true;
  if (!app.renderer) return true;
  if (!app.stage) return true;

  if (app.renderer instanceof WebGLRenderer) {
    return app.renderer.gl.isContextLost();
  }

  return false;
};
