export type BadgePrintFieldRect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export function badgePrintFieldRect(
  width: number,
  height: number,
  padX: number,
  padTop: number,
  footerBand: number
): BadgePrintFieldRect {
  const x = width * Math.max(padX, 0);
  const y = height * Math.max(padTop, 0);
  const footer = height * Math.max(footerBand, 0);
  return {
    x,
    y,
    w: Math.max(1, width - x * 2),
    h: Math.max(1, height - y - footer),
  };
}

/** Fade the print into the footer. Sides and top stay sharp. */
export function fadePrintField(
  ctx: CanvasRenderingContext2D,
  field: BadgePrintFieldRect,
  feather: number
) {
  const fade = Math.max(
    1,
    Math.round(field.h * Math.max(feather, 0))
  );
  const y0 = field.y + field.h - fade;
  const y1 = field.y + field.h;
  const bottom = ctx.createLinearGradient(0, y0, 0, y1);
  bottom.addColorStop(0, "rgba(255,255,255,0)");
  bottom.addColorStop(1, "#ffffff");
  ctx.fillStyle = bottom;
  ctx.fillRect(field.x, y0, field.w, fade);
}
