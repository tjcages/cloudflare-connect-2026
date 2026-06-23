function uploadBytes(gl: WebGL2RenderingContext, tex: WebGLTexture, bytes: Uint8Array, width: number, height: number) {
  gl.bindTexture(gl.TEXTURE_2D, tex);
  // Raw ArrayBufferView upload is NOT subject to unpackColorSpace conversion — safe for data textures.
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
}

export function createDataTexture(
  gl: WebGL2RenderingContext,
  bytes: Uint8Array,
  width: number,
  height: number,
): WebGLTexture {
  const tex = gl.createTexture();
  if (!tex) throw new Error("Failed to create data texture");
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  uploadBytes(gl, tex, bytes, width, height);
  return tex;
}

export function updateDataTexture(
  gl: WebGL2RenderingContext,
  tex: WebGLTexture,
  bytes: Uint8Array,
  width: number,
  height: number,
): void {
  uploadBytes(gl, tex, bytes, width, height);
}
