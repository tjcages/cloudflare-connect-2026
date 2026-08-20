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
