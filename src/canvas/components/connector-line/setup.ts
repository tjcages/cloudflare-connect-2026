import { animate, motionValue } from "motion";
import { Container, Graphics } from "pixi.js";
import type { ParticleContainer, Texture } from "pixi.js";
import { LARGE_CELL_SIZE, type ComponentInstance } from "../../../grid/types";
import { CONNECTOR_HIGHLIGHT_COLOR, LAYER_HIGHLIGHT_HOVER_ALPHA } from "../constants";
import { getPolylineMetrics, arcDistanceToPointOnPolyline, slicePolylineByDistance } from "./pathMotion";
import {
  collectExternalJunctionHints,
  getConnectorCornerPoints,
  getConnectorRouteTopologySignature,
  getForeignCornerOverlapPoints,
  resolveConnectorEndpoint,
  routeConnectorPath,
  getConnectorSegmentCells,
} from "./route";
import { collectIconBoxHitsAlongConnector } from "./polylineIconBoxHits";
import { getConnectorEndpointThemeSignature, resolveConnectorEndpointThemeFill } from "./sourceTheme";
import { connectorLegPlateauEase } from "./legPlateauEase";

const CONNECTOR_UNDER_STROKE_WIDTH = 9;
const CONNECTOR_STROKE_WIDTH = 1;
const CONNECTOR_CORNER_SIZE = 6;
const CONNECTOR_CORNER_RADIUS = 1;

const CONNECTOR_ANIM_SEGMENT_PX = 40;
const CONNECTOR_ANIM_HALF_PX = CONNECTOR_ANIM_SEGMENT_PX / 2;
const CONNECTOR_ANIM_STROKE_WIDTH = 1;
/** One timing "slice": 100px of path length (see `CONNECTOR_ANIM_SEC_PER_SLICE`). */
const CONNECTOR_ANIM_SLICE_PX = 100;
/** Duration multiplier: one-way leg duration = `0.2s × (pathLength / slicePx)`. */
const CONNECTOR_ANIM_SEC_PER_SLICE = 0.2;
/** Pause at source (backward complete) and target (forward complete) before reversing. */
const CONNECTOR_ANIM_ENDPOINT_PAUSE_SEC = 0.4;
/** Upper bound (seconds) for a fresh uniform [0, max) draw before each cycle’s forward leg. */
const CONNECTOR_ANIM_CYCLE_STAGGER_MAX_SEC = 0.5;
/** Only guards sub-frame / zero durations; leg time scales with path length so arc-length speed stays ~constant. */
const CONNECTOR_ANIM_MIN_LEG_SEC = 1 / 60;

/** u∈[0,1) from `crypto` so connector UI jitter does not use `Math.random` (reserved for non-grid policy). */
const randomUnitInterval = (): number => {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0]! / 2 ** 32;
};

/** Right-angle paths: default miters extend past bend centers and bleed over 6×6 joint caps. */
const CONNECTOR_PATH_STROKE_STYLE = { cap: "butt" as const, join: "bevel" as const };

export type ConnectorRenderSpec = {
  segmentFrameColor: number;
  endpointFrameColor: number;
  lineColor: number;
  cornerStrokeColor: number;
  structuralDrawOrder: ["segmentFrames", "endpointFrames"];
  /** White underlay + stroke (+ route mask while animated): lower z-order than joint caps between overlapping connectors. */
  chromeTracksDrawOrder: ["lineUnderlay", "line", "routeMask"];
  jointsChromeDrawOrder: ["cornerCaps"];
  chromePulseDrawOrder: ["connectorWave", "litCorners"];
};

export const getConnectorRenderSpec = (selected: boolean, gridStrokeColor: number): ConnectorRenderSpec => {
  const highlightColor = selected ? CONNECTOR_HIGHLIGHT_COLOR : gridStrokeColor;
  return {
    segmentFrameColor: gridStrokeColor,
    endpointFrameColor: highlightColor,
    lineColor: highlightColor,
    cornerStrokeColor: highlightColor,
    structuralDrawOrder: ["segmentFrames", "endpointFrames"],
    chromeTracksDrawOrder: ["lineUnderlay", "line", "routeMask"],
    jointsChromeDrawOrder: ["cornerCaps"],
    chromePulseDrawOrder: ["connectorWave", "litCorners"],
  };
};

export type ConnectorDisplayParts = {
  /** Selection endpoint frames only; segment frames live on the shared connector base plane. */
  structureRoot: Container;
  /** Thin connector stroke, route mask (when animated); white underlay + segments are on the base plane. */
  tracksChromeRoot: Container;
  /** Animated wave only (mask + slice), drawn under shared joint caps. */
  chromePulseRoot: Container;
  /**
   * Bend tiles lit by the traveling pulse (`animated` only). Above shared gray joint caps so themed strokes show.
   */
  chromeLitJointsRoot: Container;
  /** Stop Motion `animate` + motion value listeners when the layer is torn down. */
  disposeConnectorAnimation?: () => void;
};

export const getConnectorCornerCapRect = (point: { x: number; y: number }) => ({
  x: point.x - CONNECTOR_CORNER_SIZE / 2,
  y: point.y - CONNECTOR_CORNER_SIZE / 2,
  size: CONNECTOR_CORNER_SIZE,
  radius: CONNECTOR_CORNER_RADIUS,
});

export const getConnectorJointPoints = (
  instances: ComponentInstance[],
  bounds?: { width: number; height: number },
): Array<{ x: number; y: number }> => {
  const pointsByKey = new Map<string, { x: number; y: number }>();

  for (const instance of instances) {
    if (instance.type !== "connector-line") {
      continue;
    }

    const source = resolveConnectorEndpoint(instance.props.source, instances);
    const target = resolveConnectorEndpoint(instance.props.target, instances);
    if (!source || !target) {
      continue;
    }

    const route = routeConnectorPath(source, target, instance.props.preferredConnection, bounds);
    const elsewhereJunctionHints = collectExternalJunctionHints(instance.id, route, instances, bounds);
    const jointPoints = [
      ...getConnectorCornerPoints(route),
      ...getForeignCornerOverlapPoints(route, elsewhereJunctionHints),
    ];

    for (const point of jointPoints) {
      pointsByKey.set(`${point.x},${point.y}`, point);
    }
  }

  return [...pointsByKey.values()].sort((a, b) => a.x - b.x || a.y - b.y);
};

/** Dependencies for animated connector pulses hitting icon boxes (particles + sidebar-scheduled nudge). */
export type ConnectorChromeHitEffects = {
  particleContainer: ParticleContainer;
  dotTexture: Texture;
  scheduleIconBoxConnectorHit: (args: {
    boxId: string;
    pushX: number;
    pushY: number;
    particleOrigin: { x: number; y: number };
    /** Animated wave stroke color at hit time (`activeFill`). */
    particleTint: number;
  }) => void;
};

export type ConnectorLineInstance = Extract<ComponentInstance, { type: "connector-line" }>;

export const connectorOwnsJointPoint = (
  instance: ConnectorLineInstance,
  joint: { x: number; y: number },
  instances: ComponentInstance[],
  bounds: { width: number; height: number },
): boolean => {
  const source = resolveConnectorEndpoint(instance.props.source, instances);
  const target = resolveConnectorEndpoint(instance.props.target, instances);
  if (!source || !target) {
    return false;
  }
  const route = routeConnectorPath(source, target, instance.props.preferredConnection, bounds);
  const elsewhereJunctionHints = collectExternalJunctionHints(instance.id, route, instances, bounds);
  const jointPoints = [
    ...getConnectorCornerPoints(route),
    ...getForeignCornerOverlapPoints(route, elsewhereJunctionHints),
  ];
  return jointPoints.some((p) => p.x === joint.x && p.y === joint.y);
};

export const getConnectorInstancesOwningJoint = (
  joint: { x: number; y: number },
  instances: ComponentInstance[],
  bounds: { width: number; height: number },
): ConnectorLineInstance[] => {
  const out: ConnectorLineInstance[] = [];
  for (const inst of instances) {
    if (inst.type !== "connector-line") {
      continue;
    }
    if (connectorOwnsJointPoint(inst, joint, instances, bounds)) {
      out.push(inst);
    }
  }
  return out;
};

/** Stroke style for shared joint caps: highlight when owned by selected / hovered connectors. */
export const resolveSharedJointStrokeStyle = (
  joint: { x: number; y: number },
  instances: ComponentInstance[],
  bounds: { width: number; height: number },
  gridStrokeColor: number,
  selectedConnectorId: string | null,
  hoveredConnectorIds: ReadonlySet<string>,
): { color: number; alpha: number } => {
  const owners = getConnectorInstancesOwningJoint(joint, instances, bounds);
  if (owners.length === 0) {
    return { color: gridStrokeColor, alpha: 1 };
  }
  if (selectedConnectorId !== null && owners.some((o) => o.id === selectedConnectorId)) {
    return { color: CONNECTOR_HIGHLIGHT_COLOR, alpha: 1 };
  }
  if (hoveredConnectorIds.size > 0 && owners.some((o) => hoveredConnectorIds.has(o.id))) {
    return { color: CONNECTOR_HIGHLIGHT_COLOR, alpha: LAYER_HIGHLIGHT_HOVER_ALPHA };
  }
  return { color: gridStrokeColor, alpha: 1 };
};

const drawPolyline = (graphics: Graphics, points: { x: number; y: number }[]) => {
  const [first, ...rest] = points;
  graphics.moveTo(first.x, first.y);
  for (const point of rest) {
    graphics.lineTo(point.x, point.y);
  }
};

const connectorBaseRowKey = (row: { id: string }) => row.id;

export const getConnectorBaseLayerFingerprint = (
  instances: ComponentInstance[],
  gridStrokeColor: number,
  bounds: { width: number; height: number },
): string => {
  const rows: Array<{
    id: string;
    preferredConnection: unknown;
    source: unknown;
    target: unknown;
    overlayGrid: boolean;
    sx: number;
    sy: number;
    tx: number;
    ty: number;
  }> = [];

  for (const inst of instances) {
    if (inst.type !== "connector-line") {
      continue;
    }
    const source = resolveConnectorEndpoint(inst.props.source, instances);
    const target = resolveConnectorEndpoint(inst.props.target, instances);
    if (!source || !target) {
      continue;
    }
    rows.push({
      id: inst.id,
      preferredConnection: inst.props.preferredConnection,
      source: inst.props.source,
      target: inst.props.target,
      overlayGrid: inst.props.overlayGrid,
      sx: source.x,
      sy: source.y,
      tx: target.x,
      ty: target.y,
    });
  }

  rows.sort((a, b) => connectorBaseRowKey(a).localeCompare(connectorBaseRowKey(b)));

  return JSON.stringify({
    gridStrokeColor,
    bounds,
    routeTopology: getConnectorRouteTopologySignature(instances, bounds),
    connectors: rows,
  });
};

export const paintConnectorBaseLayer = (
  graphics: Graphics,
  instances: ComponentInstance[],
  gridStrokeColor: number,
  bounds: { width: number; height: number },
) => {
  graphics.clear();
  const segmentSpec = getConnectorRenderSpec(false, gridStrokeColor);

  const sortedInstances = [...instances].sort((a, b) => a.id.localeCompare(b.id));

  for (const inst of sortedInstances) {
    if (inst.type !== "connector-line") {
      continue;
    }
    const source = resolveConnectorEndpoint(inst.props.source, instances);
    const target = resolveConnectorEndpoint(inst.props.target, instances);
    if (!source || !target) {
      continue;
    }
    const points = routeConnectorPath(source, target, inst.props.preferredConnection, bounds);
    const segmentOverlay = inst.props.overlayGrid;
    for (const cell of getConnectorSegmentCells(points)) {
      if (segmentOverlay) {
        graphics
          .rect(cell.x + 0.5, cell.y + 0.5, LARGE_CELL_SIZE, LARGE_CELL_SIZE)
          .fill({ color: 0xffffff })
          .stroke({
            width: CONNECTOR_STROKE_WIDTH,
            color: segmentSpec.segmentFrameColor,
          });
      } else {
        graphics.rect(cell.x + 0.5, cell.y + 0.5, LARGE_CELL_SIZE, LARGE_CELL_SIZE).stroke({
          width: CONNECTOR_STROKE_WIDTH,
          color: segmentSpec.segmentFrameColor,
        });
      }
    }
  }

  for (const inst of sortedInstances) {
    if (inst.type !== "connector-line") {
      continue;
    }
    const source = resolveConnectorEndpoint(inst.props.source, instances);
    const target = resolveConnectorEndpoint(inst.props.target, instances);
    if (!source || !target) {
      continue;
    }
    const points = routeConnectorPath(source, target, inst.props.preferredConnection, bounds);
    drawPolyline(graphics, points);
    graphics.stroke({
      width: CONNECTOR_UNDER_STROKE_WIDTH,
      color: 0xffffff,
      ...CONNECTOR_PATH_STROKE_STYLE,
    });
  }
};

export const getConnectorRenderFingerprint = (
  instance: Extract<ComponentInstance, { type: "connector-line" }>,
  instances: ComponentInstance[],
  gridStrokeColor: number,
  bounds: { width: number; height: number },
  chromeHighlighted: boolean,
  highlightChromeAlpha: number,
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
    chromeHighlighted,
    highlightChromeAlpha: chromeHighlighted ? highlightChromeAlpha : 1,
    overlayGrid: instance.props.overlayGrid,
    animated: instance.props.animated,
    sourceTheme: getConnectorEndpointThemeSignature(instance.props.source, instances),
    targetTheme: getConnectorEndpointThemeSignature(instance.props.target, instances),
    routeTopology: getConnectorRouteTopologySignature(instances, bounds),
  });
};

/** Per-connector chrome: colored stroke, selection endpoint frames, animation. Segments + white underlay: {@link paintConnectorBaseLayer}. Corner caps: {@link getConnectorJointPoints} on chromeLayer. */
export const buildConnectorInstanceChrome = (
  instance: Extract<ComponentInstance, { type: "connector-line" }>,
  instances: ComponentInstance[],
  gridStrokeColor: number,
  gridStrokeHex: string,
  hitEffects: ConnectorChromeHitEffects,
  bounds?: { width: number; height: number },
  chromeHighlighted = false,
  highlightChromeAlpha = 1,
): ConnectorDisplayParts | null => {
  const source = resolveConnectorEndpoint(instance.props.source, instances);
  const target = resolveConnectorEndpoint(instance.props.target, instances);
  if (!source || !target) {
    return null;
  }

  const points = routeConnectorPath(source, target, instance.props.preferredConnection, bounds);
  const renderSpec = getConnectorRenderSpec(chromeHighlighted, gridStrokeColor);
  const segmentOverlay = instance.props.overlayGrid;

  const metrics = getPolylineMetrics(points);
  const structureRoot = new Container();
  const tracksChromeRoot = new Container();
  const chromePulseRoot = new Container();
  const chromeLitJointsRoot = new Container();
  const litCorners = new Graphics();
  chromeLitJointsRoot.addChild(litCorners);

  if (chromeHighlighted) {
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
            alpha: highlightChromeAlpha,
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
            alpha: highlightChromeAlpha,
          });
      }
    }
    structureRoot.addChild(endpointFrames);
  }

  const line = new Graphics();
  drawPolyline(line, points);
  line.stroke({
    width: CONNECTOR_STROKE_WIDTH,
    color: renderSpec.lineColor,
    alpha: chromeHighlighted ? highlightChromeAlpha : 1,
    ...CONNECTOR_PATH_STROKE_STYLE,
  });
  tracksChromeRoot.addChild(line);

  let disposeConnectorAnimation: (() => void) | undefined;
  const sharedJointPoints = getConnectorJointPoints(instances, bounds);

  if (instance.props.animated && metrics.totalLength > 0) {
    const iconBoxHits = collectIconBoxHitsAlongConnector(points, metrics, instances);

    const maskShape = new Graphics();
    drawPolyline(maskShape, points);
    maskShape.stroke({
      width: CONNECTOR_UNDER_STROKE_WIDTH,
      color: 0xffffff,
      ...CONNECTOR_PATH_STROKE_STYLE,
    });

    const waveHolder = new Container();
    const waveStroke = new Graphics();
    waveHolder.mask = maskShape;
    tracksChromeRoot.addChild(maskShape);
    chromePulseRoot.addChild(waveHolder);
    waveHolder.addChild(waveStroke);

    const drawAnimatedCornerCaps = (centerDist: number, waveFill: number) => {
      litCorners.clear();
      for (const point of sharedJointPoints) {
        const arc = arcDistanceToPointOnPolyline(points, metrics, point);
        if (arc === null) {
          continue;
        }
        const lit = arc >= centerDist - CONNECTOR_ANIM_HALF_PX && arc <= centerDist + CONNECTOR_ANIM_HALF_PX;
        if (lit) {
          const rect = getConnectorCornerCapRect(point);
          litCorners
            .roundRect(rect.x, rect.y, rect.size, rect.size, rect.radius)
            .fill({ color: 0xffffff })
            .stroke({ width: CONNECTOR_STROKE_WIDTH, color: waveFill });
        }
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
        waveStroke.stroke({
          width: CONNECTOR_ANIM_STROKE_WIDTH,
          color: waveFill,
          ...CONNECTOR_PATH_STROKE_STYLE,
        });
      }
      drawAnimatedCornerCaps(centerDist, waveFill);
    };

    const firedForwardBoxes = new Set<string>();
    const firedBackwardBoxes = new Set<string>();

    let prevCenterDist = progressAlongPath.get();

    const fireIconBoxHitsIfNeeded = (centerDist: number) => {
      const pulseStrokeTint = activeFill();
      /** Painted wave slice is [center−half, center+half]; triggers off the advancing tip, not midpoint. */
      const forwardLead = centerDist + CONNECTOR_ANIM_HALF_PX;
      const prevForwardLead = prevCenterDist + CONNECTOR_ANIM_HALF_PX;
      const backwardLead = centerDist - CONNECTOR_ANIM_HALF_PX;
      const prevBackwardLead = prevCenterDist - CONNECTOR_ANIM_HALF_PX;

      if (legPhase === "forward") {
        for (const hit of iconBoxHits) {
          if (firedForwardBoxes.has(hit.boxId)) {
            continue;
          }
          if (prevForwardLead < hit.forwardArc && forwardLead >= hit.forwardArc) {
            firedForwardBoxes.add(hit.boxId);
            hitEffects.scheduleIconBoxConnectorHit({
              boxId: hit.boxId,
              pushX: hit.pushForwardX,
              pushY: hit.pushForwardY,
              particleOrigin: hit.particleEmitForward,
              particleTint: pulseStrokeTint,
            });
          }
        }
      } else {
        for (const hit of iconBoxHits) {
          if (firedBackwardBoxes.has(hit.boxId)) {
            continue;
          }
          if (prevBackwardLead > hit.backwardArc && backwardLead <= hit.backwardArc) {
            firedBackwardBoxes.add(hit.boxId);
            hitEffects.scheduleIconBoxConnectorHit({
              boxId: hit.boxId,
              pushX: hit.pushBackwardX,
              pushY: hit.pushBackwardY,
              particleOrigin: hit.particleEmitBackward,
              particleTint: pulseStrokeTint,
            });
          }
        }
      }
    };

    const pulseListener = (d: number) => {
      renderPulse(d);
      fireIconBoxHitsIfNeeded(d);
      prevCenterDist = d;
    };

    pulseListener(progressAlongPath.get());
    const unsub = progressAlongPath.on("change", pulseListener);

    let cancelled = false;
    let activeControls: ReturnType<typeof animate> | null = null;

    const delayUnlessCancelled = async (msTotal: number) => {
      const stepMs = 50;
      let remaining = msTotal;
      while (!cancelled && remaining > 0) {
        const step = Math.min(stepMs, remaining);
        await new Promise<void>((resolve) => {
          setTimeout(resolve, step);
        });
        remaining -= step;
      }
    };

    const pauseAtEndpoint = async () => {
      await delayUnlessCancelled(CONNECTOR_ANIM_ENDPOINT_PAUSE_SEC * 1000);
    };

    const runLoop = async () => {
      while (!cancelled) {
        // New draw every cycle — not a one-shot or fixed stagger.
        const cycleStaggerMs = randomUnitInterval() * CONNECTOR_ANIM_CYCLE_STAGGER_MAX_SEC * 1000;
        await delayUnlessCancelled(cycleStaggerMs);
        if (cancelled) {
          break;
        }
        legPhase = "forward";
        firedForwardBoxes.clear();
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
        await pauseAtEndpoint();
        if (cancelled) {
          break;
        }
        legPhase = "backward";
        firedBackwardBoxes.clear();
        activeControls = animate(progressAlongPath, 0, {
          duration: legDurationSec,
          ease: connectorLegPlateauEase,
        });
        await activeControls.finished;
        activeControls = null;
        if (cancelled) {
          break;
        }
        await pauseAtEndpoint();
      }
    };

    void runLoop();

    disposeConnectorAnimation = () => {
      cancelled = true;
      activeControls?.stop();
      unsub();
    };
  }

  return {
    structureRoot,
    tracksChromeRoot,
    chromePulseRoot,
    chromeLitJointsRoot,
    disposeConnectorAnimation,
  };
};

export const buildConnectorLine = buildConnectorInstanceChrome;
