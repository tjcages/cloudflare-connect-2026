const PREVIEW_ZOOM_MIN = 0.001;
const PREVIEW_ZOOM_MAX = 4;

export function clampPreviewZoom(value: number): number {
  return Math.min(PREVIEW_ZOOM_MAX, Math.max(PREVIEW_ZOOM_MIN, Number(value.toFixed(3))));
}

/** Preview zoom that fits the canvas inside the available viewport (contain). */
export function computeFitPreviewZoom(input: {
  canvasWidth: number;
  canvasHeight: number;
  viewportWidth: number;
  viewportHeight: number;
}): number {
  const canvasWidth = Math.max(0, input.canvasWidth);
  const canvasHeight = Math.max(0, input.canvasHeight);
  const viewportWidth = Math.max(1, input.viewportWidth);
  const viewportHeight = Math.max(1, input.viewportHeight);
  if (canvasWidth <= 0 || canvasHeight <= 0) return 1;
  return clampPreviewZoom(Math.min(viewportWidth / canvasWidth, viewportHeight / canvasHeight));
}

/** Estimate the canvas viewport from the window and open sidebar widths. */
export function estimateCanvasViewportSize(input: {
  windowWidth: number;
  windowHeight: number;
  textureSidebarOpen: boolean;
  textureSidebarWidth: number;
  shaderSidebarOpen: boolean;
  shaderSidebarWidth: number;
  /** Horizontal padding inside `.lab-canvas-area`. */
  areaPaddingX?: number;
  /** Vertical padding inside `.lab-canvas-area`. */
  areaPaddingY?: number;
  /** Footer / bottom bar height. */
  bottomBarHeight?: number;
}): { width: number; height: number } {
  const padX = input.areaPaddingX ?? 48;
  const padY = input.areaPaddingY ?? 48;
  const bottomBarHeight = input.bottomBarHeight ?? 52;
  const left = input.textureSidebarOpen ? Math.max(0, input.textureSidebarWidth) : 0;
  const right = input.shaderSidebarOpen ? Math.max(0, input.shaderSidebarWidth) : 0;
  return {
    width: Math.max(1, input.windowWidth - left - right - padX),
    height: Math.max(1, input.windowHeight - bottomBarHeight - padY),
  };
}
