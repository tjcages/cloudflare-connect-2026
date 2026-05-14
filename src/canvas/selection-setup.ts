import { Graphics } from "pixi.js";
import type { Ticker } from "../components/pixi";
import { LARGE_CELL_SIZE } from "../grid/types";
import type { ComponentInstance } from "../grid/types";
import { getInstanceHighlightBounds } from "../lib/componentRegistry";
import { useAppStore } from "../store";
import type { ConnectorEndpointPickState } from "../types/document";
import { CONNECTOR_HIGHLIGHT_COLOR } from "./components/constants";

const drawCellHighlight = (graphics: Graphics, point: { x: number; y: number }) => {
  graphics
    .rect(point.x - LARGE_CELL_SIZE / 2 + 0.5, point.y - LARGE_CELL_SIZE / 2 + 0.5, LARGE_CELL_SIZE, LARGE_CELL_SIZE)
    .stroke({ width: 1, color: CONNECTOR_HIGHLIGHT_COLOR });
};

export const getConnectorSelectionCellPoints = (
  _selectedInstanceId: string | null,
  _instances: ComponentInstance[],
  connectorEndpointPick: ConnectorEndpointPickState | null,
): { x: number; y: number }[] => {
  const points: { x: number; y: number }[] = [];
  if (connectorEndpointPick?.hoverCell) {
    points.push(connectorEndpointPick.hoverCell);
  }

  return points;
};

export const setupSelectionLayer: Ticker = ({ app, cleanup }) => {
  const graphics = new Graphics();
  app.stage.addChild(graphics);

  const sync = () => {
    graphics.clear();

    const { selectedInstanceId, instances, connectorEndpointPick } = useAppStore.getState();
    const connectorSelectionCells = getConnectorSelectionCellPoints(
      selectedInstanceId,
      instances,
      connectorEndpointPick,
    );
    for (const point of connectorSelectionCells) {
      drawCellHighlight(graphics, point);
    }

    if (selectedInstanceId === null) {
      return;
    }

    const inst = instances.find((i) => i.id === selectedInstanceId);
    if (!inst) {
      return;
    }

    if (inst.type === "connector-line") {
      return;
    }

    const b = getInstanceHighlightBounds(inst);
    let w = b.width;
    let h = b.height;
    /** Icon-box: selection stroke +1px wider/taller; origin unchanged from bounds. */
    if (inst.type === "icon-box") {
      w += 1;
      h += 1;
    }
    graphics.rect(b.x + 0.5, b.y + 0.5, w - 1, h - 1).stroke({ width: 1, color: CONNECTOR_HIGHLIGHT_COLOR });
  };

  sync();

  const unsub = useAppStore.subscribe((state, prev) => {
    if (
      state.selectedInstanceId !== prev.selectedInstanceId ||
      state.instances !== prev.instances ||
      state.connectorEndpointPick !== prev.connectorEndpointPick
    ) {
      sync();
    }
  });

  cleanup(() => {
    unsub();
    graphics.destroy(true);
  });
};
