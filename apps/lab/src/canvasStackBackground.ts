/** CSS backdrop for `.lab-canvas-stack` behind shader underlay / source preview. */
export function canvasStackBackgroundCss(background: { transparent: boolean; color: number }): string | undefined {
  if (background.transparent) return undefined;
  const color = Math.max(0, Math.min(0xffffff, Math.round(background.color))) >>> 0;
  return `#${color.toString(16).padStart(6, "0")}`;
}
