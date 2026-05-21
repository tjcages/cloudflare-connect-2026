import { animate, motionValue } from "motion";
import { Container, Graphics } from "pixi.js";
import type { ParticleContainer, Texture } from "pixi.js";
import { getInstanceCanvasBounds } from "../../../lib/componentRegistry";
import {
  getIconBoxShadowCardBoundsInRootSpace,
  isIconBoxInstance,
  resolveIconBoxLayout,
} from "../../../lib/icon-box/layout";
import { LARGE_CELL_SIZE, type ComponentInstance, type ConnectorLineInstance } from "../../../grid/types";
import { useAppStore } from "../../../store";
import { CONNECTOR_HIGHLIGHT_COLOR, LAYER_HIGHLIGHT_HOVER_ALPHA } from "../constants";
import { getPolylineMetrics, arcDistanceToPointOnPolyline, slicePolylineByDistance } from "./pathMotion";
import {
  collectExternalJunctionHints,
  getConnectorCornerPointsForInstance,
  getConnectorRouteTopologySignature,
  getForeignCornerOverlapPoints,
  resolveConnectorEndpoint,
  resolveStaticEndLegForTarget,
  routeConnectorPathForInstance,
  getConnectorSegmentCellsForInstance,
  type ConnectorRouteBounds,
} from "./route";
import { collectIconBoxHitsAlongConnector, resolveIconBoxLiveParticleEmit } from "./polylineIconBoxHits";
import { getConnectorEndpointThemeSignature, resolveConnectorEndpointThemeFill } from "./sourceTheme";
import { connectorLegPlateauEase } from "./legPlateauEase";
import {
  appendDashedPolyline,
  appendDashedRectOutline,
  CONNECTOR_DASH_OFF_PX,
  CONNECTOR_DASH_ON_PX,
} from "./dashedStroke";

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
/** Upper bound (seconds) for a fresh uniform [0, max) draw before each cycle’s forward leg. */
const CONNECTOR_ANIM_CYCLE_STAGGER_MAX_SEC = 0.5;
/** Only guards sub-frame / zero durations; leg time scales with path length so arc-length speed stays ~constant. */
const CONNECTOR_ANIM_MIN_LEG_SEC = 1 / 60;
/** One full dash+gap cycle marches along dashed connector paths (seconds). */
const CONNECTOR_DASH_MARCH_SEC_PER_CYCLE = 0.625;

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
  /** Optional selection endpoint frames (`cell` anchors only); segment lattice stays on the shared base plane. */
  structureRoot: Container;
  /** White path hull + thin stroke + route mask (when animated). Hull is here so it renders on `chromeLayer` above every icon’s structure `cardFrame`. */
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
  bounds?: ConnectorRouteBounds,
): Array<{ x: number; y: number }> => {
  const pointsByKey = new Map<string, { x: number; y: number }>();

  for (const instance of instances) {
    if (instance.type !== "connector-line") {
      continue;
    }

    const route = routeConnectorPathForInstance(instance, instances, bounds);
    if (route.length === 0) {
      continue;
    }

    const elsewhereJunctionHints = collectExternalJunctionHints(instance.id, route, instances, bounds);
    const jointPoints = [
      ...getConnectorCornerPointsForInstance(
        route,
        instance.props.target,
        resolveStaticEndLegForTarget(instance.props.target, bounds?.width, bounds?.height),
      ),
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
    connectorId: string;
    boxId: string;
    pushX: number;
    pushY: number;
    /** Sampled each frame so sparks track live icon-box bounds during drag/nudge. */
    getParticleOrigin: () => { x: number; y: number };
    /** Animated wave stroke color at hit time (source endpoint theme). */
    particleTint: number;
  }) => void;
  /** Layer-source connectors await a slot before each full pulse cycle when outgoing is gated. */
  waitForOutgoingPulseSlot?: (args: {
    connectorId: string;
    sourceLayerId: string;
    isCancelled: () => boolean;
  }) => Promise<void>;
  /** After forward delivery completes; releases outgoing RR slot. */
  releaseOutgoingPulseCycleSlot?: (args: { connectorId: string; sourceLayerId: string }) => void;
  /**
   * When forward delivery completes at a layer target. Decrements iterated `hitCount` for the layer-target
   * icon box. Skipped when source is a layer on the same box (`releaseOutgoingPulseCycleSlot` handles that case).
   */
  notifyTargetLayerPulseCycleComplete?: (args: { connectorId: string; targetLayerId: string }) => void;
};

export const connectorOwnsJointPoint = (
  instance: ConnectorLineInstance,
  joint: { x: number; y: number },
  instances: ComponentInstance[],
  bounds: ConnectorRouteBounds,
): boolean => {
  const route = routeConnectorPathForInstance(instance, instances, bounds);
  if (route.length === 0) {
    return false;
  }
  const elsewhereJunctionHints = collectExternalJunctionHints(instance.id, route, instances, bounds);
  const jointPoints = [
    ...getConnectorCornerPointsForInstance(
      route,
      instance.props.target,
      resolveStaticEndLegForTarget(instance.props.target, bounds.width, bounds.height),
    ),
    ...getForeignCornerOverlapPoints(route, elsewhereJunctionHints),
  ];
  return jointPoints.some((p) => p.x === joint.x && p.y === joint.y);
};

export const getConnectorInstancesOwningJoint = (
  joint: { x: number; y: number },
  instances: ComponentInstance[],
  bounds: ConnectorRouteBounds,
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
  bounds: ConnectorRouteBounds,
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

export const connectorJointShouldDash = (
  joint: { x: number; y: number },
  instances: ComponentInstance[],
  bounds: ConnectorRouteBounds,
): boolean =>
  getConnectorInstancesOwningJoint(joint, instances, bounds).some((owner) => owner.props.style === "dashed");

const drawPolyline = (graphics: Graphics, points: { x: number; y: number }[]) => {
  const [first, ...rest] = points;
  graphics.moveTo(first.x, first.y);
  for (const point of rest) {
    graphics.lineTo(point.x, point.y);
  }
};

const drawConnectorPathStroke = (
  graphics: Graphics,
  points: { x: number; y: number }[],
  dashed: boolean,
  dashPhase = 0,
) => {
  if (dashed) {
    appendDashedPolyline(graphics, points, CONNECTOR_DASH_ON_PX, CONNECTOR_DASH_OFF_PX, dashPhase);
  } else {
    drawPolyline(graphics, points);
  }
};

const appendConnectorCellFrameStroke = (graphics: Graphics, x: number, y: number, size: number, dashed: boolean) => {
  if (dashed) {
    appendDashedRectOutline(graphics, x, y, size, size, CONNECTOR_DASH_ON_PX, CONNECTOR_DASH_OFF_PX);
  } else {
    graphics.rect(x, y, size, size);
  }
};

const connectorBaseRowKey = (row: { id: string }) => row.id;

type IconLatticeBackdropRow = {
  id: string;
  type: "icon-box";
  x: number;
  y: number;
  w: number;
  h: number;
};

/** Shadow-card rects in root space (white tiles under icon glossy), sorted by id for stable fingerprints and paint. */
const sortedIconLatticeBackdropRows = (instances: ComponentInstance[]): IconLatticeBackdropRow[] =>
  [...instances]
    .filter((inst): inst is Extract<ComponentInstance, { type: "icon-box" }> => isIconBoxInstance(inst))
    .map((inst) => {
      const r = getIconBoxShadowCardBoundsInRootSpace(resolveIconBoxLayout(inst.props));
      return {
        id: inst.id,
        type: inst.type,
        x: inst.x + r.x,
        y: inst.y + r.y,
        w: r.width,
        h: r.height,
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));

export const getConnectorBaseLayerFingerprint = (
  instances: ComponentInstance[],
  gridStrokeColor: number,
  bounds: ConnectorRouteBounds,
): string => {
  const rows: Array<{
    id: string;
    preferredConnection: unknown;
    source: unknown;
    target: unknown;
    overlayGrid: boolean;
    style: unknown;
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
      style: inst.props.style,
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
    iconLatticeBackdrop: sortedIconLatticeBackdropRows(instances),
  });
};

/** Segment rects on `latticePlaneGraphics`; icon shadow-card backdrop on `iconLatticeBackdropGraphics`. White path hull is drawn per connector on {@link ConnectorDisplayParts.tracksChromeRoot}. */
export const paintConnectorBaseLayer = (
  latticePlaneGraphics: Graphics,
  iconLatticeBackdropGraphics: Graphics,
  instances: ComponentInstance[],
  gridStrokeColor: number,
  bounds: ConnectorRouteBounds,
) => {
  latticePlaneGraphics.clear();
  iconLatticeBackdropGraphics.clear();
  const segmentSpec = getConnectorRenderSpec(false, gridStrokeColor);

  const sortedInstances = [...instances].sort((a, b) => a.id.localeCompare(b.id));

  for (const inst of sortedInstances) {
    if (inst.type !== "connector-line") {
      continue;
    }
    const segmentOverlay = inst.props.overlayGrid;
    const dashed = inst.props.style === "dashed";
    for (const cell of getConnectorSegmentCellsForInstance(inst, instances, bounds)) {
      const frameX = cell.x + 0.5;
      const frameY = cell.y + 0.5;
      if (segmentOverlay) {
        latticePlaneGraphics.rect(frameX, frameY, LARGE_CELL_SIZE, LARGE_CELL_SIZE).fill({ color: 0xffffff });
      }
      appendConnectorCellFrameStroke(latticePlaneGraphics, frameX, frameY, LARGE_CELL_SIZE, dashed);
      latticePlaneGraphics.stroke({
        width: CONNECTOR_STROKE_WIDTH,
        color: segmentSpec.segmentFrameColor,
      });
    }
  }

  for (const row of sortedIconLatticeBackdropRows(instances)) {
    iconLatticeBackdropGraphics
      .rect(row.x + 0.5, row.y + 0.5, row.w, row.h)
      .fill({ color: 0xffffff })
      .stroke({
        width: CONNECTOR_STROKE_WIDTH,
        color: segmentSpec.segmentFrameColor,
      });
  }
};

export const getConnectorRenderFingerprint = (
  instance: ConnectorLineInstance,
  instances: ComponentInstance[],
  gridStrokeColor: number,
  bounds: ConnectorRouteBounds,
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
    style: instance.props.style,
    sourceTheme: getConnectorEndpointThemeSignature(instance.props.source, instances),
    targetTheme: getConnectorEndpointThemeSignature(instance.props.target, instances),
    routeTopology: getConnectorRouteTopologySignature(instances, bounds),
  });
};

/** Per-connector chrome: colored stroke, route mask (when animated), **white path hull** (under thin line). Hull lives on `tracksChromeRoot` so it paints on {@link chromeLayer} above all {@link structureLayer} icon card frames. Optional selection endpoint frames on `structureRoot`. Shared segment lattice: {@link paintConnectorBaseLayer}. Corner caps: {@link getConnectorJointPoints} on chromeLayer. */
export const buildConnectorInstanceChrome = (
  instance: ConnectorLineInstance,
  instances: ComponentInstance[],
  gridStrokeColor: number,
  gridStrokeHex: string,
  hitEffects: ConnectorChromeHitEffects,
  bounds?: ConnectorRouteBounds,
  chromeHighlighted = false,
  highlightChromeAlpha = 1,
): ConnectorDisplayParts | null => {
  const source = resolveConnectorEndpoint(instance.props.source, instances);
  const target = resolveConnectorEndpoint(instance.props.target, instances);
  if (!source || !target) {
    return null;
  }

  const points = routeConnectorPathForInstance(instance, instances, bounds);
  const renderSpec = getConnectorRenderSpec(chromeHighlighted, gridStrokeColor);
  const segmentOverlay = instance.props.overlayGrid;
  const dashed = instance.props.style === "dashed";

  const metrics = getPolylineMetrics(points);
  const structureRoot = new Container();

  const tracksChromeRoot = new Container();
  tracksChromeRoot.sortableChildren = true;

  const pathHullUnderlay = new Graphics();
  pathHullUnderlay.zIndex = 0;
  drawPolyline(pathHullUnderlay, points);
  pathHullUnderlay.stroke({
    width: CONNECTOR_UNDER_STROKE_WIDTH,
    color: 0xffffff,
    ...CONNECTOR_PATH_STROKE_STYLE,
  });
  tracksChromeRoot.addChild(pathHullUnderlay);

  const chromePulseRoot = new Container();
  const chromeLitJointsRoot = new Container();
  const litCorners = new Graphics();
  chromeLitJointsRoot.addChild(litCorners);

  if (chromeHighlighted) {
    structureRoot.sortableChildren = true;
    /** 80×80 lattice endpoint frames: useful for `cell` anchors; skipped for `layer` — selection layer already outlines icon/marker targets and the rect clashes with wide icon shadow cards (reads as a stray vertical/horizontal stroke). */
    const endpointFrames = new Graphics();
    endpointFrames.zIndex = 0;
    const staticEndLeg = resolveStaticEndLegForTarget(instance.props.target, bounds?.width, bounds?.height);
    const targetEndpoint = instance.props.target;
    let drewAnyEndpointFrame = false;
    for (const { point, endpoint } of [
      { point: source, endpoint: instance.props.source },
      { point: target, endpoint: targetEndpoint },
    ] as const) {
      if (endpoint.kind === "layer") {
        continue;
      }
      if (staticEndLeg !== "unset" && endpoint === targetEndpoint) {
        continue;
      }
      drewAnyEndpointFrame = true;
      const frameX = point.x - LARGE_CELL_SIZE / 2 + 0.5;
      const frameY = point.y - LARGE_CELL_SIZE / 2 + 0.5;
      if (segmentOverlay) {
        endpointFrames.rect(frameX, frameY, LARGE_CELL_SIZE, LARGE_CELL_SIZE).fill({ color: 0xffffff });
      }
      appendConnectorCellFrameStroke(endpointFrames, frameX, frameY, LARGE_CELL_SIZE, dashed);
      endpointFrames.stroke({
        width: CONNECTOR_STROKE_WIDTH,
        color: renderSpec.endpointFrameColor,
        alpha: highlightChromeAlpha,
      });
    }
    if (drewAnyEndpointFrame) {
      structureRoot.addChild(endpointFrames);
    }
  }

  const line = new Graphics();
  line.zIndex = 1;
  const lineStroke = {
    width: CONNECTOR_STROKE_WIDTH,
    color: renderSpec.lineColor,
    alpha: chromeHighlighted ? highlightChromeAlpha : 1,
    ...CONNECTOR_PATH_STROKE_STYLE,
  };
  drawConnectorPathStroke(line, points, dashed);
  line.stroke(lineStroke);
  tracksChromeRoot.addChild(line);

  let disposeConnectorAnimation: (() => void) | undefined;
  const animationDisposers: Array<() => void> = [];

  if (dashed && metrics.totalLength > 0) {
    const dashCyclePx = CONNECTOR_DASH_ON_PX + CONNECTOR_DASH_OFF_PX;
    const dashPhase = motionValue(dashCyclePx);
    const redrawDashedLine = (phase: number) => {
      line.clear();
      drawConnectorPathStroke(line, points, true, phase);
      line.stroke(lineStroke);
    };
    redrawDashedLine(dashCyclePx);
    const dashControls = animate(dashPhase, 0, {
      duration: CONNECTOR_DASH_MARCH_SEC_PER_CYCLE,
      repeat: Infinity,
      ease: "linear",
    });
    const unsubDash = dashPhase.on("change", redrawDashedLine);
    animationDisposers.push(() => {
      dashControls.stop();
      unsubDash();
    });
  }

  const sharedJointPoints = getConnectorJointPoints(instances, bounds);

  if (instance.props.animated && metrics.totalLength > 0) {
    const iconBoxHits = collectIconBoxHitsAlongConnector(points, metrics, instances);
    const layerSourceId = instance.props.source.kind === "layer" ? instance.props.source.instanceId : null;
    const layerTargetId = instance.props.target.kind === "layer" ? instance.props.target.instanceId : null;

    const maskShape = new Graphics();
    maskShape.zIndex = 2;
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
    const waveFill = () => resolveConnectorEndpointThemeFill(instance.props.source, instances, gridStrokeHex);

    const renderPulse = (centerDist: number) => {
      const fill = waveFill();
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
          color: fill,
          ...CONNECTOR_PATH_STROKE_STYLE,
        });
      }
      drawAnimatedCornerCaps(centerDist, fill);
    };

    const firedForwardBoxes = new Set<string>();

    let prevCenterDist = progressAlongPath.get();

    const particleOriginForHit = (boxId: string, fallback: { x: number; y: number }) => {
      const inst = useAppStore.getState().instances.find((i) => i.id === boxId);
      if (!inst || !isIconBoxInstance(inst)) {
        return fallback;
      }
      const b = getInstanceCanvasBounds(inst);
      const rect = { x: b.x, y: b.y, width: b.width, height: b.height };
      const live = resolveIconBoxLiveParticleEmit(points, metrics, rect);
      return live ?? fallback;
    };

    const fireIconBoxHitsIfNeeded = (centerDist: number) => {
      const pulseStrokeTint = waveFill();
      /** Painted wave slice is [center−half, center+half]; triggers off the advancing tip, not midpoint. */
      const forwardLead = centerDist + CONNECTOR_ANIM_HALF_PX;
      const prevForwardLead = prevCenterDist + CONNECTOR_ANIM_HALF_PX;

      for (const hit of iconBoxHits) {
        if (firedForwardBoxes.has(hit.boxId)) {
          continue;
        }
        if (prevForwardLead < hit.forwardArc && forwardLead >= hit.forwardArc) {
          firedForwardBoxes.add(hit.boxId);
          hitEffects.scheduleIconBoxConnectorHit({
            connectorId: instance.id,
            boxId: hit.boxId,
            pushX: hit.pushForwardX,
            pushY: hit.pushForwardY,
            getParticleOrigin: () => particleOriginForHit(hit.boxId, hit.particleEmitForward),
            particleTint: pulseStrokeTint,
          });
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

    const runLoop = async () => {
      while (!cancelled) {
        const cycleStaggerMs = randomUnitInterval() * CONNECTOR_ANIM_CYCLE_STAGGER_MAX_SEC * 1000;
        await delayUnlessCancelled(cycleStaggerMs);
        if (cancelled) {
          break;
        }
        if (layerSourceId && hitEffects.waitForOutgoingPulseSlot) {
          await hitEffects.waitForOutgoingPulseSlot({
            connectorId: instance.id,
            sourceLayerId: layerSourceId,
            isCancelled: () => cancelled,
          });
          if (cancelled) {
            break;
          }
        }
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
        if (layerTargetId && hitEffects.notifyTargetLayerPulseCycleComplete) {
          const sourceIsLayerOnSameBox =
            instance.props.source.kind === "layer" && instance.props.source.instanceId === layerTargetId;
          if (!sourceIsLayerOnSameBox) {
            hitEffects.notifyTargetLayerPulseCycleComplete({
              connectorId: instance.id,
              targetLayerId: layerTargetId,
            });
          }
        }
        if (layerSourceId && hitEffects.releaseOutgoingPulseCycleSlot) {
          hitEffects.releaseOutgoingPulseCycleSlot({
            connectorId: instance.id,
            sourceLayerId: layerSourceId,
          });
        }
      }
    };

    void runLoop();

    animationDisposers.push(() => {
      cancelled = true;
      activeControls?.stop();
      unsub();
    });
  }

  if (animationDisposers.length > 0) {
    disposeConnectorAnimation = () => {
      for (const dispose of animationDisposers) {
        dispose();
      }
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
