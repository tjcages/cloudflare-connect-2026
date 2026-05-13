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

      drawDocument(context, { grid, instances, selectedInstanceId, scale: pixelRatio });
    } catch {
      // jsdom does not implement canvas; production browsers do.
    }
  }, [grid, instances, selectedInstanceId]);

  return (
    <div className="canvas-shell">
      <canvas
        ref={canvasRef}
        className="grid-canvas"
        role="img"
        aria-label="Component builder canvas"
        onClick={(event) => {
          const canvas = canvasRef.current;
          if (!canvas) {
            return;
          }
          const point = getCanvasPoint(canvas, event.clientX, event.clientY, grid);
          onSelectInstance(hitTestComponentInstances(instances, point.x, point.y)?.id ?? null);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          const canvas = canvasRef.current;
          const type = event.dataTransfer.getData("application/x-component-type") || event.dataTransfer.getData("text/plain");
          if (!canvas || type !== "icon-box") {
            return;
          }
          const point = getCanvasPoint(canvas, event.clientX, event.clientY, grid);
          onCreateInstance(type, point.x, point.y);
        }}
      />
    </div>
  );
};
