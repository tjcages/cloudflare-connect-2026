import { compileProgram } from "../gl/program";
import { bindRenderTarget, type RenderTarget } from "../gl/renderTarget";
import { FULLSCREEN_VERT } from "../shaders/fullscreen.vert";
import { ASSEMBLY_COMPOSITE_FRAG } from "../shaders/assemblyComposite.frag";

export type AssemblyCompositeUniforms = {
  blockCols: number;
  blockRows: number;
  progress: number;
  spread: number;
  flight: number;
  order: number;
};

export function createAssemblyCompositePass(gl: WebGL2RenderingContext, quad: { draw(): void }) {
  const program = compileProgram(gl, FULLSCREEN_VERT, ASSEMBLY_COMPOSITE_FRAG);
  const u = (n: string) => gl.getUniformLocation(program, n);
  const L = {
    crisp: u("uCrisp"),
    blurred: u("uBlurred"),
    blockGrid: u("uBlockGrid"),
    progress: u("uProgress"),
    spread: u("uSpread"),
    flight: u("uFlight"),
    order: u("uOrder"),
  };
  return {
    render(target: RenderTarget, crispTex: WebGLTexture, blurredTex: WebGLTexture, p: AssemblyCompositeUniforms) {
      bindRenderTarget(gl, target);
      gl.useProgram(program);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, crispTex);
      gl.uniform1i(L.crisp, 0);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, blurredTex);
      gl.uniform1i(L.blurred, 1);
      gl.uniform2f(L.blockGrid, p.blockCols, p.blockRows);
      gl.uniform1f(L.progress, p.progress);
      gl.uniform1f(L.spread, p.spread);
      gl.uniform1f(L.flight, p.flight);
      gl.uniform1f(L.order, p.order);
      quad.draw();
      gl.activeTexture(gl.TEXTURE0);
    },
    dispose() {
      gl.deleteProgram(program);
    },
  };
}
