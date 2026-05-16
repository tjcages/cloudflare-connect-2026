import { Container, Graphics } from "pixi.js";
import type { Ticker } from "../../components/pixi";
import type { ComponentInstance } from "../../grid/types";
import { useAppStore } from "../../store";
import { parseHexColor } from "../color";
import { RECT_MARKER_RENDER_OFFSET } from "../../lib/componentRegistry";
import {
  buildConnectorInstanceChrome,
  getConnectorBaseLayerFingerprint,
  getConnectorCornerCapRect,
  getConnectorJointPoints,
  getConnectorRenderFingerprint,
  paintConnectorBaseLayer,
  resolveSharedJointStrokeColor,
} from "./connector-line/setup";
import { buildIconBox, type IconBoxRenderableInstance } from "./icon-box/build";
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

type LayerCacheEntry =
  | {
      kind: "icon-box";
      structureRoot: Container;
      chromeRoot: Container;
      propsJson: string;
      gridStrokeHex: string;
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
  selectedInstanceId: string | null,
) => {
  jointsChromeRoot.clear();
  for (const point of getConnectorJointPoints(instances, bounds)) {
    const rect = getConnectorCornerCapRect(point);
    const strokeColor = resolveSharedJointStrokeColor(point, instances, bounds, gridStrokeColor, selectedInstanceId);
    jointsChromeRoot
      .roundRect(rect.x, rect.y, rect.size, rect.size, rect.radius)
      .fill({ color: 0xffffff })
      .stroke({ width: 1, color: strokeColor });
  }
};

const syncConnectorBasePlane = (
  connectorBaseGraphics: Graphics,
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
  paintConnectorBaseLayer(connectorBaseGraphics, instances, gridStrokeColor, bounds);
};

const syncLayers = (
  connectorBaseGraphics: Graphics,
  baseFingerprintCache: { value: string },
  structureLayer: Container,
  chromeLayer: Container,
  jointsChromeRoot: Graphics,
  cache: Map<string, LayerCacheEntry>,
) => {
  const { instances, dragState, grid, selectedInstanceId } = useAppStore.getState();
  const gridStrokeHex = grid.config.strokeColor;
  const gridStrokeColor = parseHexColor(gridStrokeHex);
  const previewInstance = dragState?.mode === "create" ? dragState.preview : null;
  const toDraw = previewInstance === null ? instances : [...instances, previewInstance];
  const bounds = { width: grid.config.logicalWidth, height: grid.config.logicalHeight };

  const desiredIds = new Set(toDraw.map((i) => i.id));
  for (const id of [...cache.keys()]) {
    if (!desiredIds.has(id)) {
      destroyLayerEntry(cache.get(id)!);
      cache.delete(id);
      continue;
    }
  }

  syncConnectorBasePlane(connectorBaseGraphics, baseFingerprintCache, toDraw, gridStrokeColor, bounds);

  jointsChromeRoot.zIndex = CONNECTOR_JOINTS_CHROME_Z;
  syncSharedConnectorJoints(jointsChromeRoot, toDraw, bounds, gridStrokeColor, selectedInstanceId);

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
        z,
        index,
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
  /**
   * {@link z} applies to selection frames on `structureLayer`. Pulse wave uses {@link getConnectorPulseChromeZ};
   * themed bend highlights use {@link getConnectorLitCornersChromeZ} above shared joint caps.
   */
  z: number,
  layerIndex: number,
) => {
  const fingerprint = getConnectorRenderFingerprint(
    instance,
    toDraw,
    gridStrokeColor,
    bounds,
    instance.id === selectedInstanceId,
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
      bounds,
      instance.id === selectedInstanceId,
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

    const { structureRoot, chromeRoot } = buildIconBox(instance, gridStrokeColor, gridStrokeHex);
    structureRoot.zIndex = z;
    chromeRoot.zIndex = z;
    structureLayer.addChild(structureRoot);
    chromeLayer.addChild(chromeRoot);

    cache.set(instance.id, {
      kind: "icon-box",
      structureRoot,
      chromeRoot,
      propsJson,
      gridStrokeHex,
    });
  } else if (prior.propsJson !== propsJson || prior.gridStrokeHex !== gridStrokeHex) {
    destroyLayerEntry(prior);
    cache.delete(instance.id);

    const { structureRoot, chromeRoot } = buildIconBox(instance, gridStrokeColor, gridStrokeHex);
    structureRoot.zIndex = z;
    chromeRoot.zIndex = z;
    structureLayer.addChild(structureRoot);
    chromeLayer.addChild(chromeRoot);

    cache.set(instance.id, {
      kind: "icon-box",
      structureRoot,
      chromeRoot,
      propsJson,
      gridStrokeHex,
    });
  } else {
    /** Layout-only: filtered leaves cache pixels in **local** space under `chromeRoot`; translation here must stay free of double-applied shadow offsets. */
    prior.structureRoot.position.set(instance.x, instance.y);
    prior.chromeRoot.position.set(instance.x, instance.y);
    prior.structureRoot.zIndex = z;
    prior.chromeRoot.zIndex = z;
  }
};

export const setupComponentLayer: Ticker = ({ app, cleanup }) => {
  const layer = new Container();
  app.stage.addChild(layer);

  const structureLayer = new Container();
  structureLayer.sortableChildren = true;
  const chromeLayer = new Container();
  chromeLayer.sortableChildren = true;

  const connectorBaseRoot = new Container();
  connectorBaseRoot.sortableChildren = false;
  connectorBaseRoot.zIndex = CONNECTOR_BASE_Z;
  const connectorBaseGraphics = new Graphics();
  connectorBaseRoot.addChild(connectorBaseGraphics);
  structureLayer.addChild(connectorBaseRoot);

  layer.addChild(structureLayer);
  layer.addChild(chromeLayer);

  const jointsChromeRoot = new Graphics();
  chromeLayer.addChild(jointsChromeRoot);

  const cache = new Map<string, LayerCacheEntry>();
  const connectorBaseFingerprintCache = { value: "" };

  syncLayers(
    connectorBaseGraphics,
    connectorBaseFingerprintCache,
    structureLayer,
    chromeLayer,
    jointsChromeRoot,
    cache,
  );

  const unsub = useAppStore.subscribe((state, prev) => {
    if (
      state.instances !== prev.instances ||
      state.dragState !== prev.dragState ||
      state.grid !== prev.grid ||
      state.selectedInstanceId !== prev.selectedInstanceId
    ) {
      syncLayers(
        connectorBaseGraphics,
        connectorBaseFingerprintCache,
        structureLayer,
        chromeLayer,
        jointsChromeRoot,
        cache,
      );
    }
  });

  cleanup(() => {
    unsub();
    for (const entry of cache.values()) {
      destroyLayerEntry(entry);
    }
    cache.clear();
    connectorBaseFingerprintCache.value = "";
    layer.destroy(true);
  });
};
