import { useRef, type Ref } from "react";
import Pixi from "../components/pixi";
import { getCanvasPoint } from "./coords";
import { hitTestComponentInstances } from "./hitTest";
import { setupComponentLayer } from "./components/componentLayer";
import { setupGridLayer } from "./grid/setup";
import { setupSelectionLayer } from "./selection-setup";
import { preloadIconBoxTitleFont } from "../fonts/iconBoxTitle";
import { useAppStore } from "../store";

const tickers = [setupGridLayer, setupComponentLayer, setupSelectionLayer];

type BuilderCanvasProps = {
  canvasRef?: Ref<HTMLCanvasElement | null>;
  onUserSelectedInstance?: (id: string | null) => void;
};

export const GridCanvas = ({ canvasRef, onUserSelectedInstance }: BuilderCanvasProps) => {
  /** After a connector endpoint is placed on `pointerdown`, the same gesture still fires `click`, which would clear selection on empty hits. */
  const skipNextClickSelectionSyncRef = useRef(false);

  const grid = useAppStore((s) => s.grid);

  const selectInstance = useAppStore((s) => s.selectInstance);
  const startMoveDrag = useAppStore((s) => s.startMoveDrag);
  const moveInstanceTo = useAppStore((s) => s.moveInstanceTo);
  const endCanvasDrag = useAppStore((s) => s.endCanvasDrag);
  const setConnectorEndpointCell = useAppStore((s) => s.setConnectorEndpointCell);
  const setConnectorEndpointHoverCell = useAppStore((s) => s.setConnectorEndpointHoverCell);
  const clearConnectorEndpointHoverCell = useAppStore((s) => s.clearConnectorEndpointHoverCell);
  const isPickingConnectorEndpoint = useAppStore((s) => s.connectorEndpointPick !== null);

  const logicalWidth = grid.config.logicalWidth;
  const logicalHeight = grid.config.logicalHeight;
  const renderWidth = grid.config.renderWidth;
  const renderHeight = grid.config.renderHeight;

  return (
    <div className="canvas-shell">
      <Pixi
        canvasRef={canvasRef}
        canvasAttrs={{
          className: isPickingConnectorEndpoint ? "grid-canvas grid-canvas-picking" : "grid-canvas",
          role: "img",
          "aria-label": "Component builder canvas",
          onPointerDown: (event) => {
            const canvas = event.currentTarget;

            const instances = useAppStore.getState().instances;
            const point = getCanvasPoint(canvas, event.clientX, event.clientY, logicalWidth, logicalHeight);
            if (useAppStore.getState().connectorEndpointPick !== null) {
              event.preventDefault();
              skipNextClickSelectionSyncRef.current = true;
              setConnectorEndpointCell(point.x, point.y);
              return;
            }

            skipNextClickSelectionSyncRef.current = false;

            const hitInstance = hitTestComponentInstances(instances, point.x, point.y, {
              width: logicalWidth,
              height: logicalHeight,
            });

            if (!hitInstance) {
              selectInstance(null);
              return;
            }

            event.preventDefault();
            selectInstance(hitInstance.id);
            onUserSelectedInstance?.(hitInstance.id);
            if (hitInstance.type === "connector-line") {
              return;
            }

            canvas.setPointerCapture(event.pointerId);
            startMoveDrag(hitInstance.id, point.x - hitInstance.x, point.y - hitInstance.y);
          },
          onPointerMove: (event) => {
            const canvas = event.currentTarget;
            if (useAppStore.getState().connectorEndpointPick !== null) {
              const point = getCanvasPoint(canvas, event.clientX, event.clientY, logicalWidth, logicalHeight);
              setConnectorEndpointHoverCell(point.x, point.y);
              return;
            }

            const dragState = useAppStore.getState().dragState;
            if (dragState === null || dragState.mode === "create") {
              return;
            }

            const point = getCanvasPoint(canvas, event.clientX, event.clientY, logicalWidth, logicalHeight);
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
          onPointerLeave: () => {
            clearConnectorEndpointHoverCell();
          },
          onClick: (event) => {
            if (useAppStore.getState().dragState !== null) {
              return;
            }

            if (skipNextClickSelectionSyncRef.current) {
              skipNextClickSelectionSyncRef.current = false;
              return;
            }

            const canvas = event.currentTarget as HTMLCanvasElement;
            const instances = useAppStore.getState().instances;
            const point = getCanvasPoint(canvas, event.clientX, event.clientY, logicalWidth, logicalHeight);
            const hitId =
              hitTestComponentInstances(instances, point.x, point.y, {
                width: logicalWidth,
                height: logicalHeight,
              })?.id ?? null;
            selectInstance(hitId);
            if (hitId) {
              onUserSelectedInstance?.(hitId);
            }
          },
        }}
        layoutWidth={renderWidth}
        layoutHeight={renderHeight}
        onPreload={preloadIconBoxTitleFont}
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
