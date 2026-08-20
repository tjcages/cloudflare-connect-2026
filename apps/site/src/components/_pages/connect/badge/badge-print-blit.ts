/** Replace destination pixels. Source-over leaves the previous SVG in transparent holes. */
export function blitPrintFrame(
  output: CanvasRenderingContext2D,
  source: HTMLCanvasElement | null
) {
  output.globalCompositeOperation = "copy";
  if (source) {
    output.drawImage(source, 0, 0);
    return;
  }
  output.fillStyle = "#ffffff";
  output.fillRect(0, 0, output.canvas.width, output.canvas.height);
}
