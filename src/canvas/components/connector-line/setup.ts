import { animate, motionValue } from "motion";
import { Container, Graphics } from "pixi.js";
import { LARGE_CELL_SIZE, type ComponentInstance } from "../../../grid/types";
import { CONNECTOR_HIGHLIGHT_COLOR } from "../constants";
import { getPolylineMetrics, slicePolylineByDistance } from "./pathMotion";
import {
  getConnectorCornerPoints,
  getConnectorSegmentCells,
  resolveConnectorEndpoint,
  routeConnectorPath,
} from "./route";
import { getConnectorEndpointThemeSignature, resolveConnectorEndpointThemeFill } from "./sourceTheme";
import { connectorLegPlateauEase } from "./legPlateauEase";

const CONNECTOR_UNDER_STROKE_WIDTH = 9;
const CONNECTOR_STROKE_WIDTH = 1;
const CONNECTOR_CORNER_SIZE = 6;
const CONNECTOR_CORNER_RADIUS = 1;

const CONNECTOR_ANIM_SEGMENT_PX = 60;
const CONNECTOR_ANIM_HALF_PX = CONNECTOR_ANIM_SEGMENT_PX / 2;
const CONNECTOR_ANIM_STROKE_WIDTH = 1;
/** One timing "slice": 100px of path length (see `CONNECTOR_ANIM_SEC_PER_SLICE`). */
const CONNECTOR_ANIM_SLICE_PX = 100;
/** Duration multiplier: one-way leg duration = `0.2s × (pathLength / slicePx)`. */
const CONNECTOR_ANIM_SEC_PER_SLICE = 0.2;
/** Only guards sub-frame / zero durations; leg time scales with path length so arc-length speed stays ~constant. */
const CONNECTOR_ANIM_MIN_LEG_SEC = 1 / 60;

export type ConnectorRenderSpec = {
  segmentFrameColor: number;
  endpointFrameColor: number;
  lineColor: number;
  cornerStrokeColor: number;
  structuralDrawOrder: ["segmentFrames", "endpointFrames"];
  chromeDrawOrder: ["lineUnderlay", "line", "connectorWave", "corners"];
};

export const getConnectorRenderSpec = (selected: boolean, gridStrokeColor: number): ConnectorRenderSpec => {
  const highlightColor = selected ? CONNECTOR_HIGHLIGHT_COLOR : gridStrokeColor;
  return {
    segmentFrameColor: gridStrokeColor,
    endpointFrameColor: highlightColor,
    lineColor: highlightColor,
    cornerStrokeColor: highlightColor,
    structuralDrawOrder: ["segmentFrames", "endpointFrames"],
    chromeDrawOrder: ["lineUnderlay", "line", "connectorWave", "corners"],
  };
};

export type ConnectorDisplayParts = {
  structureRoot: Container;
  chromeRoot: Container;
  /** Stop Motion `animate` + motion value listeners when the layer is torn down. */
  disposeConnectorAnimation?: () => void;
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

export const getConnectorRenderFingerprint = (
  instance: Extract<ComponentInstance, { type: "connector-line" }>,
  instances: ComponentInstance[],
  gridStrokeColor: number,
  bounds: { width: number; height: number },
  selected: boolean,
  connectorAnimationEnabled: boolean,
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
    animated: instance.props.animated,
    connectorAnimationEnabled,
    sourceTheme: getConnectorEndpointThemeSignature(instance.props.source, instances),
    targetTheme: getConnectorEndpointThemeSignature(instance.props.target, instances),
  });
};

export const buildConnectorLine = (
  instance: Extract<ComponentInstance, { type: "connector-line" }>,
  instances: ComponentInstance[],
  gridStrokeColor: number,
  gridStrokeHex: string,
  bounds?: { width: number; height: number },
  selected = false,
  connectorAnimationEnabled = true,
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

  const metrics = getPolylineMetrics(points);
  const cornerPoints = getConnectorCornerPoints(points);
  const cornerArcDistances = cornerPoints.map((cp) => {
    const i = points.findIndex((p) => p.x === cp.x && p.y === cp.y);
    return i >= 0 ? metrics.distToVertex[i]! : 0;
  });

  const corners = new Graphics();
  let disposeConnectorAnimation: (() => void) | undefined;

  const drawStaticCornerCaps = () => {
    corners.clear();
    for (const point of cornerPoints) {
      const rect = getConnectorCornerCapRect(point);
      corners
        .roundRect(rect.x, rect.y, rect.size, rect.size, rect.radius)
        .fill({ color: 0xffffff })
        .stroke({ width: CONNECTOR_STROKE_WIDTH, color: renderSpec.cornerStrokeColor });
    }
  };

  if (connectorAnimationEnabled && instance.props.animated && metrics.totalLength > 0) {
    const maskShape = new Graphics();
    drawPolyline(maskShape, points);
    maskShape.stroke({ width: CONNECTOR_UNDER_STROKE_WIDTH, color: 0xffffff });

    const waveHolder = new Container();
    const waveStroke = new Graphics();
    waveHolder.mask = maskShape;
    chromeRoot.addChild(maskShape);
    chromeRoot.addChild(waveHolder);
    waveHolder.addChild(waveStroke);

    const drawAnimatedCornerCaps = (centerDist: number, waveFill: number) => {
      corners.clear();
      for (let i = 0; i < cornerPoints.length; i += 1) {
        const point = cornerPoints[i]!;
        const arc = cornerArcDistances[i]!;
        const lit = arc >= centerDist - CONNECTOR_ANIM_HALF_PX && arc <= centerDist + CONNECTOR_ANIM_HALF_PX;
        const rect = getConnectorCornerCapRect(point);
        corners
          .roundRect(rect.x, rect.y, rect.size, rect.size, rect.radius)
          .fill({ color: 0xffffff })
          .stroke({ width: CONNECTOR_STROKE_WIDTH, color: lit ? waveFill : renderSpec.cornerStrokeColor });
      }
    };

    const slice = metrics.totalLength;
    const legDurationSec = Math.max(
      CONNECTOR_ANIM_MIN_LEG_SEC,
      CONNECTOR_ANIM_SEC_PER_SLICE * (slice / CONNECTOR_ANIM_SLICE_PX),
    );

    const progressAlongPath = motionValue(0);
    type LegPhase = "forward" | "backward";
    let legPhase: LegPhase = "forward";

    const activeFill = () =>
      legPhase === "forward"
        ? resolveConnectorEndpointThemeFill(instance.props.source, instances, gridStrokeHex)
        : resolveConnectorEndpointThemeFill(instance.props.target, instances, gridStrokeHex);

    const renderPulse = (centerDist: number) => {
      const waveFill = activeFill();
      waveStroke.clear();
      const waveSlice = slicePolylineByDistance(
        points,
        metrics,
        centerDist - CONNECTOR_ANIM_HALF_PX,
        centerDist + CONNECTOR_ANIM_HALF_PX,
      );
      if (waveSlice.length >= 2) {
        drawPolyline(waveStroke, waveSlice);
        waveStroke.stroke({ width: CONNECTOR_ANIM_STROKE_WIDTH, color: waveFill });
      }
      drawAnimatedCornerCaps(centerDist, waveFill);
    };

    const unsub = progressAlongPath.on("change", renderPulse);
    renderPulse(progressAlongPath.get());

    let cancelled = false;
    let activeControls: ReturnType<typeof animate> | null = null;

    const runLoop = async () => {
      while (!cancelled) {
        legPhase = "forward";
        progressAlongPath.set(0);
        activeControls = animate(progressAlongPath, slice, {
          duration: legDurationSec,
          ease: connectorLegPlateauEase,
        });
        await activeControls.finished;
        activeControls = null;
        if (cancelled) {
          break;
        }
        legPhase = "backward";
        activeControls = animate(progressAlongPath, 0, {
          duration: legDurationSec,
          ease: connectorLegPlateauEase,
        });
        await activeControls.finished;
        activeControls = null;
      }
    };

    void runLoop();

    disposeConnectorAnimation = () => {
      cancelled = true;
      activeControls?.stop();
      unsub();
    };
  } else {
    drawStaticCornerCaps();
  }

  chromeRoot.addChild(corners);

  return { structureRoot, chromeRoot, disposeConnectorAnimation };
};
