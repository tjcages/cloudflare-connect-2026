export type EngineSource = HTMLImageElement | HTMLVideoElement | ImageBitmap | HTMLCanvasElement | VideoFrame;

function isVideoElement(media: EngineSource): media is HTMLVideoElement {
  return typeof HTMLVideoElement !== "undefined" && media instanceof HTMLVideoElement;
}

function isImageElement(media: EngineSource): media is HTMLImageElement {
  return typeof HTMLImageElement !== "undefined" && media instanceof HTMLImageElement;
}

function isVideoFrame(media: EngineSource): media is VideoFrame {
  return typeof VideoFrame !== "undefined" && media instanceof VideoFrame;
}

function mediaSize(media: EngineSource): { width: number; height: number } {
  if (isVideoElement(media)) return { width: media.videoWidth || 1, height: media.videoHeight || 1 };
  if (isImageElement(media)) return { width: media.naturalWidth || 1, height: media.naturalHeight || 1 };
  if (isVideoFrame(media)) return { width: media.displayWidth || 1, height: media.displayHeight || 1 };
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
  uploadFrame(frame: EngineSource): void;
  dispose(): void;
};

export function createSourceTexture(gl: WebGL2RenderingContext, media: EngineSource): SourceTexture {
  const texture = gl.createTexture();
  if (!texture) throw new Error("Failed to create source texture");
  const isVideo = isVideoElement(media);
  let { width, height } = mediaSize(media);

  function upload(frame: EngineSource) {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, frame as TexImageSource);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  }

  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  upload(media);

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
      upload(media);
    },
    uploadFrame(frame: EngineSource) {
      const size = mediaSize(frame);
      width = size.width || width;
      height = size.height || height;
      upload(frame);
    },
    dispose() {
      gl.deleteTexture(texture);
    },
  } as SourceTexture;
}
