export type EngineSource = HTMLImageElement | HTMLVideoElement | ImageBitmap | HTMLCanvasElement;

function mediaSize(media: EngineSource): { width: number; height: number } {
  if (media instanceof HTMLVideoElement) return { width: media.videoWidth || 1, height: media.videoHeight || 1 };
  if (media instanceof HTMLImageElement) return { width: media.naturalWidth || 1, height: media.naturalHeight || 1 };
  return {
    width: (media as ImageBitmap | HTMLCanvasElement).width || 1,
    height: (media as ImageBitmap | HTMLCanvasElement).height || 1,
  };
}

export type SourceTexture = {
  texture: WebGLTexture;
  width: number;
  height: number;
  isVideo: boolean;
  update(): void;
  dispose(): void;
};

export function createSourceTexture(gl: WebGL2RenderingContext, media: EngineSource): SourceTexture {
  const texture = gl.createTexture();
  if (!texture) throw new Error("Failed to create source texture");
  const isVideo = media instanceof HTMLVideoElement;
  let { width, height } = mediaSize(media);

  function upload() {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, media as TexImageSource);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  }

  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  upload();

  return {
    texture,
    get width() {
      return width;
    },
    get height() {
      return height;
    },
    isVideo,
    update() {
      if (!isVideo) return;
      const v = media as HTMLVideoElement;
      if (v.readyState < 2) return;
      width = v.videoWidth || width;
      height = v.videoHeight || height;
      upload();
    },
    dispose() {
      gl.deleteTexture(texture);
    },
  } as SourceTexture;
}
