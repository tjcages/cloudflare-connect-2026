import { Minus, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState, type RefObject } from "react";
import { CANVAS_ZOOM_MAX, CANVAS_ZOOM_MIN, clampCanvasZoom, zoomAroundCanvasPoint } from "../canvas/viewZoom";
import { resetAppStoreDocumentToDefault, useAppStore } from "../store";
import { Button } from "./Button";

const ZOOM_BUTTON_STEP = 1.12;

type CanvasViewportToolbarProps = {
  canvasRef: RefObject<HTMLCanvasElement | null>;
};

export const CanvasViewportToolbar = ({ canvasRef }: CanvasViewportToolbarProps) => {
  const canvasZoom = useAppStore((s) => s.canvasZoom);
  const resetCanvasZoom = useAppStore((s) => s.resetCanvasZoom);
  const pixiApp = useAppStore((s) => s.pixiApp);
  const [fps, setFps] = useState(0);

  useEffect(() => {
    if (!pixiApp) {
      return;
    }

    let lastSample = performance.now();
    let frames = 0;

    const onTick = () => {
      frames += 1;
      const now = performance.now();
      if (now - lastSample >= 400) {
        const nextFps = (frames * 1000) / (now - lastSample);
        setFps(nextFps);
        frames = 0;
        lastSample = now;
      }
    };

    pixiApp.ticker.add(onTick);
    return () => {
      pixiApp.ticker.remove(onTick);
    };
  }, [pixiApp]);

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

  const clearCanvasToDefaults = () => {
    const ok = window.confirm(
      "Clear all layers and reset the grid to the built-in default document? This cannot be undone.",
    );
    if (!ok) {
      return;
    }
    resetAppStoreDocumentToDefault();
  };

  return (
    <div className="canvas-panel-viewport-toolbar" role="toolbar" aria-label="Canvas viewport">
      <div className="canvas-toolbar-zoom-group">
        <Button
          variant="ghost"
          padding="square"
          aria-label="Zoom out"
          title="Zoom out"
          disabled={zoomOutDisabled}
          onClick={() => bumpZoom(-1)}
        >
          <Minus size={12} strokeWidth={2} aria-hidden />
        </Button>
        <span className="canvas-toolbar-zoom-readout">{Math.round(canvasZoom * 100)}%</span>
        <Button
          variant="ghost"
          padding="square"
          aria-label="Zoom in"
          title="Zoom in"
          disabled={zoomInDisabled}
          onClick={() => bumpZoom(1)}
        >
          <Plus size={12} strokeWidth={2} aria-hidden />
        </Button>
      </div>
      <span className="canvas-toolbar-vsep" aria-hidden />
      <Button
        variant="ghost"
        padding="inline"
        title="100% zoom, canvas centered (⌘= / ⌘0)"
        onClick={() => resetCanvasZoom()}
      >
        <RotateCcw size={12} strokeWidth={2} aria-hidden />
        <span>Reset view</span>
      </Button>
      <div className="canvas-toolbar-spacer" aria-hidden />
      <span className="canvas-toolbar-fps" aria-label="Render frames per second">
        FPS {(pixiApp ? fps : 0).toFixed(2)}
      </span>
      <span className="canvas-toolbar-vsep" aria-hidden />
      <Button
        variant="ghost"
        padding="inline"
        data-testid="canvas-toolbar-clear-defaults"
        title="Remove all layers and restore the baked-in starter document"
        onClick={clearCanvasToDefaults}
      >
        <Trash2 size={12} strokeWidth={2} aria-hidden />
        <span>Clear</span>
      </Button>
    </div>
  );
};
