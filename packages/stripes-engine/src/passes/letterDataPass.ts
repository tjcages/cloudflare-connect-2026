import { compileProgram } from "../gl/program";
import { bindRenderTarget, type RenderTarget } from "../gl/renderTarget";
import { FULLSCREEN_VERT } from "../shaders/fullscreen.vert";
import { LETTER_DATA_FRAG } from "../shaders/letterData.frag";

export function createLetterDataPass(gl: WebGL2RenderingContext, quad: { draw(): void }) {
  const program = compileProgram(gl, FULLSCREEN_VERT, LETTER_DATA_FRAG);
  const uCell = gl.getUniformLocation(program, "uCell");
  const uGridSize = gl.getUniformLocation(program, "uGridSize");
  const uTopBandThreshold = gl.getUniformLocation(program, "uTopBandThreshold");
  const uCoverage = gl.getUniformLocation(program, "uCoverage");
  const uTimeSec = gl.getUniformLocation(program, "uTimeSec");
  const uCharsetLen = gl.getUniformLocation(program, "uCharsetLen");
  const uShuffleSpeed = gl.getUniformLocation(program, "uShuffleSpeed");

  return {
    render(
      target: RenderTarget,
      cellTex: WebGLTexture,
      p: {
        cols: number;
        rows: number;
        topBandThreshold: number;
        coverage: number;
        timeSec: number;
        charsetLen: number;
        shuffleSpeed: number;
      },
    ) {
      bindRenderTarget(gl, target);
      gl.useProgram(program);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, cellTex);
      gl.uniform1i(uCell, 0);
      gl.uniform2f(uGridSize, p.cols, p.rows);
      gl.uniform1f(uTopBandThreshold, p.topBandThreshold);
      gl.uniform1f(uCoverage, p.coverage);
      gl.uniform1f(uTimeSec, p.timeSec);
      gl.uniform1f(uCharsetLen, p.charsetLen);
      gl.uniform1f(uShuffleSpeed, p.shuffleSpeed);
      quad.draw();
    },
    dispose() {
      gl.deleteProgram(program);
    },
  };
}
