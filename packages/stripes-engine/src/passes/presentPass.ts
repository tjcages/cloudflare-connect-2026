import { compileProgram } from "../gl/program";
import { noteFillTarget } from "../perf/fillRecorder";
import { FULLSCREEN_VERT } from "../shaders/fullscreen.vert";
import { PRESENT_FRAG } from "../shaders/present.frag";
import type { EdgeMaskConfig } from "../config/types";

export function createPresentPass(gl: WebGL2RenderingContext, quad: { draw(): void }) {
  const program = compileProgram(gl, FULLSCREEN_VERT, PRESENT_FRAG);
  const uField = gl.getUniformLocation(program, "uField");
  const uEnabled = gl.getUniformLocation(program, "uEdgeMaskEnabled");
  const uStart = gl.getUniformLocation(program, "uEdgeMaskStart");
  const uEnd = gl.getUniformLocation(program, "uEdgeMaskEnd");
  const uPower = gl.getUniformLocation(program, "uEdgeMaskPower");
  const uSides = gl.getUniformLocation(program, "uEdgeMaskSides");
  return {
    render(
      fieldTex: WebGLTexture,
      outWidth: number,
      outHeight: number,
      edgeMask: EdgeMaskConfig,
      originX = 0,
      originY = 0,
    ) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(originX, originY, outWidth, outHeight);
      noteFillTarget(outWidth, outHeight);
      gl.useProgram(program);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, fieldTex);
      gl.uniform1i(uField, 0);
      gl.uniform1f(uEnabled, edgeMask.enabled ? 1 : 0);
      gl.uniform1f(uStart, edgeMask.start);
      gl.uniform1f(uEnd, edgeMask.end);
      gl.uniform1f(uPower, edgeMask.power);
      // vUv.y is bottom-up, so uSides packs (left, right, bottom, top).
      gl.uniform4f(
        uSides,
        edgeMask.sides.left ? 1 : 0,
        edgeMask.sides.right ? 1 : 0,
        edgeMask.sides.bottom ? 1 : 0,
        edgeMask.sides.top ? 1 : 0,
      );
      quad.draw();
    },
    dispose() {
      gl.deleteProgram(program);
    },
  };
}
