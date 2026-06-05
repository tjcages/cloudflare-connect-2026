import { normalizePlaygroundBackgroundCss } from "./playgroundPersistence";

export const DEFAULT_PLAYGROUND_BACKGROUND_COLOR = 0xffffff;

type CanvasBackgroundSize = {
  width: number;
  height: number;
};

export function playgroundBackgroundColorToHex(value: number): string {
  return `#${(value & 0xffffff).toString(16).padStart(6, "0")}`;
}

export function applyCanvasBackgroundCss(
  canvas: HTMLCanvasElement,
  backgroundCss: string | undefined,
  size: CanvasBackgroundSize,
  backgroundColor: number = DEFAULT_PLAYGROUND_BACKGROUND_COLOR,
) {
  const css = normalizePlaygroundBackgroundCss(backgroundCss);
  canvas.style.cssText = css ?? `background: ${playgroundBackgroundColorToHex(backgroundColor)};`;
  canvas.style.width = `${size.width}px`;
  canvas.style.height = `${size.height}px`;
}
