import { compileProgram } from "../gl/program";
import { bindRenderTarget, type RenderTarget } from "../gl/renderTarget";
import { FULLSCREEN_VERT } from "../shaders/fullscreen.vert";
import { CURSOR_WARP_FRAG } from "../shaders/cursorWarp.frag";

export type CursorWarpParams = {
  cols: number;
  rows: number;
  cellW: number;
  cellH: number;
  pixelW: number;
  pixelH: number;
  pushCap: number;
};

export function createCursorWarpPass(gl: WebGL2RenderingContext, quad: { draw(): void }) {
  const program = compileProgram(gl, FULLSCREEN_VERT, CURSOR_WARP_FRAG);
  const uField = gl.getUniformLocation(program, "uField");
  const uAccum = gl.getUniformLocation(program, "uAccum");
  const uTear = gl.getUniformLocation(program, "uTear");
  const uPixelSize = gl.getUniformLocation(program, "uPixelSize");
  const uCellSize = gl.getUniformLocation(program, "uCellSize");
  const uGridSize = gl.getUniformLocation(program, "uGridSize");
  const uPushCap = gl.getUniformLocation(program, "uPushCap");

  return {
    render(
      target: RenderTarget,
      fieldTex: WebGLTexture,
      accumTex: WebGLTexture,
      tearTex: WebGLTexture,
      p: CursorWarpParams,
    ) {
      bindRenderTarget(gl, target);
      gl.useProgram(program);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, fieldTex);
      gl.uniform1i(uField, 0);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, accumTex);
      gl.uniform1i(uAccum, 1);
      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, tearTex);
      gl.uniform1i(uTear, 2);
      gl.uniform2f(uPixelSize, p.pixelW, p.pixelH);
      gl.uniform2f(uCellSize, p.cellW, p.cellH);
      gl.uniform2f(uGridSize, p.cols, p.rows);
      gl.uniform1f(uPushCap, p.pushCap);
      quad.draw();
      gl.activeTexture(gl.TEXTURE0);
    },
    dispose() {
      gl.deleteProgram(program);
    },
  };
}
