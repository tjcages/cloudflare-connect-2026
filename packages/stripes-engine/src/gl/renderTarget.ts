export type RenderTarget = {
  fbo: WebGLFramebuffer;
  texture: WebGLTexture;
  width: number;
  height: number;
  float?: boolean;
};

function allocTexture(gl: WebGL2RenderingContext, tex: WebGLTexture, w: number, h: number, float: boolean) {
  gl.bindTexture(gl.TEXTURE_2D, tex);
  const internal = float ? gl.RGBA16F : gl.RGBA8;
  const type = float ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE;
  gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, gl.RGBA, type, null);
}

export function createRenderTarget(
  gl: WebGL2RenderingContext,
  width: number,
  height: number,
  opts: { float?: boolean; linear?: boolean } = {},
): RenderTarget {
  const texture = gl.createTexture();
  const fbo = gl.createFramebuffer();
  if (!texture || !fbo) throw new Error("Failed to create render target");
  gl.bindTexture(gl.TEXTURE_2D, texture);
  const filter = opts.linear ? gl.LINEAR : gl.NEAREST;
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  allocTexture(gl, texture, width, height, !!opts.float);
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  if (status !== gl.FRAMEBUFFER_COMPLETE) throw new Error(`Framebuffer incomplete: 0x${status.toString(16)}`);
  return { fbo, texture, width, height, float: !!opts.float };
}

export function resizeRenderTarget(gl: WebGL2RenderingContext, rt: RenderTarget, width: number, height: number): void {
  if (rt.width === width && rt.height === height) return;
  allocTexture(gl, rt.texture, width, height, rt.float ?? false);
  rt.width = width;
  rt.height = height;
}

export function disposeRenderTarget(gl: WebGL2RenderingContext, rt: RenderTarget): void {
  gl.deleteFramebuffer(rt.fbo);
  gl.deleteTexture(rt.texture);
}

export function bindRenderTarget(gl: WebGL2RenderingContext, rt: RenderTarget | null): void {
  gl.bindFramebuffer(gl.FRAMEBUFFER, rt ? rt.fbo : null);
  if (rt) gl.viewport(0, 0, rt.width, rt.height);
}
