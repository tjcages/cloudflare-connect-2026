export const CANVAS_ZOOM_MIN = 0.25;
export const CANVAS_ZOOM_MAX = 4;

export const clampCanvasZoom = (z: number) => Math.min(CANVAS_ZOOM_MAX, Math.max(CANVAS_ZOOM_MIN, z));

/** Keep the point under `(clientX, clientY)` stable when changing zoom (same math as ⌘-wheel). */
export function zoomAroundCanvasPoint(options: {
  clientX: number;
  clientY: number;
  rect: DOMRectReadOnly;
  z0: number;
  z1: number;
  pan: { x: number; y: number };
}): { zoom: number; pan: { x: number; y: number } } {
  const { clientX: mx, clientY: my, rect, z0, z1, pan } = options;
  if (z1 === z0) {
    return { zoom: z0, pan };
  }
  return {
    zoom: z1,
    pan: {
      x: mx - rect.left + pan.x - (z1 * (mx - rect.left)) / z0,
      y: my - rect.top + pan.y - (z1 * (my - rect.top)) / z0,
    },
  };
}
