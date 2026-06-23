import { compileProgram } from "../gl/program";
import { bindRenderTarget, type RenderTarget } from "../gl/renderTarget";
import { ASSEMBLY_SCATTER_VERT } from "../shaders/assemblyScatter.vert";
import { ASSEMBLY_SCATTER_FRAG } from "../shaders/assemblyScatter.frag";

export type AssemblyScatterUniforms = {
  blockCols: number;
  blockRows: number;
  blockCells: number;
  progress: number;
  spread: number;
  flight: number;
  spawnDist: number;
  order: number;
};

export function createAssemblyScatterPass(gl: WebGL2RenderingContext) {
  const program = compileProgram(gl, ASSEMBLY_SCATTER_VERT, ASSEMBLY_SCATTER_FRAG);
  const vao = gl.createVertexArray();
  if (!vao) throw new Error("Failed to create VAO");
  const u = (n: string) => gl.getUniformLocation(program, n);
  const L = {
    cell: u("uCell"),
    grid: u("uGridCount"),
    blockGrid: u("uBlockGrid"),
    blockCells: u("uBlockCells"),
    progress: u("uProgress"),
    spread: u("uSpread"),
    flight: u("uFlight"),
    spawnDist: u("uSpawnDist"),
    order: u("uOrder"),
  };
  return {
    render(target: RenderTarget, cellTex: WebGLTexture, cols: number, rows: number, p: AssemblyScatterUniforms) {
      bindRenderTarget(gl, target);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(program);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, cellTex);
      gl.uniform1i(L.cell, 0);
      gl.uniform2f(L.grid, cols, rows);
      gl.uniform2f(L.blockGrid, p.blockCols, p.blockRows);
      gl.uniform1f(L.blockCells, p.blockCells);
      gl.uniform1f(L.progress, p.progress);
      gl.uniform1f(L.spread, p.spread);
      gl.uniform1f(L.flight, p.flight);
      gl.uniform1f(L.spawnDist, p.spawnDist);
      gl.uniform1f(L.order, p.order);
      gl.bindVertexArray(vao);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, p.blockCols * p.blockRows);
      gl.bindVertexArray(null);
    },
    dispose() {
      gl.deleteProgram(program);
      gl.deleteVertexArray(vao);
    },
  };
}
