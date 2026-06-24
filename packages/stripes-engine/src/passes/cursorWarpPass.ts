import { compileProgram } from "../gl/program";
import { bindRenderTarget, type RenderTarget } from "../gl/renderTarget";
import { FULLSCREEN_VERT } from "../shaders/fullscreen.vert";
import { CURSOR_WARP_FRAG, CURSOR_WARP_COLOR_FRAG } from "../shaders/cursorWarp.frag";

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

  const colorProgram = compileProgram(gl, FULLSCREEN_VERT, CURSOR_WARP_COLOR_FRAG);
  const cField = gl.getUniformLocation(colorProgram, "uFieldColor");
  const cAccum = gl.getUniformLocation(colorProgram, "uAccum");
  const cTear = gl.getUniformLocation(colorProgram, "uTear");
  const cPixelSize = gl.getUniformLocation(colorProgram, "uPixelSize");
  const cCellSize = gl.getUniformLocation(colorProgram, "uCellSize");
  const cGridSize = gl.getUniformLocation(colorProgram, "uGridSize");
  const cPushCap = gl.getUniformLocation(colorProgram, "uPushCap");

  function bind(
    prog: WebGLProgram,
    locs: {
      field: WebGLUniformLocation | null;
      accum: WebGLUniformLocation | null;
      tear: WebGLUniformLocation | null;
      pixelSize: WebGLUniformLocation | null;
      cellSize: WebGLUniformLocation | null;
      gridSize: WebGLUniformLocation | null;
      pushCap: WebGLUniformLocation | null;
    },
    target: RenderTarget,
    inputTex: WebGLTexture,
    accumTex: WebGLTexture,
    tearTex: WebGLTexture,
    p: CursorWarpParams,
  ) {
    bindRenderTarget(gl, target);
    gl.useProgram(prog);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, inputTex);
    gl.uniform1i(locs.field, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, accumTex);
    gl.uniform1i(locs.accum, 1);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, tearTex);
    gl.uniform1i(locs.tear, 2);
    gl.uniform2f(locs.pixelSize, p.pixelW, p.pixelH);
    gl.uniform2f(locs.cellSize, p.cellW, p.cellH);
    gl.uniform2f(locs.gridSize, p.cols, p.rows);
    gl.uniform1f(locs.pushCap, p.pushCap);
    quad.draw();
    gl.activeTexture(gl.TEXTURE0);
  }

  return {
    render(
      target: RenderTarget,
      fieldTex: WebGLTexture,
      accumTex: WebGLTexture,
      tearTex: WebGLTexture,
      p: CursorWarpParams,
    ) {
      bind(
        program,
        {
          field: uField,
          accum: uAccum,
          tear: uTear,
          pixelSize: uPixelSize,
          cellSize: uCellSize,
          gridSize: uGridSize,
          pushCap: uPushCap,
        },
        target,
        fieldTex,
        accumTex,
        tearTex,
        p,
      );
    },
    renderColor(
      target: RenderTarget,
      fieldColorTex: WebGLTexture,
      accumTex: WebGLTexture,
      tearTex: WebGLTexture,
      p: CursorWarpParams,
    ) {
      bind(
        colorProgram,
        {
          field: cField,
          accum: cAccum,
          tear: cTear,
          pixelSize: cPixelSize,
          cellSize: cCellSize,
          gridSize: cGridSize,
          pushCap: cPushCap,
        },
        target,
        fieldColorTex,
        accumTex,
        tearTex,
        p,
      );
    },
    dispose() {
      gl.deleteProgram(program);
      gl.deleteProgram(colorProgram);
    },
  };
}
