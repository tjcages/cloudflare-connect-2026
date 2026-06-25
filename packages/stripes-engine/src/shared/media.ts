export function loadImageFrame(src: string): Promise<ImageBitmap> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.addEventListener(
      "load",
      () => {
        createImageBitmap(img, { colorSpaceConversion: "none" }).then(resolve, reject);
      },
      { once: true },
    );
    img.addEventListener("error", () => reject(new Error(`Failed to load image: ${src}`)), { once: true });
    img.src = src;
  });
}

export type VideoFramePumpOptions = {
  src: string;
  loop: boolean;
  muted: boolean;
  autoPlay: boolean;
};

export type VideoFramePump = {
  start(onFrame: (bmp: ImageBitmap) => void): void;
  stop(): void;
  dispose(): void;
  readonly video: HTMLVideoElement;
};

type RvfcVideo = HTMLVideoElement & {
  requestVideoFrameCallback?: (cb: (now: number, metadata: unknown) => void) => number;
  cancelVideoFrameCallback?: (handle: number) => void;
};

export function createVideoFramePump(opts: VideoFramePumpOptions): VideoFramePump {
  const video = document.createElement("video") as RvfcVideo;
  video.muted = opts.muted;
  video.loop = opts.loop;
  video.playsInline = true;
  video.crossOrigin = "anonymous";
  video.preload = "auto";
  video.src = opts.src;

  let running = false;
  let disposed = false;
  let rvfcHandle = 0;
  let intervalHandle: ReturnType<typeof setInterval> | null = null;
  let inFlight = false;
  const supportsRvfc = typeof video.requestVideoFrameCallback === "function";

  function grab(onFrame: (bmp: ImageBitmap) => void): void {
    if (disposed || inFlight) return;
    if (video.readyState < 2) return;
    inFlight = true;
    createImageBitmap(video, { colorSpaceConversion: "none" }).then(
      (bmp) => {
        inFlight = false;
        if (disposed || !running) {
          bmp.close();
          return;
        }
        onFrame(bmp);
      },
      () => {
        inFlight = false;
      },
    );
  }

  function start(onFrame: (bmp: ImageBitmap) => void): void {
    if (disposed || running) return;
    running = true;
    if (opts.autoPlay) void video.play().catch(() => {});
    if (supportsRvfc) {
      const tick = () => {
        if (!running || disposed) return;
        grab(onFrame);
        rvfcHandle = video.requestVideoFrameCallback!(tick);
      };
      rvfcHandle = video.requestVideoFrameCallback!(tick);
      return;
    }
    intervalHandle = setInterval(() => {
      if (!running || disposed) return;
      grab(onFrame);
    }, 1000 / 30);
  }

  function stop(): void {
    if (!running) return;
    running = false;
    if (rvfcHandle && typeof video.cancelVideoFrameCallback === "function") {
      video.cancelVideoFrameCallback(rvfcHandle);
    }
    rvfcHandle = 0;
    if (intervalHandle !== null) {
      clearInterval(intervalHandle);
      intervalHandle = null;
    }
  }

  function dispose(): void {
    if (disposed) return;
    stop();
    disposed = true;
    video.pause();
    video.removeAttribute("src");
    video.load();
  }

  return {
    start,
    stop,
    dispose,
    get video() {
      return video;
    },
  };
}
