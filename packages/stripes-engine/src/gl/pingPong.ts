import { type RenderTarget, createRenderTarget, resizeRenderTarget, disposeRenderTarget } from "./renderTarget";

export type PingPong = {
  read(): RenderTarget;
  write(): RenderTarget;
  swap(): void;
  resize(w: number, h: number): void;
  dispose(): void;
};

export function createPingPong(
  gl: WebGL2RenderingContext,
  width: number,
  height: number,
  opts: { float?: boolean; linear?: boolean } = {},
): PingPong {
  let a = createRenderTarget(gl, width, height, opts);
  let b = createRenderTarget(gl, width, height, opts);
  return {
    read: () => a,
    write: () => b,
    swap: () => {
      const t = a;
      a = b;
      b = t;
    },
    resize: (w, h) => {
      resizeRenderTarget(gl, a, w, h);
      resizeRenderTarget(gl, b, w, h);
    },
    dispose: () => {
      disposeRenderTarget(gl, a);
      disposeRenderTarget(gl, b);
    },
  };
}
