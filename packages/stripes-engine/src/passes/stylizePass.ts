import { compileProgram } from "../gl/program";
import { bindRenderTarget, type RenderTarget } from "../gl/renderTarget";
import { FULLSCREEN_VERT } from "../shaders/fullscreen.vert";
import type { RenderMode } from "../config/types";
import { STYLIZE_FRAGS, PASSTHROUGH_FRAG } from "../shaders/stylize";

type StylizeUniforms = {
  mode: RenderMode;
  time: number;
  intensity: number;
  resolution: [number, number];
  dpr: number;
};

type ModeProgram = {
  program: WebGLProgram;
  uTex: WebGLUniformLocation | null;
  uTime: WebGLUniformLocation | null;
  uIntensity: WebGLUniformLocation | null;
  uResolution: WebGLUniformLocation | null;
  uDpr: WebGLUniformLocation | null;
};

export function createStylizePass(gl: WebGL2RenderingContext, quad: { draw(): void }) {
  const cache = new Map<RenderMode, ModeProgram>();

  function getProgram(mode: RenderMode): ModeProgram {
    const cached = cache.get(mode);
    if (cached) return cached;
    const frag = STYLIZE_FRAGS[mode] ?? PASSTHROUGH_FRAG;
    const program = compileProgram(gl, FULLSCREEN_VERT, frag);
    const mp: ModeProgram = {
      program,
      uTex: gl.getUniformLocation(program, "uTex"),
      uTime: gl.getUniformLocation(program, "uTime"),
      uIntensity: gl.getUniformLocation(program, "uIntensity"),
      uResolution: gl.getUniformLocation(program, "uResolution"),
      uDpr: gl.getUniformLocation(program, "uDpr"),
    };
    cache.set(mode, mp);
    return mp;
  }

  return {
    render(target: RenderTarget | null, srcTex: WebGLTexture, p: StylizeUniforms) {
      const mp = getProgram(p.mode);
      bindRenderTarget(gl, target);
      if (!target) gl.viewport(0, 0, p.resolution[0], p.resolution[1]);
      gl.useProgram(mp.program);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, srcTex);
      gl.uniform1i(mp.uTex, 0);
      gl.uniform1f(mp.uTime, p.time);
      gl.uniform1f(mp.uIntensity, p.intensity);
      gl.uniform2f(mp.uResolution, p.resolution[0], p.resolution[1]);
      gl.uniform1f(mp.uDpr, p.dpr);
      quad.draw();
    },
    dispose() {
      for (const mp of cache.values()) gl.deleteProgram(mp.program);
      cache.clear();
    },
  };
}
