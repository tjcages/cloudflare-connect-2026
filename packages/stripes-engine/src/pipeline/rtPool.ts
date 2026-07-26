import { type RenderTarget, createRenderTarget, resizeRenderTarget, disposeRenderTarget } from "../gl/renderTarget";

export type RtPool = {
  get(
    key: string,
    width: number,
    height: number,
    opts?: { float?: boolean; float32?: boolean; linear?: boolean },
  ): RenderTarget;
  dispose(): void;
};

export function createRtPool(gl: WebGL2RenderingContext): RtPool {
  const map = new Map<string, RenderTarget>();
  return {
    get(key, width, height, opts) {
      const existing = map.get(key);
      if (existing) {
        resizeRenderTarget(gl, existing, width, height);
        return existing;
      }
      const rt = createRenderTarget(gl, width, height, opts);
      map.set(key, rt);
      return rt;
    },
    dispose() {
      for (const rt of map.values()) disposeRenderTarget(gl, rt);
      map.clear();
    },
  };
}
