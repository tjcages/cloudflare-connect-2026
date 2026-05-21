import type { ComponentInstance, ComponentType, IconBoxDirection } from "../grid/types";
import type { IconBoxContainerReticleCorner } from "../lib/icon-box/layout";

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
    }
  | {
      mode: "resize";
      componentKind: "icon-box";
      id: string;
      draggedCorner: IconBoxContainerReticleCorner;
      fixedCornerCanvas: { x: number; y: number };
      /** Layout direction locked for the whole drag (prevents axis flip / layer tilt). */
      startDirection: IconBoxDirection;
      startRootX: number;
      startRootY: number;
    }
  | {
      mode: "resize";
      componentKind: "code-snippet";
      id: string;
      draggedCorner: IconBoxContainerReticleCorner;
      fixedCornerCanvas: { x: number; y: number };
    };

export type ConnectorEndpointPickState = {
  connectorId: string;
  endpoint: "source" | "target";
  hoverCell: { x: number; y: number } | null;
};
