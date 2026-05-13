import Pixi from "../components/pixi";
import { hitTestComponentInstances } from "./hitTest";
import { setupIconBoxLayer } from "./components/icon-box/setup";
import { setupGridLayer } from "./grid/setup";
import { setupSelectionLayer } from "./selection-setup";
import { useAppStore } from "../store";

const tickers = [setupGridLayer, setupIconBoxLayer, setupSelectionLayer];

const getCanvasPoint = (
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number,
  logicalWidth: number,
  logicalHeight: number,
) => {
  const bounds = canvas.getBoundingClientRect();
  const scaleX = logicalWidth / bounds.width;
  const scaleY = logicalHeight / bounds.height;

  return {
    x: (clientX - bounds.left) * scaleX,
    y: (clientY - bounds.top) * scaleY,
  };
};

type BuilderCanvasProps = {
  onUserSelectedInstance?: (id: string | null) => void;
  onPlacedNewInstance?: () => void;
};

export const GridCanvas = ({ onUserSelectedInstance, onPlacedNewInstance }: BuilderCanvasProps) => {
  const grid = useAppStore((s) => s.grid);

  const selectInstance = useAppStore((s) => s.selectInstance);
  const finalizeCreateAt = useAppStore((s) => s.finalizeCreateAt);
  const updateCreatePreview = useAppStore((s) => s.updateCreatePreview);
  const startMoveDrag = useAppStore((s) => s.startMoveDrag);
  const moveInstanceTo = useAppStore((s) => s.moveInstanceTo);
  const endCanvasDrag = useAppStore((s) => s.endCanvasDrag);

  const lw = grid.config.logicalWidth;
  const lh = grid.config.logicalHeight;

  return (
    <div className="canvas-shell">
      <Pixi
        canvasAttrs={{
          className: "grid-canvas",
          role: "img",
          "aria-label": "Component builder canvas",
          onPointerDown: (event) => {
            const canvas = event.currentTarget;

            const instances = useAppStore.getState().instances;
            const point = getCanvasPoint(canvas, event.clientX, event.clientY, lw, lh);
            const hitInstance = hitTestComponentInstances(instances, point.x, point.y);

            if (!hitInstance) {
              selectInstance(null);
              return;
            }

            event.preventDefault();
            canvas.setPointerCapture(event.pointerId);
            selectInstance(hitInstance.id);
            onUserSelectedInstance?.(hitInstance.id);
            startMoveDrag(hitInstance.id, point.x - hitInstance.x, point.y - hitInstance.y);
          },
          onPointerMove: (event) => {
            const canvas = event.currentTarget;
            const dragState = useAppStore.getState().dragState;
            if (dragState === null) {
              return;
            }

            const point = getCanvasPoint(canvas, event.clientX, event.clientY, lw, lh);

            if (dragState.mode === "create") {
              updateCreatePreview(dragState.type, point.x, point.y);
              return;
            }

            moveInstanceTo(dragState.id, point.x - dragState.offsetX, point.y - dragState.offsetY);
          },
          onPointerUp: (event) => {
            const canvas = event.currentTarget;
            const dragState = useAppStore.getState().dragState;
            if (dragState === null) {
              return;
            }

            const point = getCanvasPoint(canvas, event.clientX, event.clientY, lw, lh);

            if (dragState.mode === "create") {
              finalizeCreateAt(dragState.type, point.x, point.y);
              onPlacedNewInstance?.();
            } else {
              canvas.releasePointerCapture(event.pointerId);
              endCanvasDrag();
            }
          },
          onClick: (event) => {
            if (useAppStore.getState().dragState !== null) {
              return;
            }

            const canvas = event.currentTarget as HTMLCanvasElement;
            const instances = useAppStore.getState().instances;
            const point = getCanvasPoint(canvas, event.clientX, event.clientY, lw, lh);
            const hitId = hitTestComponentInstances(instances, point.x, point.y)?.id ?? null;
            selectInstance(hitId);
            if (hitId) {
              onUserSelectedInstance?.(hitId);
            }
          },
        }}
        layoutWidth={lw}
        layoutHeight={lh}
        onInitialized={(app) => {
          useAppStore.getState().setPixiApp(app);
        }}
        onDisposed={() => {
          useAppStore.getState().setPixiApp(null);
        }}
        tickers={tickers}
      />
    </div>
  );
};
