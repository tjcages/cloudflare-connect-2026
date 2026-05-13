import type { ComponentInstance, ComponentType } from "../grid/types";

export type CanvasDragState =
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
    };
