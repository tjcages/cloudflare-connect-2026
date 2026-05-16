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

const drawInstanceHighlightRect = (graphics: Graphics, inst: ComponentInstance) => {
  if (inst.type === "connector-line") {
    return;
  }
  const b = getInstanceHighlightBounds(inst);
  let w = b.width;
  let h = b.height;
  if (inst.type === "icon-box" || inst.type === "icon-box-2x1" || inst.type === "plus-marker") {
    w += 1;
    h += 1;
  }
  graphics.rect(b.x + 0.5, b.y + 0.5, w - 1, h - 1).stroke({ width: 1, color: CONNECTOR_HIGHLIGHT_COLOR });
};

export const setupSelectionLayer: Ticker = ({ app, cleanup }) => {
  const graphics = new Graphics();
  app.stage.addChild(graphics);

  const sync = () => {
    graphics.clear();

    let hasHighlight = false;

    const { selectedInstanceId, instances, connectorEndpointPick, sidebarHoveredLayerId } = useAppStore.getState();
    const connectorSelectionCells = getConnectorSelectionCellPoints(
      selectedInstanceId,
      instances,
      connectorEndpointPick,
    );
    for (const point of connectorSelectionCells) {
      drawCellHighlight(graphics, point);
      hasHighlight = true;
    }

    const hoveredSidebarLayer = sidebarHoveredLayerId
      ? instances.find((i) => i.id === sidebarHoveredLayerId)
      : undefined;
    if (hoveredSidebarLayer && hoveredSidebarLayer.id !== selectedInstanceId) {
      drawInstanceHighlightRect(graphics, hoveredSidebarLayer);
      hasHighlight = true;
    }

    if (selectedInstanceId === null) {
      graphics.visible = hasHighlight;
      return;
    }

    const inst = instances.find((i) => i.id === selectedInstanceId);
    if (!inst) {
      graphics.visible = hasHighlight;
      return;
    }

    if (inst.type !== "connector-line") {
      drawInstanceHighlightRect(graphics, inst);
      hasHighlight = true;
    }

    graphics.visible = hasHighlight;
  };

  sync();

  const unsub = useAppStore.subscribe((state, prev) => {
    if (
      state.selectedInstanceId !== prev.selectedInstanceId ||
      state.instances !== prev.instances ||
      state.connectorEndpointPick !== prev.connectorEndpointPick ||
      state.sidebarHoveredLayerId !== prev.sidebarHoveredLayerId
    ) {
      sync();
    }
  });

  cleanup(() => {
    unsub();
    graphics.destroy(true);
  });
};
