import { animate, motionValue } from "motion";
import { Container, Graphics, ParticleContainer, Rectangle, Texture } from "pixi.js";
import type { Ticker } from "../../components/pixi";
import type { ComponentInstance } from "../../grid/types";
import { RECT_MARKER_RENDER_OFFSET } from "../../lib/componentRegistry";
import { useAppStore } from "../../store";
import { parseHexColor } from "../color";
import { buildHoveredConnectorIds } from "../connectorLinkedLayerHighlights";
import { LAYER_HIGHLIGHT_HOVER_ALPHA } from "./constants";
import { createConnectorHitParticleCircleTexture, spawnConnectorHitBurst } from "./connector-line/connectorHitBurst";
import {
  buildConnectorInstanceChrome,
  type ConnectorChromeHitEffects,
  getConnectorBaseLayerFingerprint,
  getConnectorCornerCapRect,
  getConnectorJointPoints,
  getConnectorRenderFingerprint,
  paintConnectorBaseLayer,
  resolveSharedJointStrokeStyle,
} from "./connector-line/setup";
import { buildIconBox, type IconBoxRenderableInstance } from "./icon-box/build";
import { iconBoxLineEnableCoordinator } from "./icon-box/iconBoxLineEnableCoordinator";
import { buildPlusMarker } from "./plus-marker/build";
import { buildRectMarker } from "./rect-marker/build";
import {
  classifyCachedTextureDirty,
  markerVisualContentKey,
  type CachedTextureLayoutSnapshot,
} from "../utils/cachedTextureDirty";

export const COMPONENT_LAYER_BASE_Z = 10;

/** Shared segment grid + white track hulls on structureLayer, below all chrome. */
export const CONNECTOR_BASE_Z = COMPONENT_LAYER_BASE_Z - 2;

/**
 * Within {@link CONNECTOR_BASE_Z}: connector lattice segment rects plus thick hull stroke (under icon overlay).
 */
export const CONNECTOR_BASE_LATTICE_PLANE_Z = 0;

/**
 * One step above {@link CONNECTOR_BASE_LATTICE_PLANE_Z}: white 80×80 tiles under icon-box footprints (masks rail art).
 */
export const CONNECTOR_BASE_ICON_LATTICE_OVERLAY_Z = CONNECTOR_BASE_LATTICE_PLANE_Z + 1;

/** All connector thin strokes + route masks on chromeLayer, under pulse and joint caps. */
export const CONNECTOR_TRACKS_CHROME_Z = COMPONENT_LAYER_BASE_Z - 1;

/** Shared corner caps on chromeLayer: above tracks + pulse, below component chrome (icons/markers). */
export const CONNECTOR_JOINTS_CHROME_Z = COMPONENT_LAYER_BASE_Z;

/**
 * Animated wave only: strictly between {@link CONNECTOR_TRACKS_CHROME_Z} and {@link CONNECTOR_JOINTS_CHROME_Z}
 * so the slice never paints over shared white joint fills.
 */
export const getConnectorPulseChromeZ = (layerIndex: number) => CONNECTOR_JOINTS_CHROME_Z - 0.01 - layerIndex * 0.001;

/** Themed bend caps while the pulse passes: above shared gray joint strokes, below icon/list chrome. */
export const getConnectorLitCornersChromeZ = (layerIndex: number) =>
  CONNECTOR_JOINTS_CHROME_Z + 0.02 - layerIndex * 0.001;

export const getComponentLayerZ = (layerCount: number, layerIndex: number) =>
  COMPONENT_LAYER_BASE_Z + layerCount - layerIndex;

/** Z-order above stacked components so connector sparks paint over chrome but selection stays on top (later stage child). */
export const COMPONENT_LAYER_PARTICLE_OVERLAY_Z = COMPONENT_LAYER_BASE_Z + 1000;

const CONNECTOR_HIT_NUDGE_OUT_SEC = 0.09;
const CONNECTOR_HIT_NUDGE_RETURN_SEC = 0.2;

type LayerCacheEntry =
  | {
      kind: "icon-box";
      instanceId: string;
      structureRoot: Container;
      chromeRoot: Container;
      innerBodyMotionRoot: Container;
      animHandles: import("./icon-box/iconBoxLineEnableCoordinator").IconBoxAnimHandles;
      propsJson: string;
      gridStrokeHex: string;
      hitNudgeX: number;
      hitNudgeY: number;
      disposeHitNudge?: () => void;
    }
  | {
      kind: "plus-marker";
      structureRoot: Container;
      chromeRoot: Container;
      contentKey: string;
      layoutSnapshot: CachedTextureLayoutSnapshot;
    }
  | {
      kind: "rect-marker";
      structureRoot: Container;
      chromeRoot: Container;
      contentKey: string;
      layoutSnapshot: CachedTextureLayoutSnapshot;
    }
  | {
      kind: "connector-line";
      structureRoot: Container;
      tracksChromeRoot: Container;
      chromePulseRoot: Container;
      chromeLitJointsRoot: Container;
      fingerprint: string;
      disposeConnectorAnimation?: () => void;
    };

const destroyLayerEntry = (entry: LayerCacheEntry) => {
  if (entry.kind === "icon-box") {
    entry.disposeHitNudge?.();
    iconBoxLineEnableCoordinator.detachHandles(entry.instanceId);
  }

  if (entry.kind === "connector-line") {
    entry.disposeConnectorAnimation?.();
    entry.tracksChromeRoot.destroy({ children: true });
    entry.chromePulseRoot.destroy({ children: true });
    entry.chromeLitJointsRoot.destroy({ children: true });
    entry.structureRoot.destroy({ children: true });
    return;
  }

  entry.structureRoot.destroy({ children: true });
  entry.chromeRoot.destroy({ children: true });
};

const syncSharedConnectorJoints = (
  jointsChromeRoot: Graphics,
  instances: ComponentInstance[],
  bounds: { width: number; height: number },
  gridStrokeColor: number,
  selectedConnectorId: string | null,
  hoveredConnectorIds: ReadonlySet<string>,
) => {
  jointsChromeRoot.clear();
  for (const point of getConnectorJointPoints(instances, bounds)) {
    const rect = getConnectorCornerCapRect(point);
    const stroke = resolveSharedJointStrokeStyle(
      point,
      instances,
      bounds,
      gridStrokeColor,
      selectedConnectorId,
      hoveredConnectorIds,
    );
    jointsChromeRoot
      .roundRect(rect.x, rect.y, rect.size, rect.size, rect.radius)
      .fill({ color: 0xffffff })
      .stroke({ width: 1, color: stroke.color, alpha: stroke.alpha });
  }
};

const syncConnectorBasePlane = (
  connectorLatticePlaneGraphics: Graphics,
  iconLatticeBackdropGraphics: Graphics,
  baseFingerprintCache: { value: string },
  instances: ComponentInstance[],
  gridStrokeColor: number,
  bounds: { width: number; height: number },
) => {
  const nextFp = getConnectorBaseLayerFingerprint(instances, gridStrokeColor, bounds);
  if (nextFp === baseFingerprintCache.value) {
    return;
  }
  baseFingerprintCache.value = nextFp;
  paintConnectorBaseLayer(
    connectorLatticePlaneGraphics,
    iconLatticeBackdropGraphics,
    instances,
    gridStrokeColor,
    bounds,
  );
};

const syncLayers = (
  connectorLatticePlaneGraphics: Graphics,
  iconLatticeBackdropGraphics: Graphics,
  baseFingerprintCache: { value: string },
  structureLayer: Container,
  chromeLayer: Container,
  jointsChromeRoot: Graphics,
  particlePlane: ParticleContainer,
  cache: Map<string, LayerCacheEntry>,
  connectorHitEffects: ConnectorChromeHitEffects,
) => {
  const { instances, dragState, grid, selectedInstanceId, canvasHoveredLayerId, sidebarHoveredLayerId } =
    useAppStore.getState();
  const gridStrokeHex = grid.config.strokeColor;
  const gridStrokeColor = parseHexColor(gridStrokeHex);
  const previewInstance = dragState?.mode === "create" ? dragState.preview : null;
  const toDraw = previewInstance === null ? instances : [...instances, previewInstance];
  const bounds = { width: grid.config.logicalWidth, height: grid.config.logicalHeight };

  const selectedConnectorId =
    selectedInstanceId && toDraw.find((i) => i.id === selectedInstanceId)?.type === "connector-line"
      ? selectedInstanceId
      : null;
  const hoveredConnectorIds = buildHoveredConnectorIds(toDraw, canvasHoveredLayerId, sidebarHoveredLayerId);
  const connectorChromeHighlightedIds = new Set<string>(hoveredConnectorIds);
  if (selectedConnectorId) {
    connectorChromeHighlightedIds.add(selectedConnectorId);
  }

  particlePlane.boundsArea = new Rectangle(0, 0, bounds.width, bounds.height);

  const desiredIds = new Set(toDraw.map((i) => i.id));
  for (const id of [...cache.keys()]) {
    if (!desiredIds.has(id)) {
      iconBoxLineEnableCoordinator.removeBox(id);
      destroyLayerEntry(cache.get(id)!);
      cache.delete(id);
      continue;
    }
  }

  syncConnectorBasePlane(
    connectorLatticePlaneGraphics,
    iconLatticeBackdropGraphics,
    baseFingerprintCache,
    toDraw,
    gridStrokeColor,
    bounds,
  );

  jointsChromeRoot.zIndex = CONNECTOR_JOINTS_CHROME_Z;
  syncSharedConnectorJoints(
    jointsChromeRoot,
    toDraw,
    bounds,
    gridStrokeColor,
    selectedConnectorId,
    hoveredConnectorIds,
  );

  const layerPassInstances = toDraw;
  const count = layerPassInstances.length;

  for (let index = 0; index < layerPassInstances.length; index += 1) {
    const instance = layerPassInstances[index];
    const z = getComponentLayerZ(count, index);

    if (instance.type === "connector-line") {
      syncConnectorLine(
        instance,
        toDraw,
        structureLayer,
        chromeLayer,
        cache,
        gridStrokeColor,
        gridStrokeHex,
        bounds,
        selectedInstanceId,
        hoveredConnectorIds,
        z,
        index,
        connectorHitEffects,
      );
      continue;
    }

    if (instance.type === "plus-marker") {
      syncPlusMarker(instance, structureLayer, chromeLayer, cache, z, gridStrokeHex);
      continue;
    }

    if (instance.type === "rect-marker") {
      syncRectMarker(instance, structureLayer, chromeLayer, cache, z, gridStrokeHex);
      continue;
    }

    if (instance.type === "icon-box" || instance.type === "icon-box-2x1") {
      syncIconBox(instance, structureLayer, chromeLayer, cache, z, gridStrokeColor, gridStrokeHex);
      continue;
    }
  }
};

const syncConnectorLine = (
  instance: Extract<ComponentInstance, { type: "connector-line" }>,
  toDraw: ComponentInstance[],
  structureLayer: Container,
  chromeLayer: Container,
  cache: Map<string, LayerCacheEntry>,
  gridStrokeColor: number,
  gridStrokeHex: string,
  bounds: { width: number; height: number },
  selectedInstanceId: string | null,
  hoveredConnectorIds: ReadonlySet<string>,
  /**
   * {@link z} applies to selection frames on `structureLayer`. Pulse wave uses {@link getConnectorPulseChromeZ};
   * themed bend highlights use {@link getConnectorLitCornersChromeZ} above shared joint caps.
   */
  z: number,
  layerIndex: number,
  connectorHitEffects: ConnectorChromeHitEffects,
) => {
  const selectedAsConnector = selectedInstanceId === instance.id;
  const chromeHighlighted = selectedAsConnector || hoveredConnectorIds.has(instance.id);
  const highlightChromeAlpha = !chromeHighlighted ? 1 : selectedAsConnector ? 1 : LAYER_HIGHLIGHT_HOVER_ALPHA;
  const fingerprint = getConnectorRenderFingerprint(
    instance,
    toDraw,
    gridStrokeColor,
    bounds,
    chromeHighlighted,
    highlightChromeAlpha,
  );

  if (fingerprint === null) {
    const prior = cache.get(instance.id);
    if (prior) {
      destroyLayerEntry(prior);
      cache.delete(instance.id);
    }
    return;
  }

  const prior = cache.get(instance.id);

  if (!prior || prior.kind !== "connector-line" || prior.fingerprint !== fingerprint) {
    if (prior) {
      destroyLayerEntry(prior);
      cache.delete(instance.id);
    }

    const parts = buildConnectorInstanceChrome(
      instance,
      toDraw,
      gridStrokeColor,
      gridStrokeHex,
      connectorHitEffects,
      bounds,
      chromeHighlighted,
      highlightChromeAlpha,
    );
    if (!parts) {
      return;
    }

    parts.structureRoot.zIndex = z;
    parts.tracksChromeRoot.zIndex = CONNECTOR_TRACKS_CHROME_Z;
    parts.chromePulseRoot.zIndex = getConnectorPulseChromeZ(layerIndex);
    parts.chromeLitJointsRoot.zIndex = getConnectorLitCornersChromeZ(layerIndex);
    structureLayer.addChild(parts.structureRoot);
    chromeLayer.addChild(parts.tracksChromeRoot);
    chromeLayer.addChild(parts.chromePulseRoot);
    chromeLayer.addChild(parts.chromeLitJointsRoot);

    cache.set(instance.id, {
      kind: "connector-line",
      structureRoot: parts.structureRoot,
      tracksChromeRoot: parts.tracksChromeRoot,
      chromePulseRoot: parts.chromePulseRoot,
      chromeLitJointsRoot: parts.chromeLitJointsRoot,
      fingerprint,
      disposeConnectorAnimation: parts.disposeConnectorAnimation,
    });
  } else {
    prior.structureRoot.zIndex = z;
    prior.tracksChromeRoot.zIndex = CONNECTOR_TRACKS_CHROME_Z;
    prior.chromePulseRoot.zIndex = getConnectorPulseChromeZ(layerIndex);
    prior.chromeLitJointsRoot.zIndex = getConnectorLitCornersChromeZ(layerIndex);
  }
};

const syncPlusMarker = (
  instance: Extract<ComponentInstance, { type: "plus-marker" }>,
  structureLayer: Container,
  chromeLayer: Container,
  cache: Map<string, LayerCacheEntry>,
  z: number,
  gridStrokeHex: string,
) => {
  const contentKey = markerVisualContentKey(instance.props, gridStrokeHex);
  const layout: CachedTextureLayoutSnapshot = { x: instance.x, y: instance.y, zIndex: z };
  const prior = cache.get(instance.id);

  if (!prior || prior.kind !== "plus-marker") {
    if (prior) {
      destroyLayerEntry(prior);
      cache.delete(instance.id);
    }

    const { structureRoot, chromeRoot } = buildPlusMarker(instance, gridStrokeHex);
    structureRoot.cacheAsTexture(true);
    structureRoot.position.set(instance.x, instance.y);
    chromeRoot.position.set(instance.x, instance.y);
    structureRoot.zIndex = z;
    chromeRoot.zIndex = z;
    structureLayer.addChild(structureRoot);
    chromeLayer.addChild(chromeRoot);

    cache.set(instance.id, {
      kind: "plus-marker",
      structureRoot,
      chromeRoot,
      contentKey,
      layoutSnapshot: layout,
    });
    return;
  }

  const dirty = classifyCachedTextureDirty({
    priorLayout: prior.layoutSnapshot,
    priorContentKey: prior.contentKey,
    layout,
    contentKey,
  });

  if (dirty === "content") {
    destroyLayerEntry(prior);
    cache.delete(instance.id);

    const { structureRoot, chromeRoot } = buildPlusMarker(instance, gridStrokeHex);
    structureRoot.cacheAsTexture(true);
    structureRoot.position.set(instance.x, instance.y);
    chromeRoot.position.set(instance.x, instance.y);
    structureRoot.zIndex = z;
    chromeRoot.zIndex = z;
    structureLayer.addChild(structureRoot);
    chromeLayer.addChild(chromeRoot);

    cache.set(instance.id, {
      kind: "plus-marker",
      structureRoot,
      chromeRoot,
      contentKey,
      layoutSnapshot: layout,
    });
    return;
  }

  if (dirty === "layout") {
    prior.structureRoot.position.set(instance.x, instance.y);
    prior.chromeRoot.position.set(instance.x, instance.y);
    prior.structureRoot.zIndex = z;
    prior.chromeRoot.zIndex = z;
    cache.set(instance.id, { ...prior, layoutSnapshot: layout });
  }
};

const syncRectMarker = (
  instance: Extract<ComponentInstance, { type: "rect-marker" }>,
  structureLayer: Container,
  chromeLayer: Container,
  cache: Map<string, LayerCacheEntry>,
  z: number,
  gridStrokeHex: string,
) => {
  const contentKey = markerVisualContentKey(instance.props, gridStrokeHex);
  const rx = instance.x + RECT_MARKER_RENDER_OFFSET;
  const ry = instance.y + RECT_MARKER_RENDER_OFFSET;
  const layout: CachedTextureLayoutSnapshot = { x: rx, y: ry, zIndex: z };
  const prior = cache.get(instance.id);

  if (!prior || prior.kind !== "rect-marker") {
    if (prior) {
      destroyLayerEntry(prior);
      cache.delete(instance.id);
    }

    const { structureRoot, chromeRoot } = buildRectMarker(instance, gridStrokeHex);
    structureRoot.cacheAsTexture(true);
    structureRoot.position.set(rx, ry);
    chromeRoot.position.set(rx, ry);
    structureRoot.zIndex = z;
    chromeRoot.zIndex = z;
    structureLayer.addChild(structureRoot);
    chromeLayer.addChild(chromeRoot);

    cache.set(instance.id, {
      kind: "rect-marker",
      structureRoot,
      chromeRoot,
      contentKey,
      layoutSnapshot: layout,
    });
    return;
  }

  const dirty = classifyCachedTextureDirty({
    priorLayout: prior.layoutSnapshot,
    priorContentKey: prior.contentKey,
    layout,
    contentKey,
  });

  if (dirty === "content") {
    destroyLayerEntry(prior);
    cache.delete(instance.id);

    const { structureRoot, chromeRoot } = buildRectMarker(instance, gridStrokeHex);
    structureRoot.cacheAsTexture(true);
    structureRoot.position.set(rx, ry);
    chromeRoot.position.set(rx, ry);
    structureRoot.zIndex = z;
    chromeRoot.zIndex = z;
    structureLayer.addChild(structureRoot);
    chromeLayer.addChild(chromeRoot);

    cache.set(instance.id, {
      kind: "rect-marker",
      structureRoot,
      chromeRoot,
      contentKey,
      layoutSnapshot: layout,
    });
    return;
  }

  if (dirty === "layout") {
    prior.structureRoot.position.set(rx, ry);
    prior.chromeRoot.position.set(rx, ry);
    prior.structureRoot.zIndex = z;
    prior.chromeRoot.zIndex = z;
    cache.set(instance.id, { ...prior, layoutSnapshot: layout });
  }
};

const syncIconBox = (
  instance: IconBoxRenderableInstance,
  structureLayer: Container,
  chromeLayer: Container,
  cache: Map<string, LayerCacheEntry>,
  z: number,
  gridStrokeColor: number,
  gridStrokeHex: string,
) => {
  const propsJson = JSON.stringify({ type: instance.type, props: instance.props });
  const prior = cache.get(instance.id);

  if (!prior || prior.kind !== "icon-box") {
    if (prior) {
      destroyLayerEntry(prior);
      cache.delete(instance.id);
    }

    const { structureRoot, chromeRoot, innerBodyMotionRoot, animHandles } = buildIconBox(
      instance,
      gridStrokeColor,
      gridStrokeHex,
    );
    structureRoot.zIndex = z;
    chromeRoot.zIndex = z;
    structureLayer.addChild(structureRoot);
    chromeLayer.addChild(chromeRoot);

    cache.set(instance.id, {
      kind: "icon-box",
      instanceId: instance.id,
      structureRoot,
      chromeRoot,
      innerBodyMotionRoot,
      animHandles,
      propsJson,
      gridStrokeHex,
      hitNudgeX: 0,
      hitNudgeY: 0,
    });
    iconBoxLineEnableCoordinator.attachHandles(instance.id, animHandles, gridStrokeHex);
  } else if (prior.propsJson !== propsJson || prior.gridStrokeHex !== gridStrokeHex) {
    destroyLayerEntry(prior);
    cache.delete(instance.id);

    const { structureRoot, chromeRoot, innerBodyMotionRoot, animHandles } = buildIconBox(
      instance,
      gridStrokeColor,
      gridStrokeHex,
    );
    structureRoot.zIndex = z;
    chromeRoot.zIndex = z;
    structureLayer.addChild(structureRoot);
    chromeLayer.addChild(chromeRoot);

    cache.set(instance.id, {
      kind: "icon-box",
      instanceId: instance.id,
      structureRoot,
      chromeRoot,
      innerBodyMotionRoot,
      animHandles,
      propsJson,
      gridStrokeHex,
      hitNudgeX: 0,
      hitNudgeY: 0,
    });
    iconBoxLineEnableCoordinator.attachHandles(instance.id, animHandles, gridStrokeHex);
  } else {
    /** Layout-only: filtered leaves cache pixels in **local** space under `chromeRoot`; connector hit nudge is local on `innerBodyMotionRoot`. */
    prior.structureRoot.position.set(instance.x, instance.y);
    prior.chromeRoot.position.set(instance.x, instance.y);
    prior.innerBodyMotionRoot.position.set(prior.hitNudgeX, prior.hitNudgeY);
    prior.structureRoot.zIndex = z;
    prior.chromeRoot.zIndex = z;
  }
};

export const setupComponentLayer: Ticker = ({ app, cleanup }) => {
  const layer = new Container();
  layer.sortableChildren = true;
  app.stage.addChild(layer);

  const structureLayer = new Container();
  structureLayer.sortableChildren = true;
  const chromeLayer = new Container();
  chromeLayer.sortableChildren = true;

  const particleDotTexture = createConnectorHitParticleCircleTexture();
  const particlePlane = new ParticleContainer({
    texture: particleDotTexture,
    dynamicProperties: {
      position: true,
      color: true,
    },
    roundPixels: false,
  });
  particlePlane.zIndex = COMPONENT_LAYER_PARTICLE_OVERLAY_Z;
  particlePlane.label = "connector-hit-particles";

  const connectorBaseRoot = new Container();
  connectorBaseRoot.sortableChildren = true;
  connectorBaseRoot.zIndex = CONNECTOR_BASE_Z;
  const connectorLatticePlaneGraphics = new Graphics();
  connectorLatticePlaneGraphics.zIndex = CONNECTOR_BASE_LATTICE_PLANE_Z;
  const iconLatticeBackdropGraphics = new Graphics();
  iconLatticeBackdropGraphics.zIndex = CONNECTOR_BASE_ICON_LATTICE_OVERLAY_Z;
  connectorBaseRoot.addChild(connectorLatticePlaneGraphics);
  connectorBaseRoot.addChild(iconLatticeBackdropGraphics);
  structureLayer.addChild(connectorBaseRoot);

  layer.addChild(structureLayer);
  layer.addChild(chromeLayer);
  layer.addChild(particlePlane);

  const jointsChromeRoot = new Graphics();
  chromeLayer.addChild(jointsChromeRoot);

  const cache = new Map<string, LayerCacheEntry>();
  const connectorBaseFingerprintCache = { value: "" };

  const connectorHitEffects: ConnectorChromeHitEffects = {
    particleContainer: particlePlane,
    dotTexture: particleDotTexture,
    scheduleIconBoxConnectorHit: (hitArgs) => {
      iconBoxLineEnableCoordinator.notifyTargetHit({
        connectorId: hitArgs.connectorId,
        leg: hitArgs.leg,
        boxId: hitArgs.boxId,
      });

      spawnConnectorHitBurst(
        app,
        particlePlane,
        particleDotTexture,
        hitArgs.getParticleOrigin,
        hitArgs.particleTint,
        hitArgs.pushX,
        hitArgs.pushY,
      );

      const entry = cache.get(hitArgs.boxId);
      if (!entry || entry.kind !== "icon-box") {
        return;
      }

      entry.disposeHitNudge?.();

      let unsubNx: (() => void) | undefined;
      let unsubNy: (() => void) | undefined;
      let cancelled = false;
      let controlsOutX: ReturnType<typeof animate> | null = null;
      let controlsOutY: ReturnType<typeof animate> | null = null;
      let controlsInX: ReturnType<typeof animate> | null = null;
      let controlsInY: ReturnType<typeof animate> | null = null;

      const nx = motionValue(entry.hitNudgeX);
      const ny = motionValue(entry.hitNudgeY);

      const syncRoots = () => {
        entry.hitNudgeX = nx.get();
        entry.hitNudgeY = ny.get();
        const inst = useAppStore.getState().instances.find((i) => i.id === hitArgs.boxId);
        if (!inst || (inst.type !== "icon-box" && inst.type !== "icon-box-2x1")) {
          return;
        }
        entry.structureRoot.position.set(inst.x, inst.y);
        entry.chromeRoot.position.set(inst.x, inst.y);
        entry.innerBodyMotionRoot.position.set(entry.hitNudgeX, entry.hitNudgeY);
      };

      unsubNx = nx.on("change", syncRoots);
      unsubNy = ny.on("change", syncRoots);

      const PUSH = 1;
      const tx = hitArgs.pushX * PUSH;
      const ty = hitArgs.pushY * PUSH;

      const cleanupListeners = () => {
        unsubNx?.();
        unsubNy?.();
        unsubNx = undefined;
        unsubNy = undefined;
        delete entry.disposeHitNudge;
      };

      const disposeHit = () => {
        cancelled = true;
        controlsOutX?.stop();
        controlsOutY?.stop();
        controlsInX?.stop();
        controlsInY?.stop();
        nx.set(0);
        ny.set(0);
        entry.hitNudgeX = 0;
        entry.hitNudgeY = 0;
        cleanupListeners();
        const inst = useAppStore.getState().instances.find((i) => i.id === hitArgs.boxId);
        if (inst && (inst.type === "icon-box" || inst.type === "icon-box-2x1")) {
          entry.structureRoot.position.set(inst.x, inst.y);
          entry.chromeRoot.position.set(inst.x, inst.y);
        }
        entry.innerBodyMotionRoot.position.set(0, 0);
      };

      entry.disposeHitNudge = disposeHit;

      const run = async () => {
        controlsOutX = animate(nx, tx, { duration: CONNECTOR_HIT_NUDGE_OUT_SEC });
        controlsOutY = animate(ny, ty, { duration: CONNECTOR_HIT_NUDGE_OUT_SEC });
        await Promise.all([controlsOutX.finished, controlsOutY.finished]);
        controlsOutX = null;
        controlsOutY = null;
        if (cancelled) {
          return;
        }

        controlsInX = animate(nx, 0, { duration: CONNECTOR_HIT_NUDGE_RETURN_SEC });
        controlsInY = animate(ny, 0, { duration: CONNECTOR_HIT_NUDGE_RETURN_SEC });
        await Promise.all([controlsInX.finished, controlsInY.finished]);
        controlsInX = null;
        controlsInY = null;
        if (cancelled) {
          return;
        }

        entry.hitNudgeX = 0;
        entry.hitNudgeY = 0;
        nx.set(0);
        ny.set(0);
        cleanupListeners();
        const inst = useAppStore.getState().instances.find((i) => i.id === hitArgs.boxId);
        if (inst && (inst.type === "icon-box" || inst.type === "icon-box-2x1")) {
          entry.structureRoot.position.set(inst.x, inst.y);
          entry.chromeRoot.position.set(inst.x, inst.y);
        }
        entry.innerBodyMotionRoot.position.set(0, 0);
      };

      void run();
    },
    waitForOutgoingPulseSlot: (args) => iconBoxLineEnableCoordinator.waitForOutgoingPulseSlot(args),
    releaseOutgoingPulseCycleSlot: (args) => iconBoxLineEnableCoordinator.releaseOutgoingPulseCycleSlot(args),
    notifyTargetLayerPulseCycleComplete: (args) =>
      iconBoxLineEnableCoordinator.notifyTargetLayerPulseCycleComplete(args),
  };

  syncLayers(
    connectorLatticePlaneGraphics,
    iconLatticeBackdropGraphics,
    connectorBaseFingerprintCache,
    structureLayer,
    chromeLayer,
    jointsChromeRoot,
    particlePlane,
    cache,
    connectorHitEffects,
  );

  const unsub = useAppStore.subscribe((state, prev) => {
    if (
      state.instances !== prev.instances ||
      state.dragState !== prev.dragState ||
      state.grid !== prev.grid ||
      state.selectedInstanceId !== prev.selectedInstanceId ||
      state.sidebarHoveredLayerId !== prev.sidebarHoveredLayerId ||
      state.canvasHoveredLayerId !== prev.canvasHoveredLayerId
    ) {
      syncLayers(
        connectorLatticePlaneGraphics,
        iconLatticeBackdropGraphics,
        connectorBaseFingerprintCache,
        structureLayer,
        chromeLayer,
        jointsChromeRoot,
        particlePlane,
        cache,
        connectorHitEffects,
      );
    }
  });

  cleanup(() => {
    unsub();
    for (const entry of cache.values()) {
      destroyLayerEntry(entry);
    }
    cache.clear();
    iconBoxLineEnableCoordinator.clearRuntime();
    connectorBaseFingerprintCache.value = "";
    if (particleDotTexture !== Texture.WHITE) {
      particleDotTexture.destroy(true);
    }
    layer.destroy(true);
  });
};
