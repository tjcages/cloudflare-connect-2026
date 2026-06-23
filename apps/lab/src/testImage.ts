export function createTestImage(size = 512): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, size, size);
  g.addColorStop(0, "#101820");
  g.addColorStop(0.5, "#8899aa");
  g.addColorStop(1, "#f0e8d8");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = "#ff8833";
  ctx.beginPath();
  ctx.arc(size * 0.66, size * 0.33, size * 0.16, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#1b3b6f";
  ctx.fillRect(size * 0.12, size * 0.55, size * 0.4, size * 0.3);
  return c;
}
