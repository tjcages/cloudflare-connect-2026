// Pass `element` to size the canvas to another element's box (e.g. its positioned parent) instead of itself.
export const scaleCanvasToDisplay = (
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  element: Element = canvas
) => {
  const dpr = window.devicePixelRatio || 1;
  const { width, height } = element.getBoundingClientRect();

  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  return { width, height };
};
