import { useEffect, useRef } from "react";
import { drawDocument } from "../canvas/documentRenderer";
import { hitTestComponentInstances } from "../canvas/hitTest";
import type { ComponentInstance, ComponentType, GeneratedGrid } from "../grid/types";

type GridCanvasProps = {
  grid: GeneratedGrid;
  instances: ComponentInstance[];
  selectedInstanceId: string | null;
  onSelectInstance: (id: string | null) => void;
  onCreateInstance: (type: ComponentType, x: number, y: number) => void;
  dragState:
    | {
        mode: "create";
        type: ComponentType;
        preview: ComponentInstance | null;
      }
    | {
        mode: "move";
        id: string;
        offsetX: number;
        offsetY: number;
      }
    | null;
  dragPreviewInstance: ComponentInstance | null;
  onUpdateComponentDragPreview: (type: ComponentType, x: number, y: number) => void;
  onStartInstanceDrag: (id: string, offsetX: number, offsetY: number) => void;
  onMoveInstance: (id: string, x: number, y: number) => void;
  onEndCanvasDrag: () => void;
};

const getCanvasPoint = (canvas: HTMLCanvasElement, clientX: number, clientY: number, grid: GeneratedGrid) => {
  const bounds = canvas.getBoundingClientRect();
  const scaleX = grid.config.logicalWidth / bounds.width;
  const scaleY = grid.config.logicalHeight / bounds.height;

  return {
    x: (clientX - bounds.left) * scaleX,
    y: (clientY - bounds.top) * scaleY,
  };
};

export const GridCanvas = ({
  grid,
  instances,
  selectedInstanceId,
  onSelectInstance,
  onCreateInstance,
  dragState,
  dragPreviewInstance,
  onUpdateComponentDragPreview,
  onStartInstanceDrag,
  onMoveInstance,
  onEndCanvasDrag,
}: GridCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const pixelRatio = window.devicePixelRatio || 1;
    canvas.width = grid.config.logicalWidth * pixelRatio;
    canvas.height = grid.config.logicalHeight * pixelRatio;
    canvas.style.width = `${grid.config.logicalWidth}px`;
    canvas.style.height = `${grid.config.logicalHeight}px`;

    try {
      const context = canvas.getContext("2d");
      if (!context) {
        return;
      }

      drawDocument(context, {
        grid,
        instances: dragPreviewInstance ? [...instances, dragPreviewInstance] : instances,
        selectedInstanceId,
        scale: pixelRatio,
      });
    } catch {
      // jsdom does not implement canvas; production browsers do.
    }
  }, [grid, instances, selectedInstanceId, dragPreviewInstance]);

  return (
    <div className="canvas-shell">
      <canvas
        ref={canvasRef}
        className="grid-canvas"
        role="img"
        aria-label="Component builder canvas"
        onPointerDown={(event) => {
          const canvas = canvasRef.current;
          if (!canvas) {
            return;
          }
          const point = getCanvasPoint(canvas, event.clientX, event.clientY, grid);
          const hitInstance = hitTestComponentInstances(instances, point.x, point.y);

          if (!hitInstance) {
            onSelectInstance(null);
            return;
          }

          event.preventDefault();
          canvas.setPointerCapture?.(event.pointerId);
          onSelectInstance(hitInstance.id);
          onStartInstanceDrag(hitInstance.id, point.x - hitInstance.x, point.y - hitInstance.y);
        }}
        onPointerMove={(event) => {
          const canvas = canvasRef.current;
          if (!canvas || !dragState) {
            return;
          }

          const point = getCanvasPoint(canvas, event.clientX, event.clientY, grid);
          if (dragState.mode === "create") {
            onUpdateComponentDragPreview(dragState.type, point.x, point.y);
            return;
          }

          onMoveInstance(dragState.id, point.x - dragState.offsetX, point.y - dragState.offsetY);
        }}
        onPointerUp={(event) => {
          const canvas = canvasRef.current;
          if (!canvas || !dragState) {
            return;
          }

          const point = getCanvasPoint(canvas, event.clientX, event.clientY, grid);
          if (dragState.mode === "create") {
            onCreateInstance(dragState.type, point.x, point.y);
          } else {
            canvas.releasePointerCapture?.(event.pointerId);
          }
          onEndCanvasDrag();
        }}
        onClick={(event) => {
          const canvas = canvasRef.current;
          if (dragState) {
            return;
          }
          if (!canvas) {
            return;
          }
          const point = getCanvasPoint(canvas, event.clientX, event.clientY, grid);
          onSelectInstance(hitTestComponentInstances(instances, point.x, point.y)?.id ?? null);
        }}
      />
    </div>
  );
};
