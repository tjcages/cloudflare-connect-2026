import { Minus, Plus, RotateCcw } from "lucide-react";
import { useCallback, type RefObject } from "react";
import { CANVAS_ZOOM_MAX, CANVAS_ZOOM_MIN, clampCanvasZoom, zoomAroundCanvasPoint } from "../canvas/viewZoom";
import { useAppStore } from "../store";

const ZOOM_BUTTON_STEP = 1.12;

type CanvasViewportToolbarProps = {
  canvasRef: RefObject<HTMLCanvasElement | null>;
};

export const CanvasViewportToolbar = ({ canvasRef }: CanvasViewportToolbarProps) => {
  const canvasZoom = useAppStore((s) => s.canvasZoom);
  const canvasPan = useAppStore((s) => s.canvasPan);
  const resetCanvasZoom = useAppStore((s) => s.resetCanvasZoom);

  const bumpZoom = useCallback(
    (direction: 1 | -1) => {
      const canvas = canvasRef.current;
      if (!canvas) {
        return;
      }
      const rect = canvas.getBoundingClientRect();
      const { canvasZoom: z0, canvasPan: pan } = useAppStore.getState();
      const factor = direction > 0 ? ZOOM_BUTTON_STEP : 1 / ZOOM_BUTTON_STEP;
      const { zoom, pan: nextPan } = zoomAroundCanvasPoint({
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2,
        rect,
        z0,
        z1: clampCanvasZoom(z0 * factor),
        pan,
      });
      if (zoom === z0) {
        return;
      }
      useAppStore.setState({ canvasZoom: zoom, canvasPan: nextPan });
    },
    [canvasRef],
  );

  const zoomOutDisabled = canvasZoom <= CANVAS_ZOOM_MIN + 1e-4;
  const zoomInDisabled = canvasZoom >= CANVAS_ZOOM_MAX - 1e-4;
  const resetDisabled = Math.abs(canvasZoom - 1) < 1e-4 && Math.abs(canvasPan.x) < 1e-4 && Math.abs(canvasPan.y) < 1e-4;

  return (
    <div className="canvas-panel-viewport-toolbar" role="toolbar" aria-label="Canvas zoom">
      <button
        type="button"
        className="canvas-toolbar-button"
        aria-label="Zoom out"
        title="Zoom out"
        disabled={zoomOutDisabled}
        onClick={() => bumpZoom(-1)}
      >
        <Minus size={15} strokeWidth={2} aria-hidden />
      </button>
      <span className="canvas-toolbar-zoom-readout">{Math.round(canvasZoom * 100)}%</span>
      <button
        type="button"
        className="canvas-toolbar-button"
        aria-label="Zoom in"
        title="Zoom in"
        disabled={zoomInDisabled}
        onClick={() => bumpZoom(1)}
      >
        <Plus size={15} strokeWidth={2} aria-hidden />
      </button>
      <button
        type="button"
        className="canvas-toolbar-button"
        aria-label="Reset view to 100% zoom and center canvas"
        title="Reset view — 100% zoom, centered (⌘= / ⌘0)"
        disabled={resetDisabled}
        onClick={() => resetCanvasZoom()}
      >
        <RotateCcw size={14} strokeWidth={2} aria-hidden />
      </button>
    </div>
  );
};
