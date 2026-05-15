import { Container, Graphics } from "pixi.js";
import { LARGE_CELL_SIZE, type ComponentInstance } from "../../../grid/types";
import { CONNECTOR_HIGHLIGHT_COLOR } from "../constants";
import {
  getConnectorCornerPoints,
  getConnectorSegmentCells,
  resolveConnectorEndpoint,
  routeConnectorPath,
} from "./route";

const CONNECTOR_UNDER_STROKE_WIDTH = 9;
const CONNECTOR_STROKE_WIDTH = 1;
const CONNECTOR_CORNER_SIZE = 6;
const CONNECTOR_CORNER_RADIUS = 1;

export type ConnectorRenderSpec = {
  segmentFrameColor: number;
  endpointFrameColor: number;
  lineColor: number;
  cornerStrokeColor: number;
  /** Large-cell strokes (optional white fill when `props.overlayGrid`). Same plane as grid lines. */
  structuralDrawOrder: ["segmentFrames", "endpointFrames"];
  /** White underlay + line sit above structural layer so they mask grid + segment/endpoint strokes + icon-box outer frame. */
  chromeDrawOrder: ["lineUnderlay", "line", "corners"];
};

export const getConnectorRenderSpec = (selected: boolean, gridStrokeColor: number): ConnectorRenderSpec => {
  const highlightColor = selected ? CONNECTOR_HIGHLIGHT_COLOR : gridStrokeColor;
  return {
    segmentFrameColor: gridStrokeColor,
    endpointFrameColor: highlightColor,
    lineColor: highlightColor,
    cornerStrokeColor: highlightColor,
    structuralDrawOrder: ["segmentFrames", "endpointFrames"],
    chromeDrawOrder: ["lineUnderlay", "line", "corners"],
  };
};

export type ConnectorDisplayParts = {
  structureRoot: Container;
  chromeRoot: Container;
};

export const getConnectorCornerCapRect = (point: { x: number; y: number }) => ({
  x: point.x - CONNECTOR_CORNER_SIZE / 2,
  y: point.y - CONNECTOR_CORNER_SIZE / 2,
  size: CONNECTOR_CORNER_SIZE,
  radius: CONNECTOR_CORNER_RADIUS,
});

const drawPolyline = (graphics: Graphics, points: { x: number; y: number }[]) => {
  const [first, ...rest] = points;
  graphics.moveTo(first.x, first.y);
  for (const point of rest) {
    graphics.lineTo(point.x, point.y);
  }
};

/** Stable key for incremental connector redraws; changes when routing inputs change. */
export const getConnectorRenderFingerprint = (
  instance: Extract<ComponentInstance, { type: "connector-line" }>,
  instances: ComponentInstance[],
  gridStrokeColor: number,
  bounds: { width: number; height: number },
  selected: boolean,
): string | null => {
  const source = resolveConnectorEndpoint(instance.props.source, instances);
  const target = resolveConnectorEndpoint(instance.props.target, instances);
  if (!source || !target) {
    return null;
  }

  return JSON.stringify({
    preferredConnection: instance.props.preferredConnection,
    source: instance.props.source,
    target: instance.props.target,
    sx: source.x,
    sy: source.y,
    tx: target.x,
    ty: target.y,
    gridStrokeColor,
    bounds,
    selected,
    overlayGrid: instance.props.overlayGrid,
  });
};

export const buildConnectorLine = (
  instance: Extract<ComponentInstance, { type: "connector-line" }>,
  instances: ComponentInstance[],
  gridStrokeColor: number,
  bounds?: { width: number; height: number },
  selected = false,
): ConnectorDisplayParts | null => {
  const source = resolveConnectorEndpoint(instance.props.source, instances);
  const target = resolveConnectorEndpoint(instance.props.target, instances);
  if (!source || !target) {
    return null;
  }

  const points = routeConnectorPath(source, target, instance.props.preferredConnection, bounds);
  const renderSpec = getConnectorRenderSpec(selected, gridStrokeColor);
  const segmentOverlay = instance.props.overlayGrid;
  const structureRoot = new Container();
  const chromeRoot = new Container();

  const segmentFrames = new Graphics();
  for (const cell of getConnectorSegmentCells(points)) {
    if (segmentOverlay) {
      segmentFrames
        .rect(cell.x + 0.5, cell.y + 0.5, LARGE_CELL_SIZE, LARGE_CELL_SIZE)
        .fill({ color: 0xffffff })
        .stroke({
          width: CONNECTOR_STROKE_WIDTH,
          color: renderSpec.segmentFrameColor,
        });
    } else {
      segmentFrames.rect(cell.x + 0.5, cell.y + 0.5, LARGE_CELL_SIZE, LARGE_CELL_SIZE).stroke({
        width: CONNECTOR_STROKE_WIDTH,
        color: renderSpec.segmentFrameColor,
      });
    }
  }
  structureRoot.addChild(segmentFrames);

  if (selected) {
    const endpointFrames = new Graphics();
    for (const point of [source, target]) {
      if (segmentOverlay) {
        endpointFrames
          .rect(
            point.x - LARGE_CELL_SIZE / 2 + 0.5,
            point.y - LARGE_CELL_SIZE / 2 + 0.5,
            LARGE_CELL_SIZE,
            LARGE_CELL_SIZE,
          )
          .fill({ color: 0xffffff })
          .stroke({
            width: CONNECTOR_STROKE_WIDTH,
            color: renderSpec.endpointFrameColor,
          });
      } else {
        endpointFrames
          .rect(
            point.x - LARGE_CELL_SIZE / 2 + 0.5,
            point.y - LARGE_CELL_SIZE / 2 + 0.5,
            LARGE_CELL_SIZE,
            LARGE_CELL_SIZE,
          )
          .stroke({
            width: CONNECTOR_STROKE_WIDTH,
            color: renderSpec.endpointFrameColor,
          });
      }
    }
    structureRoot.addChild(endpointFrames);
  }

  const lineUnderlay = new Graphics();
  drawPolyline(lineUnderlay, points);
  lineUnderlay.stroke({ width: CONNECTOR_UNDER_STROKE_WIDTH, color: 0xffffff });
  chromeRoot.addChild(lineUnderlay);

  const line = new Graphics();
  drawPolyline(line, points);
  line.stroke({ width: CONNECTOR_STROKE_WIDTH, color: renderSpec.lineColor });
  chromeRoot.addChild(line);

  const corners = new Graphics();
  for (const point of getConnectorCornerPoints(points)) {
    const rect = getConnectorCornerCapRect(point);
    corners
      .roundRect(rect.x, rect.y, rect.size, rect.size, rect.radius)
      .fill({ color: 0xffffff })
      .stroke({ width: CONNECTOR_STROKE_WIDTH, color: renderSpec.cornerStrokeColor });
  }
  chromeRoot.addChild(corners);

  return { structureRoot, chromeRoot };
};
