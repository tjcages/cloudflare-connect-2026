import { compileProgram } from "../gl/program";
import { bindRenderTarget, type RenderTarget } from "../gl/renderTarget";
import { FULLSCREEN_VERT } from "../shaders/fullscreen.vert";
import { WHIRLPOOL_REVEAL_FRAG } from "../shaders/whirlpoolReveal.frag";

export type WhirlpoolUniforms = {
  progress: number;
  turns: number;
  tightness: number;
  streak: number;
  glow: number;
  aspect: number;
};

export function createWhirlpoolPass(gl: WebGL2RenderingContext, quad: { draw(): void }) {
  const program = compileProgram(gl, FULLSCREEN_VERT, WHIRLPOOL_REVEAL_FRAG);
  const u = (n: string) => gl.getUniformLocation(program, n);
  const U = {
    field: u("uField"),
    progress: u("uProgress"),
    turns: u("uTurns"),
    tightness: u("uTightness"),
    streak: u("uStreak"),
    glow: u("uGlow"),
    aspect: u("uAspect"),
  };
  return {
    render(target: RenderTarget, fieldTex: WebGLTexture, p: WhirlpoolUniforms) {
      bindRenderTarget(gl, target);
      gl.useProgram(program);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, fieldTex);
      gl.uniform1i(U.field, 0);
      gl.uniform1f(U.progress, p.progress);
      gl.uniform1f(U.turns, p.turns);
      gl.uniform1f(U.tightness, p.tightness);
      gl.uniform1f(U.streak, p.streak);
      gl.uniform1f(U.glow, p.glow);
      gl.uniform1f(U.aspect, p.aspect);
      quad.draw();
    },
    dispose() {
      gl.deleteProgram(program);
    },
  };
}
