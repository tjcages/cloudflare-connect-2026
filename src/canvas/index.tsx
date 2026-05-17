import { useEffect, useLayoutEffect, useRef, useState, type Ref } from "react";
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
import { clampCanvasZoom, zoomAroundCanvasPoint } from "./viewZoom";

const tickers = [setupGridLayer, setupComponentLayer, setupSelectionLayer];

/** Exponential ⌘/Ctrl-wheel sensitivity (trackpad pinch); higher → faster, closer to browser/map zoom. */
const CANVAS_ZOOM_WHEEL_EXP_SENSITIVITY = 0.01;

const normalizeWheelDeltaPixels = (event: Pick<WheelEvent, "deltaX" | "deltaY" | "deltaMode">) => {
  let dx = event.deltaX;
  let dy = event.deltaY;
  if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) {
    dx *= 16;
    dy *= 16;
  } else if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
    dx *= 800;
    dy *= 800;
  }
  return { dx, dy };
};

/** Minimum pointer movement (CSS px) before empty-canvas drag counts as viewport pan. */
const VIEWPORT_PAN_DRAG_THRESHOLD_PX = 5;

/** Mouse empty-canvas drag-pan requires Space held; touch/pen keep drag-to-pan without a modifier. */
const isViewportPanChordHeld = (event: { pointerType: string }, spaceHeld: boolean) =>
  event.pointerType !== "mouse" || spaceHeld;

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
  const setCanvasHoveredLayerId = useAppStore((s) => s.setCanvasHoveredLayerId);
  const isPickingConnectorEndpoint = useAppStore((s) => s.connectorEndpointPick !== null);

  /** Primary-button drag on empty canvas with Space held (mouse): pan viewport until pointer up / Space released. */
  const viewportPanSessionRef = useRef(false);
  const viewportPanDraggingRef = useRef(false);
  const viewportPanPointerIdRef = useRef<number | null>(null);
  const viewportPanCanvasElRef = useRef<HTMLCanvasElement | null>(null);
  const spaceBarViewportPanRef = useRef(false);
  const viewportPanOriginClientRef = useRef({ x: 0, y: 0 });
  const panLastClientRef = useRef({ x: 0, y: 0 });
  const [isViewportPanning, setIsViewportPanning] = useState(false);
  const [isSpaceViewportPanHeld, setIsSpaceViewportPanHeld] = useState(false);

  /** Auto-pan the canvas viewport while dragging a layer near `.canvas-panel-scroll` edges. */
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

      useAppStore.getState().translateCanvasPan(-step.scrollDx, -step.scrollDy);

      const point = getCanvasPoint(canvasEl, last.x, last.y, gridCfg.logicalWidth, gridCfg.logicalHeight);
      useAppStore.getState().moveInstanceTo(ds.id, point.x - ds.offsetX, point.y - ds.offsetY);

      const still = getCanvasPanelEdgeScrollStep(panel.getBoundingClientRect(), last.x, last.y);
      if (still.scrollDx !== 0 || still.scrollDy !== 0) {
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
    viewportPanCanvasElRef.current = null;
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

  const finishViewportPanPointerRef = useRef(finishViewportPanPointer);
  useLayoutEffect(() => {
    finishViewportPanPointerRef.current = finishViewportPanPointer;
  });

  useEffect(() => {
    const isEditableKeyboardTarget = (target: EventTarget | null) =>
      target instanceof Element && target.closest("input, textarea, select, [contenteditable='true']") !== null;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== " " && event.code !== "Space") {
        return;
      }
      if (event.repeat || isEditableKeyboardTarget(event.target)) {
        return;
      }
      spaceBarViewportPanRef.current = true;
      setIsSpaceViewportPanHeld(true);
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key !== " " && event.code !== "Space") {
        return;
      }
      spaceBarViewportPanRef.current = false;
      setIsSpaceViewportPanHeld(false);

      const ptrId = viewportPanPointerIdRef.current;
      const canvasEl = viewportPanCanvasElRef.current;
      if (viewportPanSessionRef.current && ptrId !== null && canvasEl) {
        finishViewportPanPointerRef.current(canvasEl, ptrId);
      }
    };

    const clearSpaceHeld = () => {
      spaceBarViewportPanRef.current = false;
      setIsSpaceViewportPanHeld(false);
      const ptrId = viewportPanPointerIdRef.current;
      const canvasEl = viewportPanCanvasElRef.current;
      if (viewportPanSessionRef.current && ptrId !== null && canvasEl) {
        finishViewportPanPointerRef.current(canvasEl, ptrId);
      }
    };

    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("keyup", onKeyUp, true);
    window.addEventListener("blur", clearSpaceHeld);

    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("keyup", onKeyUp, true);
      window.removeEventListener("blur", clearSpaceHeld);
      spaceBarViewportPanRef.current = false;
      setIsSpaceViewportPanHeld(false);
    };
  }, []);

  const canvasShellClass = [
    "canvas-shell",
    isViewportPanning ? "canvas-shell-panning" : "",
    isSpaceViewportPanHeld ? "canvas-shell-space-pan" : "",
  ]
    .filter(Boolean)
    .join(" ");

  /** Inline cursor so it wins over any other stylesheet rules on the canvas. */
  const canvasCursorStyle =
    !isPickingConnectorEndpoint && isViewportPanning
      ? ({ cursor: "grabbing" } as const)
      : !isPickingConnectorEndpoint && isSpaceViewportPanHeld
        ? ({ cursor: "grab" } as const)
        : null;

  return (
    <div
      className={canvasShellClass}
      style={{
        transform: `translate(${canvasPan.x}px, ${canvasPan.y}px) scale(${canvasZoom})`,
        transformOrigin: "0 0",
      }}
    >
      <Pixi
        canvasRef={canvasRef}
        canvasAttrs={{
          className: isPickingConnectorEndpoint ? "grid-canvas grid-canvas-picking" : "grid-canvas",
          "data-testid": "builder-canvas",
          style: canvasCursorStyle ?? undefined,
          onWheel: (event) => {
            event.preventDefault();

            const canvas = event.currentTarget;

            if (event.metaKey || event.ctrlKey) {
              const { dy } = normalizeWheelDeltaPixels(event);
              const factor = Math.exp(-dy * CANVAS_ZOOM_WHEEL_EXP_SENSITIVITY);
              const { canvasZoom: z0, canvasPan: pan } = useAppStore.getState();
              const rect = canvas.getBoundingClientRect();
              const { zoom: z1, pan: nextPan } = zoomAroundCanvasPoint({
                clientX: event.clientX,
                clientY: event.clientY,
                rect,
                z0,
                z1: clampCanvasZoom(z0 * factor),
                pan,
              });
              if (z1 === z0) {
                return;
              }
              useAppStore.setState({ canvasZoom: z1, canvasPan: nextPan });
              return;
            }

            const { dx, dy } = normalizeWheelDeltaPixels(event);
            if (dx === 0 && dy === 0) {
              return;
            }
            translateCanvasPan(-dx, -dy);
          },
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

              if (!isViewportPanChordHeld(event, spaceBarViewportPanRef.current)) {
                skipNextClickSelectionSyncRef.current = false;
                return;
              }

              skipNextClickSelectionSyncRef.current = true;

              setCanvasHoveredLayerId(null);
              viewportPanSessionRef.current = true;
              viewportPanDraggingRef.current = false;
              viewportPanPointerIdRef.current = event.pointerId;
              viewportPanCanvasElRef.current = canvas;
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
              if (!isViewportPanChordHeld(event, spaceBarViewportPanRef.current)) {
                finishViewportPanPointer(canvas, event.pointerId);
                return;
              }

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
            if (dragState === null) {
              const instances = useAppStore.getState().instances;
              const point = getCanvasPoint(canvas, event.clientX, event.clientY, logicalWidth, logicalHeight);
              const hit = hitTestComponentInstances(instances, point.x, point.y, {
                width: logicalWidth,
                height: logicalHeight,
              });
              const nextId = hit?.id ?? null;
              if (nextId !== useAppStore.getState().canvasHoveredLayerId) {
                setCanvasHoveredLayerId(nextId);
              }
            }

            if (dragState === null || dragState.mode === "create") {
              return;
            }

            if (dragState.mode === "move") {
              lastMoveDragPointerRef.current = { x: event.clientX, y: event.clientY };
              moveDragCanvasRef.current = canvas;
              const viewport = canvas.closest(".canvas-panel-scroll");
              moveDragPanelRef.current = viewport instanceof HTMLElement ? viewport : null;

              if (moveDragPanelRef.current) {
                const step = getCanvasPanelEdgeScrollStep(
                  moveDragPanelRef.current.getBoundingClientRect(),
                  event.clientX,
                  event.clientY,
                );
                if (step.scrollDx !== 0 || step.scrollDy !== 0) {
                  translateCanvasPan(-step.scrollDx, -step.scrollDy);
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
            setCanvasHoveredLayerId(null);
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
