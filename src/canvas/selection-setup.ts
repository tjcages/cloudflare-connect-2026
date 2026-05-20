import { Graphics } from "pixi.js";
import type { Ticker } from "../components/pixi";
import { LARGE_CELL_SIZE } from "../grid/types";
import type { ComponentInstance } from "../grid/types";
import { getInstanceHighlightBounds } from "../lib/componentRegistry";
import { isIconBoxComponentType } from "../lib/icon-box/layout";
import { useAppStore } from "../store";
import type { ConnectorEndpointPickState } from "../types/document";
import {
  buildHoveredConnectorIds,
  collectConnectorLayerEndpointInstances,
  collectLinkedLayersForConnectors,
} from "./connectorLinkedLayerHighlights";
import { CONNECTOR_HIGHLIGHT_COLOR, LAYER_HIGHLIGHT_HOVER_ALPHA } from "./components/constants";

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

const drawInstanceHighlightRect = (graphics: Graphics, inst: ComponentInstance, strokeAlpha = 1) => {
  if (inst.type === "connector-line") {
    return;
  }
  const b = getInstanceHighlightBounds(inst);
  let w = b.width;
  let h = b.height;
  if (isIconBoxComponentType(inst.type) || inst.type === "plus-marker") {
    w += 1;
    h += 1;
  }
  const sw = w - 1;
  const sh = h - 1;
  graphics
    .rect(b.x + 0.5, b.y + 0.5, sw, sh)
    .stroke({ width: 1, color: CONNECTOR_HIGHLIGHT_COLOR, alpha: strokeAlpha });
};

export const setupSelectionLayer: Ticker = ({ app, cleanup }) => {
  const graphics = new Graphics();
  app.stage.addChild(graphics);

  const sync = () => {
    graphics.clear();

    let hasHighlight = false;

    const { selectedInstanceId, instances, connectorEndpointPick, sidebarHoveredLayerId, canvasHoveredLayerId } =
      useAppStore.getState();

    const selectedInst =
      selectedInstanceId === null ? null : (instances.find((i) => i.id === selectedInstanceId) ?? null);
    const selectedLinkedLayers =
      selectedInst?.type === "connector-line" ? collectConnectorLayerEndpointInstances(selectedInst, instances) : [];
    const selectedLinkedIds = new Set(selectedLinkedLayers.map((l) => l.id));

    const hoveredConnectorIds = buildHoveredConnectorIds(instances, canvasHoveredLayerId, sidebarHoveredLayerId);
    const hoveredConnectorLinkedLayers = collectLinkedLayersForConnectors(hoveredConnectorIds, instances).filter(
      (l) => !selectedLinkedIds.has(l.id),
    );
    const hoveredConnectorLinkedIds = new Set(hoveredConnectorLinkedLayers.map((l) => l.id));

    const connectorSelectionCells = getConnectorSelectionCellPoints(
      selectedInstanceId,
      instances,
      connectorEndpointPick,
    );
    for (const point of connectorSelectionCells) {
      drawCellHighlight(graphics, point);
      hasHighlight = true;
    }

    for (const linked of hoveredConnectorLinkedLayers) {
      drawInstanceHighlightRect(graphics, linked, LAYER_HIGHLIGHT_HOVER_ALPHA);
      hasHighlight = true;
    }

    const hoverHighlightIds = new Set<string>();
    if (sidebarHoveredLayerId && sidebarHoveredLayerId !== selectedInstanceId) {
      hoverHighlightIds.add(sidebarHoveredLayerId);
    }
    if (canvasHoveredLayerId && canvasHoveredLayerId !== selectedInstanceId) {
      hoverHighlightIds.add(canvasHoveredLayerId);
    }
    for (const hoverId of hoverHighlightIds) {
      if (selectedLinkedIds.has(hoverId)) {
        continue;
      }
      if (hoveredConnectorLinkedIds.has(hoverId)) {
        continue;
      }
      const hoveredLayer = instances.find((i) => i.id === hoverId);
      if (!hoveredLayer) {
        continue;
      }
      drawInstanceHighlightRect(graphics, hoveredLayer, LAYER_HIGHLIGHT_HOVER_ALPHA);
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
    } else {
      for (const linked of selectedLinkedLayers) {
        drawInstanceHighlightRect(graphics, linked);
        hasHighlight = true;
      }
    }

    graphics.visible = hasHighlight;
  };

  sync();

  const unsub = useAppStore.subscribe((state, prev) => {
    if (
      state.selectedInstanceId !== prev.selectedInstanceId ||
      state.instances !== prev.instances ||
      state.connectorEndpointPick !== prev.connectorEndpointPick ||
      state.sidebarHoveredLayerId !== prev.sidebarHoveredLayerId ||
      state.canvasHoveredLayerId !== prev.canvasHoveredLayerId
    ) {
      sync();
    }
  });

  cleanup(() => {
    unsub();
    graphics.destroy(true);
  });
};
