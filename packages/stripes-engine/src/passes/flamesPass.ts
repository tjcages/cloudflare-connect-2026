import { compileProgram } from "../gl/program";
import { bindRenderTarget, type RenderTarget } from "../gl/renderTarget";
import { FLAMES_VERT } from "../shaders/flames.vert";
import { FLAMES_FRAG } from "../shaders/flames.frag";
import type { Flame } from "../flames/flamesSim";

export function createFlamesPass(gl: WebGL2RenderingContext) {
  const program = compileProgram(gl, FLAMES_VERT, FLAMES_FRAG);
  const vao = gl.createVertexArray();
  if (!vao) throw new Error("Failed to create VAO");
  const buf = gl.createBuffer();
  if (!buf) throw new Error("Failed to create instance buffer");

  const aRect = gl.getAttribLocation(program, "aRect");
  const aOpacity = gl.getAttribLocation(program, "aOpacity");
  const uCanvas = gl.getUniformLocation(program, "uCanvas");
  const uVertical = gl.getUniformLocation(program, "uVertical");
  const uInner = gl.getUniformLocation(program, "uInner");
  const uOuter = gl.getUniformLocation(program, "uOuter");

  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  const stride = 20;
  gl.enableVertexAttribArray(aRect);
  gl.vertexAttribPointer(aRect, 4, gl.FLOAT, false, stride, 0);
  gl.vertexAttribDivisor(aRect, 1);
  gl.enableVertexAttribArray(aOpacity);
  gl.vertexAttribPointer(aOpacity, 1, gl.FLOAT, false, stride, 16);
  gl.vertexAttribDivisor(aOpacity, 1);
  gl.bindVertexArray(null);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  let instanceData = new Float32Array(0);

  return {
    render(
      target: RenderTarget,
      flames: Flame[],
      opts: { canvasW: number; canvasH: number; vertical: boolean; inner: number; outer: number },
    ) {
      if (flames.length === 0) return;

      const needed = flames.length * 5;
      if (instanceData.length < needed) {
        instanceData = new Float32Array(needed);
      }
      for (let i = 0; i < flames.length; i++) {
        const f = flames[i];
        const base = i * 5;
        instanceData[base] = f.x;
        instanceData[base + 1] = f.y;
        instanceData[base + 2] = f.width;
        instanceData[base + 3] = f.height;
        instanceData[base + 4] = f.opacity;
      }

      bindRenderTarget(gl, target);
      gl.useProgram(program);
      gl.uniform2f(uCanvas, opts.canvasW, opts.canvasH);
      gl.uniform1f(uVertical, opts.vertical ? 1.0 : 0.0);
      gl.uniform1f(uInner, opts.inner);
      gl.uniform1f(uOuter, opts.outer);

      gl.bindVertexArray(vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, instanceData.subarray(0, needed), gl.DYNAMIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, null);

      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, flames.length);
      gl.disable(gl.BLEND);

      gl.bindVertexArray(null);
    },
    dispose() {
      gl.deleteProgram(program);
      gl.deleteVertexArray(vao);
      gl.deleteBuffer(buf);
    },
  };
}
