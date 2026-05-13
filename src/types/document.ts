import type { ComponentInstance, ComponentType } from "../grid/types";

export type CanvasDragState =
  | {
      mode: "create";
      type: ComponentType;
      preview: ComponentInstance | null;
      /** Screen position for the DOM ghost before the pointer reaches the canvas. */
      ghostClient: { x: number; y: number } | null;
    }
  | {
      mode: "move";
      id: string;
      offsetX: number;
      offsetY: number;
    };
