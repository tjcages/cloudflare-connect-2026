import { useEffect, useRef, useState, type Ref } from "react";
import { animate as motionAnimate } from "motion";
import Pixi from "../components/pixi";
import { getCanvasPoint } from "./coords";
import { hitTestComponentInstances } from "./hitTest";
import { getCanvasPanelEdgeScrollStep } from "./scrollAroundEdges";
import { setupComponentLayer } from "./components/componentLayer";
import { setupGridLayer } from "./grid/setup";
import { setupSelectionLayer } from "./selection-setup";
import { preloadIconBoxTitleFont } from "../fonts/iconBoxTitle";
import { useAppStore } from "../store";

const tickers = [setupGridLayer, setupComponentLayer, setupSelectionLayer];

const CANVAS_ZOOM_MIN = 0.25;
const CANVAS_ZOOM_MAX = 4;

const clampCanvasZoom = (z: number) => Math.min(CANVAS_ZOOM_MAX, Math.max(CANVAS_ZOOM_MIN, z));

/** Minimum pointer movement (CSS px) before empty-canvas drag counts as viewport pan. */
const VIEWPORT_PAN_DRAG_THRESHOLD_PX = 5;

type BuilderCanvasProps = {
  canvasRef?: Ref<HTMLCanvasElement | null>;
  onUserSelectedInstance?: (id: string | null) => void;
};

export const GridCanvas = ({ canvasRef, onUserSelectedInstance }: BuilderCanvasProps) => {
  /**
   * `pointerdown` already applies selection; the same gesture still fires `click`.
   * Re-hit-testing on `click` can disagree (drag snap moved the layer, edge pixels, tolerance),
   * which would call `selectInstance(null)` and flash-close the config panel.
   */
  const skipNextClickSelectionSyncRef = useRef(false);

  const grid = useAppStore((s) => s.grid);
  const canvasPan = useAppStore((s) => s.canvasPan);
  const canvasZoom = useAppStore((s) => s.canvasZoom);

  const selectInstance = useAppStore((s) => s.selectInstance);
  const startMoveDrag = useAppStore((s) => s.startMoveDrag);
  const moveInstanceTo = useAppStore((s) => s.moveInstanceTo);
  const endCanvasDrag = useAppStore((s) => s.endCanvasDrag);
  const translateCanvasPan = useAppStore((s) => s.translateCanvasPan);
  const resetCanvasPan = useAppStore((s) => s.resetCanvasPan);
  const resetCanvasZoom = useAppStore((s) => s.resetCanvasZoom);
  const setConnectorEndpointCell = useAppStore((s) => s.setConnectorEndpointCell);
  const setConnectorEndpointHoverCell = useAppStore((s) => s.setConnectorEndpointHoverCell);
  const clearConnectorEndpointHoverCell = useAppStore((s) => s.clearConnectorEndpointHoverCell);
  const isPickingConnectorEndpoint = useAppStore((s) => s.connectorEndpointPick !== null);

  /** Primary-button drag on empty canvas: pan viewport until pointer up. */
  const viewportPanSessionRef = useRef(false);
  const viewportPanDraggingRef = useRef(false);
  const viewportPanPointerIdRef = useRef<number | null>(null);
  const viewportPanOriginClientRef = useRef({ x: 0, y: 0 });
  const panLastClientRef = useRef({ x: 0, y: 0 });
  const [isViewportPanning, setIsViewportPanning] = useState(false);

  /** Auto-scroll `.canvas-panel` while dragging a layer near viewport edges. */
  const moveDragEdgeScrollRafRef = useRef<number | null>(null);
  const lastMoveDragPointerRef = useRef<{ x: number; y: number } | null>(null);
  const moveDragCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const moveDragPanelRef = useRef<HTMLElement | null>(null);
  const runMoveDragEdgeScrollTickRef = useRef<() => void>(() => {});

  const logicalWidth = grid.config.logicalWidth;
  const logicalHeight = grid.config.logicalHeight;
  const renderWidth = grid.config.renderWidth;
  const renderHeight = grid.config.renderHeight;

  useEffect(() => {
    resetCanvasPan();
    resetCanvasZoom();
  }, [renderWidth, renderHeight, resetCanvasPan, resetCanvasZoom]);

  useEffect(() => {
    runMoveDragEdgeScrollTickRef.current = () => {
      moveDragEdgeScrollRafRef.current = null;

      const ds = useAppStore.getState().dragState;
      const canvasEl = moveDragCanvasRef.current;
      const panel = moveDragPanelRef.current;
      const last = lastMoveDragPointerRef.current;

      if (ds?.mode !== "move" || !canvasEl || !panel || !last) {
        return;
      }

      const gridCfg = useAppStore.getState().grid.config;
      const step = getCanvasPanelEdgeScrollStep(panel.getBoundingClientRect(), last.x, last.y);

      if (step.scrollDx === 0 && step.scrollDy === 0) {
        return;
      }

      const prevLeft = panel.scrollLeft;
      const prevTop = panel.scrollTop;
      panel.scrollLeft += step.scrollDx;
      panel.scrollTop += step.scrollDy;
      const scrolled = panel.scrollLeft !== prevLeft || panel.scrollTop !== prevTop;

      const point = getCanvasPoint(canvasEl, last.x, last.y, gridCfg.logicalWidth, gridCfg.logicalHeight);
      useAppStore.getState().moveInstanceTo(ds.id, point.x - ds.offsetX, point.y - ds.offsetY);

      const still = getCanvasPanelEdgeScrollStep(panel.getBoundingClientRect(), last.x, last.y);
      if (scrolled && (still.scrollDx !== 0 || still.scrollDy !== 0)) {
        moveDragEdgeScrollRafRef.current = requestAnimationFrame(() => runMoveDragEdgeScrollTickRef.current());
      }
    };

    return () => {
      if (moveDragEdgeScrollRafRef.current !== null) {
        cancelAnimationFrame(moveDragEdgeScrollRafRef.current);
        moveDragEdgeScrollRafRef.current = null;
      }
    };
  }, []);

  const cancelMoveDragEdgeScrollLoop = () => {
    if (moveDragEdgeScrollRafRef.current !== null) {
      cancelAnimationFrame(moveDragEdgeScrollRafRef.current);
      moveDragEdgeScrollRafRef.current = null;
    }
  };

  const scheduleMoveDragEdgeScrollLoop = () => {
    if (moveDragEdgeScrollRafRef.current !== null) {
      return;
    }
    moveDragEdgeScrollRafRef.current = requestAnimationFrame(() => runMoveDragEdgeScrollTickRef.current());
  };

  const clearViewportPanFlags = () => {
    viewportPanSessionRef.current = false;
    viewportPanDraggingRef.current = false;
    viewportPanPointerIdRef.current = null;
    setIsViewportPanning(false);
  };

  const finishViewportPanPointer = (canvas: HTMLCanvasElement, pointerId: number) => {
    if (viewportPanPointerIdRef.current !== pointerId) {
      return;
    }
    const didPan = viewportPanDraggingRef.current;
    clearViewportPanFlags();
    canvas.releasePointerCapture?.(pointerId);
    if (!didPan) {
      selectInstance(null);
    }
  };

  return (
    <div
      className={isViewportPanning ? "canvas-shell canvas-shell-panning" : "canvas-shell"}
      style={{
        transform: `translate(${canvasPan.x}px, ${canvasPan.y}px) scale(${canvasZoom})`,
        transformOrigin: "0 0",
      }}
      onWheel={(event) => {
        if (!event.metaKey && !event.ctrlKey) {
          return;
        }
        const target = event.target;
        if (!(target instanceof HTMLCanvasElement)) {
          return;
        }

        event.preventDefault();

        let dy = event.deltaY;
        if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) {
          dy *= 16;
        } else if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
          dy *= 800;
        }

        const factor = Math.exp(-dy * 0.0015);
        const { canvasZoom: z0, canvasPan: pan } = useAppStore.getState();
        const z1 = clampCanvasZoom(z0 * factor);
        if (z1 === z0) {
          return;
        }

        const rect = target.getBoundingClientRect();
        const mx = event.clientX;
        const my = event.clientY;
        useAppStore.setState({
          canvasZoom: z1,
          canvasPan: {
            x: mx - rect.left + pan.x - (z1 * (mx - rect.left)) / z0,
            y: my - rect.top + pan.y - (z1 * (my - rect.top)) / z0,
          },
        });
      }}
    >
      <Pixi
        canvasRef={canvasRef}
        canvasAttrs={{
          className: isPickingConnectorEndpoint ? "grid-canvas grid-canvas-picking" : "grid-canvas",
          "data-testid": "builder-canvas",
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
              if (event.pointerType === "mouse" && event.button !== 0) {
                selectInstance(null);
                skipNextClickSelectionSyncRef.current = true;
                return;
              }

              skipNextClickSelectionSyncRef.current = true;

              viewportPanSessionRef.current = true;
              viewportPanDraggingRef.current = false;
              viewportPanPointerIdRef.current = event.pointerId;
              viewportPanOriginClientRef.current = { x: event.clientX, y: event.clientY };
              panLastClientRef.current = { x: event.clientX, y: event.clientY };
              canvas.setPointerCapture?.(event.pointerId);
              return;
            }

            event.preventDefault();
            selectInstance(hitInstance.id);
            onUserSelectedInstance?.(hitInstance.id);
            if (hitInstance.type === "connector-line") {
              skipNextClickSelectionSyncRef.current = true;
              return;
            }

            canvas.setPointerCapture?.(event.pointerId);
            startMoveDrag(hitInstance.id, point.x - hitInstance.x, point.y - hitInstance.y);
            skipNextClickSelectionSyncRef.current = true;
          },
          onPointerMove: (event) => {
            const canvas = event.currentTarget;

            if (
              viewportPanSessionRef.current &&
              viewportPanPointerIdRef.current === event.pointerId &&
              useAppStore.getState().connectorEndpointPick === null
            ) {
              const ox = viewportPanOriginClientRef.current.x;
              const oy = viewportPanOriginClientRef.current.y;

              if (!viewportPanDraggingRef.current) {
                const dist = Math.hypot(event.clientX - ox, event.clientY - oy);
                if (dist < VIEWPORT_PAN_DRAG_THRESHOLD_PX) {
                  return;
                }
                viewportPanDraggingRef.current = true;
                setIsViewportPanning(true);
                panLastClientRef.current = { x: event.clientX, y: event.clientY };
                return;
              }

              event.preventDefault();
              const last = panLastClientRef.current;
              translateCanvasPan(event.clientX - last.x, event.clientY - last.y);
              panLastClientRef.current = { x: event.clientX, y: event.clientY };
              return;
            }

            if (useAppStore.getState().connectorEndpointPick !== null) {
              const point = getCanvasPoint(canvas, event.clientX, event.clientY, logicalWidth, logicalHeight);
              setConnectorEndpointHoverCell(point.x, point.y);
              return;
            }

            const dragState = useAppStore.getState().dragState;
            if (dragState === null || dragState.mode === "create") {
              return;
            }

            if (dragState.mode === "move") {
              lastMoveDragPointerRef.current = { x: event.clientX, y: event.clientY };
              moveDragCanvasRef.current = canvas;
              const panel = canvas.closest(".canvas-panel");
              moveDragPanelRef.current = panel instanceof HTMLElement ? panel : null;

              if (moveDragPanelRef.current) {
                const step = getCanvasPanelEdgeScrollStep(
                  moveDragPanelRef.current.getBoundingClientRect(),
                  event.clientX,
                  event.clientY,
                );
                if (step.scrollDx !== 0 || step.scrollDy !== 0) {
                  moveDragPanelRef.current.scrollLeft += step.scrollDx;
                  moveDragPanelRef.current.scrollTop += step.scrollDy;
                  scheduleMoveDragEdgeScrollLoop();
                } else {
                  cancelMoveDragEdgeScrollLoop();
                }
              }
            }

            const point = getCanvasPoint(canvas, event.clientX, event.clientY, logicalWidth, logicalHeight);
            moveInstanceTo(dragState.id, point.x - dragState.offsetX, point.y - dragState.offsetY);
          },
          onPointerUp: (event) => {
            const canvas = event.currentTarget;
            cancelMoveDragEdgeScrollLoop();

            if (viewportPanPointerIdRef.current === event.pointerId) {
              finishViewportPanPointer(canvas, event.pointerId);
              return;
            }

            const dragState = useAppStore.getState().dragState;
            if (dragState === null || dragState.mode === "create") {
              return;
            }

            canvas.releasePointerCapture?.(event.pointerId);
            endCanvasDrag();
          },
          onPointerCancel: (event) => {
            cancelMoveDragEdgeScrollLoop();
            finishViewportPanPointer(event.currentTarget, event.pointerId);
          },
          onLostPointerCapture: (event) => {
            cancelMoveDragEdgeScrollLoop();
            if (viewportPanPointerIdRef.current !== event.pointerId) {
              return;
            }
            const didPan = viewportPanDraggingRef.current;
            clearViewportPanFlags();
            if (!didPan) {
              selectInstance(null);
            }
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
          app.animate = motionAnimate;
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
