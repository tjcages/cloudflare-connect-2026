import type { Ref } from "react";
import Pixi from "../components/pixi";
import { getCanvasPoint } from "./coords";
import { hitTestComponentInstances } from "./hitTest";
import { setupIconBoxLayer } from "./components/icon-box/setup";
import { setupGridLayer } from "./grid/setup";
import { setupSelectionLayer } from "./selection-setup";
import { useAppStore } from "../store";

const tickers = [setupGridLayer, setupIconBoxLayer, setupSelectionLayer];

type BuilderCanvasProps = {
  canvasRef?: Ref<HTMLCanvasElement | null>;
  onUserSelectedInstance?: (id: string | null) => void;
};

export const GridCanvas = ({ canvasRef, onUserSelectedInstance }: BuilderCanvasProps) => {
  const grid = useAppStore((s) => s.grid);

  const selectInstance = useAppStore((s) => s.selectInstance);
  const startMoveDrag = useAppStore((s) => s.startMoveDrag);
  const moveInstanceTo = useAppStore((s) => s.moveInstanceTo);
  const endCanvasDrag = useAppStore((s) => s.endCanvasDrag);

  const lw = grid.config.logicalWidth;
  const lh = grid.config.logicalHeight;

  return (
    <div className="canvas-shell">
      <Pixi
        canvasRef={canvasRef}
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
            if (dragState === null || dragState.mode === "create") {
              return;
            }

            const point = getCanvasPoint(canvas, event.clientX, event.clientY, lw, lh);
            moveInstanceTo(dragState.id, point.x - dragState.offsetX, point.y - dragState.offsetY);
          },
          onPointerUp: (event) => {
            const canvas = event.currentTarget;
            const dragState = useAppStore.getState().dragState;
            if (dragState === null || dragState.mode === "create") {
              return;
            }

            canvas.releasePointerCapture(event.pointerId);
            endCanvasDrag();
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
