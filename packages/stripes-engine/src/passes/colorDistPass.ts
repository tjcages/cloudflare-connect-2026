import { compileProgram } from "../gl/program";
import { bindRenderTarget, type RenderTarget } from "../gl/renderTarget";
import { FULLSCREEN_VERT } from "../shaders/fullscreen.vert";
import { COLOR_DIST_FRAG } from "../shaders/colorDist.frag";
import type { Adjustments } from "../config/types";
import type { SourceRect } from "../source/fit";

export type ColorDistUniforms = {
  srcRect: SourceRect;
  adjustments: Adjustments;
  background: number;
  colorBackground: number;
  sourceTexelW: number;
  sourceTexelH: number;
};

export function createColorDistPass(gl: WebGL2RenderingContext, quad: { draw(): void }) {
  const program = compileProgram(gl, FULLSCREEN_VERT, COLOR_DIST_FRAG);
  const u = (n: string) => gl.getUniformLocation(program, n);
  const L = {
    src: u("uSource"),
    rect: u("uSrcRect"),
    texel: u("uTexel"),
    bg: u("uBg"),
    colorBg: u("uColorBg"),
    blur: u("uBlur"),
    sharpen: u("uSharpen"),
    black: u("uBlack"),
    white: u("uWhite"),
    gamma: u("uGamma"),
    exposure: u("uExposure"),
    contrast: u("uContrast"),
    brightThresh: u("uBrightThresh"),
    invert: u("uInvert"),
    posterize: u("uPosterize"),
    noise: u("uNoise"),
  };
  return {
    render(target: RenderTarget, sourceTex: WebGLTexture, p: ColorDistUniforms) {
      bindRenderTarget(gl, target);
      gl.useProgram(program);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, sourceTex);
      gl.uniform1i(L.src, 0);
      gl.uniform4f(L.rect, p.srcRect.u0, p.srcRect.v0, p.srcRect.u1, p.srcRect.v1);
      gl.uniform2f(L.texel, p.sourceTexelW, p.sourceTexelH);
      const a = p.adjustments;
      gl.uniform3f(
        L.bg,
        ((p.background >> 16) & 255) / 255,
        ((p.background >> 8) & 255) / 255,
        (p.background & 255) / 255,
      );
      gl.uniform3f(
        L.colorBg,
        ((p.colorBackground >> 16) & 255) / 255,
        ((p.colorBackground >> 8) & 255) / 255,
        (p.colorBackground & 255) / 255,
      );
      gl.uniform1f(L.blur, a.blurRadius);
      gl.uniform1f(L.sharpen, a.sharpenAmount);
      gl.uniform1f(L.black, a.blackPoint);
      gl.uniform1f(L.white, a.whitePoint);
      gl.uniform1f(L.gamma, a.gamma);
      gl.uniform1f(L.exposure, a.exposure);
      gl.uniform1f(L.contrast, a.contrast);
      gl.uniform1f(L.brightThresh, a.brightness + a.thresholdBias);
      gl.uniform1f(L.invert, a.invert ? 1 : 0);
      gl.uniform1f(L.posterize, a.posterizeLevels);
      gl.uniform1f(L.noise, a.noiseAmount);
      quad.draw();
    },
    dispose() {
      gl.deleteProgram(program);
    },
  };
}
