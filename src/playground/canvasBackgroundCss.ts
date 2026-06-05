import { normalizePlaygroundBackgroundCss } from "./playgroundPersistence";

type CanvasBackgroundSize = {
  width: number;
  height: number;
};

export function applyCanvasBackgroundCss(
  canvas: HTMLCanvasElement,
  backgroundCss: string | undefined,
  size: CanvasBackgroundSize,
) {
  canvas.style.cssText = normalizePlaygroundBackgroundCss(backgroundCss) ?? "";
  canvas.style.width = `${size.width}px`;
  canvas.style.height = `${size.height}px`;
}
