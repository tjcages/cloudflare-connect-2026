import { noteFillTarget } from "../perf/fillRecorder";

export type RenderTarget = {
  fbo: WebGLFramebuffer;
  texture: WebGLTexture;
  width: number;
  height: number;
  float?: boolean;
  float32?: boolean;
};

function allocTexture(
  gl: WebGL2RenderingContext,
  tex: WebGLTexture,
  w: number,
  h: number,
  float: boolean,
  float32: boolean,
) {
  gl.bindTexture(gl.TEXTURE_2D, tex);
  const internal = float32 ? gl.RGBA32F : float ? gl.RGBA16F : gl.RGBA8;
  const type = float32 ? gl.FLOAT : float ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE;
  gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, gl.RGBA, type, null);
}

export function createRenderTarget(
  gl: WebGL2RenderingContext,
  width: number,
  height: number,
  opts: { float?: boolean; float32?: boolean; linear?: boolean } = {},
): RenderTarget {
  const texture = gl.createTexture();
  const fbo = gl.createFramebuffer();
  if (!texture || !fbo) {
    if (texture) gl.deleteTexture(texture);
    if (fbo) gl.deleteFramebuffer(fbo);
    throw new Error("Failed to create render target");
  }
  gl.bindTexture(gl.TEXTURE_2D, texture);
  const filter = opts.linear ? gl.LINEAR : gl.NEAREST;
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  allocTexture(gl, texture, width, height, !!opts.float, !!opts.float32);
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  if (status !== gl.FRAMEBUFFER_COMPLETE) throw new Error(`Framebuffer incomplete: 0x${status.toString(16)}`);
  return { fbo, texture, width, height, float: !!opts.float, float32: !!opts.float32 };
}

export function resizeRenderTarget(gl: WebGL2RenderingContext, rt: RenderTarget, width: number, height: number): void {
  if (rt.width === width && rt.height === height) return;
  allocTexture(gl, rt.texture, width, height, rt.float ?? false, rt.float32 ?? false);
  rt.width = width;
  rt.height = height;
}

export function disposeRenderTarget(gl: WebGL2RenderingContext, rt: RenderTarget): void {
  gl.deleteFramebuffer(rt.fbo);
  gl.deleteTexture(rt.texture);
}

export function bindRenderTarget(gl: WebGL2RenderingContext, rt: RenderTarget | null): void {
  gl.bindFramebuffer(gl.FRAMEBUFFER, rt ? rt.fbo : null);
  if (rt) {
    gl.viewport(0, 0, rt.width, rt.height);
    noteFillTarget(rt.width, rt.height);
  }
}

export type MrtTarget = {
  fbo: WebGLFramebuffer;
  dispose(): void;
};

export function createMrtTarget(gl: WebGL2RenderingContext): MrtTarget {
  const fbo = gl.createFramebuffer();
  if (!fbo) throw new Error("Failed to create MRT framebuffer");
  return {
    fbo,
    dispose() {
      gl.deleteFramebuffer(fbo);
    },
  };
}

export function bindMrtTarget(gl: WebGL2RenderingContext, mrt: MrtTarget, attachments: RenderTarget[]): void {
  gl.bindFramebuffer(gl.FRAMEBUFFER, mrt.fbo);
  const buffers: number[] = [];
  for (let i = 0; i < attachments.length; i++) {
    const point = gl.COLOR_ATTACHMENT0 + i;
    gl.framebufferTexture2D(gl.FRAMEBUFFER, point, gl.TEXTURE_2D, attachments[i].texture, 0);
    buffers.push(point);
  }
  gl.drawBuffers(buffers);
  const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
  if (status !== gl.FRAMEBUFFER_COMPLETE) throw new Error(`MRT framebuffer incomplete: 0x${status.toString(16)}`);
  gl.viewport(0, 0, attachments[0].width, attachments[0].height);
  // One dispatch shades every attachment, so each one's area counts.
  for (const attachment of attachments) noteFillTarget(attachment.width, attachment.height);
}
