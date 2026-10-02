import { createRainLayer, createTwizzlerLayer, FPS } from "../sofi-stadium/layers";
import { CONNECT_HERO_RAIN_DEFAULT } from "../hero/rain-control-settings";

/** The venue loop: two 20s cycles, so every sweep direction plays once. */
export const LOOP_SEC = 40;
export const ASPECT = 40 / 9;

declare global {
  interface Window {
    /** Hook driven by scripts/export-signage.mjs. */
    signageExport?: {
      /** Jump the text sweep to cycle `n` (even sweeps left to right, odd right to left). */
      setCycle(n: number): void;
      /** Render one composited output frame and POST its RGBA pixels. */
      renderFrame(args: { frame: number; port: number; fetchOverlay: boolean }): Promise<void>;
      FRAMES: number;
    };
  }
}

/**
 * White frame, Twizzler ribbon, rain (faded toward the top exactly like the
 * hero's mask), then the DOM text layer the exporter screenshots.
 */
export function installExport(setCycle: (cycle: number) => void) {
  const width = Math.round(innerWidth * devicePixelRatio);
  const height = Math.round(width / ASPECT);
  const spec = { aspect: ASPECT, loopSec: LOOP_SEC };
  const twizzler = createTwizzlerLayer(width, height, spec);
  const rain = createRainLayer(width, height, spec);
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext("2d")!;
  const stack = new OffscreenCanvas(width, height);
  const stackContext = stack.getContext("2d")!;
  const base = getComputedStyle(document.documentElement).getPropertyValue("--color-background-base").trim();
  const { topFadePct, topFadeOffsetPct } = CONNECT_HERO_RAIN_DEFAULT;
  const fade = stackContext.createLinearGradient(0, 0, 0, height);
  fade.addColorStop(topFadeOffsetPct / 100, "transparent");
  fade.addColorStop(Math.min(1, (topFadeOffsetPct + topFadePct) / 100), "black");
  let overlay: ImageBitmap | null = null;

  window.signageExport = {
    FRAMES: LOOP_SEC * FPS,
    setCycle,
    async renderFrame({ frame, port, fetchOverlay }) {
      if (fetchOverlay) {
        overlay?.close();
        overlay = await createImageBitmap(await (await fetch(`http://127.0.0.1:${port}/overlay`)).blob());
      }
      twizzler.step();
      rain.step();
      stackContext.globalCompositeOperation = "source-over";
      stackContext.clearRect(0, 0, width, height);
      stackContext.drawImage(twizzler.canvas, 0, 0);
      stackContext.drawImage(rain.canvas, 0, 0);
      stackContext.globalCompositeOperation = "destination-in";
      stackContext.fillStyle = fade;
      stackContext.fillRect(0, 0, width, height);
      context.fillStyle = base || "#fff";
      context.fillRect(0, 0, width, height);
      context.drawImage(stack, 0, 0);
      if (overlay) context.drawImage(overlay, 0, 0, width, height);
      const { data } = context.getImageData(0, 0, width, height);
      const response = await fetch(`http://127.0.0.1:${port}/?frame=${frame}`, { method: "POST", body: new Blob([data]) });
      if (!response.ok) throw new Error(`frame ${frame}: HTTP ${response.status}`);
    },
  };
}
