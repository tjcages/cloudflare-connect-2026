import { Minus, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState, type RefObject } from "react";
import { CANVAS_ZOOM_MAX, CANVAS_ZOOM_MIN, clampCanvasZoom, zoomAroundCanvasPoint } from "../canvas/viewZoom";
import { resetAppStoreDocumentToDefault, useAppStore } from "../store";
import { Button } from "./Button";

const ZOOM_BUTTON_STEP = 1.12;

const ToolbarHairlineDivider = () => (
  <span className="h-1/2 min-h-2 w-px shrink-0 self-center bg-builder-hairline" aria-hidden />
);

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
    <div
      className="box-border flex h-10 w-full min-w-0 shrink-0 flex-row items-center justify-start gap-2 border-t border-builder-hairline bg-builder-surface px-3.5 py-0"
      data-canvas-toolbar=""
      role="toolbar"
      aria-label="Canvas viewport"
    >
      <div className="inline-flex flex-row items-center gap-1">
        <Button
          variant="ghost"
          padding="square"
          className="grid place-items-center"
          aria-label="Zoom out"
          title="Zoom out"
          disabled={zoomOutDisabled}
          onClick={() => bumpZoom(-1)}
        >
          <Minus size={12} strokeWidth={2} aria-hidden />
        </Button>
        <p className="m-0 min-w-[38px] shrink-0 select-none px-0.5 text-center text-[12px] font-normal tabular-nums text-builder-muted">
          {Math.round(canvasZoom * 100)}%
        </p>
        <Button
          variant="ghost"
          padding="square"
          className="grid place-items-center"
          aria-label="Zoom in"
          title="Zoom in"
          disabled={zoomInDisabled}
          onClick={() => bumpZoom(1)}
        >
          <Plus size={12} strokeWidth={2} aria-hidden />
        </Button>
      </div>
      <ToolbarHairlineDivider />
      <Button
        variant="ghost"
        padding="inline"
        className="inline-flex items-center gap-1.5 whitespace-nowrap"
        title="100% zoom, canvas centered (⌘= / ⌘0)"
        onClick={() => resetCanvasZoom()}
      >
        <RotateCcw size={12} strokeWidth={2} aria-hidden />
        <span>Reset view</span>
      </Button>
      <div className="min-w-0 flex-1" aria-hidden />

      <span
        className="inline-flex shrink-0 select-none items-center justify-center rounded-md border border-transparent bg-transparent px-2.5 py-1.5 text-[12px] font-normal tabular-nums [font-feature-settings:'tnum'_1,'lnum'_1] text-[#b8b8b8]"
        aria-label="Render frames per second"
      >
        FPS {(pixiApp ? fps : 0).toFixed(2)}
      </span>
      <ToolbarHairlineDivider />
      <Button
        variant="ghost"
        padding="inline"
        className="inline-flex items-center gap-1.5 whitespace-nowrap"
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
