import { compileProgram } from "../gl/program";
import { bindRenderTarget, type RenderTarget } from "../gl/renderTarget";
import { FULLSCREEN_VERT } from "../shaders/fullscreen.vert";
import { REVEAL_FRAG } from "../shaders/reveal.frag";

export type RevealPassUniforms = {
  revealMode: number;
  origin: [number, number];
  maxDist: number;
  progress: number;
  softness: number;
  waviness: number;
  noiseScale: number;
  bandRamp: number;
  order: number;
  avgTotal: number;
  spread: number;
};

export function createRevealPass(gl: WebGL2RenderingContext, quad: { draw(): void }) {
  const program = compileProgram(gl, FULLSCREEN_VERT, REVEAL_FRAG);
  const u = (n: string) => gl.getUniformLocation(program, n);
  const L = {
    cell: u("uCell"),
    grid: u("uGridCount"),
    mode: u("uRevealMode"),
    origin: u("uOrigin"),
    maxDist: u("uMaxDist"),
    progress: u("uProgress"),
    softness: u("uSoftness"),
    waviness: u("uWaviness"),
    noiseScale: u("uNoiseScale"),
    bandRamp: u("uBandRamp"),
    order: u("uOrder"),
    avgTotal: u("uAvgTotal"),
    spread: u("uSpread"),
  };
  return {
    render(target: RenderTarget, cellTex: WebGLTexture, cols: number, rows: number, p: RevealPassUniforms) {
      bindRenderTarget(gl, target);
      gl.useProgram(program);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, cellTex);
      gl.uniform1i(L.cell, 0);
      gl.uniform2f(L.grid, cols, rows);
      gl.uniform1f(L.mode, p.revealMode);
      gl.uniform2f(L.origin, p.origin[0], p.origin[1]);
      gl.uniform1f(L.maxDist, p.maxDist);
      gl.uniform1f(L.progress, p.progress);
      gl.uniform1f(L.softness, p.softness);
      gl.uniform1f(L.waviness, p.waviness);
      gl.uniform1f(L.noiseScale, p.noiseScale);
      gl.uniform1f(L.bandRamp, p.bandRamp);
      gl.uniform1f(L.order, p.order);
      gl.uniform1f(L.avgTotal, p.avgTotal);
      gl.uniform1f(L.spread, p.spread);
      quad.draw();
    },
    dispose() {
      gl.deleteProgram(program);
    },
  };
}
