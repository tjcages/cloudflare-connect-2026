import { Container, Graphics } from "pixi.js";
import type { Ticker } from "../../components/pixi";
import type { ComponentInstance } from "../../grid/types";
import { useAppStore } from "../../store";
import { parseHexColor } from "../color";
import { RECT_MARKER_RENDER_OFFSET } from "../../lib/componentRegistry";
import {
  buildConnectorLine,
  getConnectorCornerCapRect,
  getConnectorJointPoints,
  getConnectorRenderFingerprint,
} from "./connector-line/setup";
import { buildIconBox, type IconBoxRenderableInstance } from "./icon-box/build";
import { buildPlusMarker } from "./plus-marker/build";
import { buildRectMarker } from "./rect-marker/build";
import {
  classifyCachedTextureDirty,
  markerVisualContentKey,
  type CachedTextureLayoutSnapshot,
} from "../utils/cachedTextureDirty";

/**
 * Perf rollout gate: only listed kinds render on Pixi until connector pass ships.
 * Plus/rect markers use {@link classifyCachedTextureDirty} + `cacheAsTexture`; icon boxes use {@link syncIconBox}.
 */
const COMPONENT_LAYER_LIMITED_RENDER_PASS = true;

const limitedRenderPassInstance = (inst: ComponentInstance): boolean =>
  inst.type === "plus-marker" ||
  inst.type === "rect-marker" ||
  inst.type === "icon-box" ||
  inst.type === "icon-box-2x1";

export const COMPONENT_LAYER_BASE_Z = 10;

export const getComponentLayerZ = (layerCount: number, layerIndex: number) =>
  COMPONENT_LAYER_BASE_Z + layerCount - layerIndex;

export const getConnectorLineZ = () => ({
  structure: COMPONENT_LAYER_BASE_Z - 2,
  tracksChrome: COMPONENT_LAYER_BASE_Z - 1,
  jointsChrome: COMPONENT_LAYER_BASE_Z,
  chromePulse: COMPONENT_LAYER_BASE_Z,
});

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
      fingerprint: string;
      disposeConnectorAnimation?: () => void;
    };

const destroyLayerEntry = (entry: LayerCacheEntry) => {
  if (entry.kind === "connector-line") {
    entry.disposeConnectorAnimation?.();
    entry.tracksChromeRoot.destroy({ children: true });
    entry.chromePulseRoot.destroy({ children: true });
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
) => {
  jointsChromeRoot.clear();
  for (const point of getConnectorJointPoints(instances, bounds)) {
    const rect = getConnectorCornerCapRect(point);
    jointsChromeRoot
      .roundRect(rect.x, rect.y, rect.size, rect.size, rect.radius)
      .fill({ color: 0xffffff })
      .stroke({ width: 1, color: gridStrokeColor });
  }
};

const syncLayers = (
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
    if (COMPONENT_LAYER_LIMITED_RENDER_PASS) {
      const inst = toDraw.find((i) => i.id === id);
      if (inst && !limitedRenderPassInstance(inst)) {
        destroyLayerEntry(cache.get(id)!);
        cache.delete(id);
      }
    }
  }

  const connectorZ = getConnectorLineZ();

  jointsChromeRoot.zIndex = connectorZ.jointsChrome;
  if (COMPONENT_LAYER_LIMITED_RENDER_PASS) {
    jointsChromeRoot.clear();
  } else {
    syncSharedConnectorJoints(jointsChromeRoot, toDraw, bounds, gridStrokeColor);
  }

  const layerPassInstances: ComponentInstance[] = COMPONENT_LAYER_LIMITED_RENDER_PASS
    ? toDraw.filter(limitedRenderPassInstance)
    : toDraw;
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
) => {
  const connectorZ = getConnectorLineZ();
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

    const parts = buildConnectorLine(
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

    parts.structureRoot.zIndex = connectorZ.structure;
    parts.tracksChromeRoot.zIndex = connectorZ.tracksChrome;
    parts.chromePulseRoot.zIndex = connectorZ.chromePulse;
    structureLayer.addChild(parts.structureRoot);
    chromeLayer.addChild(parts.tracksChromeRoot);
    chromeLayer.addChild(parts.chromePulseRoot);

    cache.set(instance.id, {
      kind: "connector-line",
      structureRoot: parts.structureRoot,
      tracksChromeRoot: parts.tracksChromeRoot,
      chromePulseRoot: parts.chromePulseRoot,
      fingerprint,
      disposeConnectorAnimation: parts.disposeConnectorAnimation,
    });
  } else {
    prior.structureRoot.zIndex = connectorZ.structure;
    prior.tracksChromeRoot.zIndex = connectorZ.tracksChrome;
    prior.chromePulseRoot.zIndex = connectorZ.chromePulse;
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
  const jointsChromeRoot = new Graphics();
  layer.addChild(structureLayer);
  layer.addChild(chromeLayer);
  chromeLayer.addChild(jointsChromeRoot);

  const cache = new Map<string, LayerCacheEntry>();

  syncLayers(structureLayer, chromeLayer, jointsChromeRoot, cache);

  const unsub = useAppStore.subscribe((state, prev) => {
    if (
      state.instances !== prev.instances ||
      state.dragState !== prev.dragState ||
      state.grid !== prev.grid ||
      state.selectedInstanceId !== prev.selectedInstanceId
    ) {
      syncLayers(structureLayer, chromeLayer, jointsChromeRoot, cache);
    }
  });

  cleanup(() => {
    unsub();
    for (const entry of cache.values()) {
      destroyLayerEntry(entry);
    }
    cache.clear();
    layer.destroy(true);
  });
};
