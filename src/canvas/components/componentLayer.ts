import { Container } from "pixi.js";
import type { Ticker } from "../../components/pixi";
import type { ComponentInstance } from "../../grid/types";
import { useAppStore } from "../../store";
import { parseHexColor } from "../color";
import { RECT_MARKER_RENDER_OFFSET } from "../../lib/componentRegistry";
import { buildConnectorLine, getConnectorRenderFingerprint } from "./connector-line/setup";
import { buildIconBox, type IconBoxRenderableInstance } from "./icon-box/build";
import { buildPlusMarker } from "./plus-marker/build";
import { buildRectMarker } from "./rect-marker/build";

const COMPONENT_LAYER_BASE_Z = 10;

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
      propsJson: string;
      gridStrokeHex: string;
    }
  | {
      kind: "rect-marker";
      structureRoot: Container;
      chromeRoot: Container;
      propsJson: string;
      gridStrokeHex: string;
    }
  | {
      kind: "connector-line";
      structureRoot: Container;
      chromeRoot: Container;
      chromePulseRoot: Container;
      fingerprint: string;
      disposeConnectorAnimation?: () => void;
    };

const destroyLayerEntry = (entry: LayerCacheEntry) => {
  if (entry.kind === "connector-line") {
    entry.disposeConnectorAnimation?.();
  }
  entry.structureRoot.destroy({ children: true });
  entry.chromeRoot.destroy({ children: true });
  if (entry.kind === "connector-line") {
    entry.chromePulseRoot.destroy({ children: true });
  }
};

const syncLayers = (structureLayer: Container, chromeLayer: Container, cache: Map<string, LayerCacheEntry>) => {
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
    }
  }

  const count = toDraw.length;

  for (let index = 0; index < toDraw.length; index += 1) {
    const instance = toDraw[index];
    const z = COMPONENT_LAYER_BASE_Z + count - index;

    if (instance.type === "connector-line") {
      syncConnectorLine(
        instance,
        toDraw,
        structureLayer,
        chromeLayer,
        cache,
        z,
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
  z: number,
  gridStrokeColor: number,
  gridStrokeHex: string,
  bounds: { width: number; height: number },
  selectedInstanceId: string | null,
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

    parts.structureRoot.zIndex = z;
    parts.chromeRoot.zIndex = COMPONENT_LAYER_BASE_Z;
    parts.chromePulseRoot.zIndex = z;
    structureLayer.addChild(parts.structureRoot);
    chromeLayer.addChild(parts.chromeRoot);
    chromeLayer.addChild(parts.chromePulseRoot);

    cache.set(instance.id, {
      kind: "connector-line",
      structureRoot: parts.structureRoot,
      chromeRoot: parts.chromeRoot,
      chromePulseRoot: parts.chromePulseRoot,
      fingerprint,
      disposeConnectorAnimation: parts.disposeConnectorAnimation,
    });
  } else {
    prior.structureRoot.zIndex = z;
    prior.chromeRoot.zIndex = COMPONENT_LAYER_BASE_Z;
    prior.chromePulseRoot.zIndex = z;
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
  const propsJson = JSON.stringify(instance.props);
  const prior = cache.get(instance.id);

  if (!prior || prior.kind !== "plus-marker") {
    if (prior) {
      destroyLayerEntry(prior);
      cache.delete(instance.id);
    }

    const { structureRoot, chromeRoot } = buildPlusMarker(instance, gridStrokeHex);
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
      propsJson,
      gridStrokeHex,
    });
  } else if (prior.propsJson !== propsJson || prior.gridStrokeHex !== gridStrokeHex) {
    destroyLayerEntry(prior);
    cache.delete(instance.id);

    const { structureRoot, chromeRoot } = buildPlusMarker(instance, gridStrokeHex);
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
      propsJson,
      gridStrokeHex,
    });
  } else {
    prior.structureRoot.position.set(instance.x, instance.y);
    prior.chromeRoot.position.set(instance.x, instance.y);
    prior.structureRoot.zIndex = z;
    prior.chromeRoot.zIndex = z;
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
  const propsJson = JSON.stringify(instance.props);
  const prior = cache.get(instance.id);
  const rx = instance.x + RECT_MARKER_RENDER_OFFSET;
  const ry = instance.y + RECT_MARKER_RENDER_OFFSET;

  if (!prior || prior.kind !== "rect-marker") {
    if (prior) {
      destroyLayerEntry(prior);
      cache.delete(instance.id);
    }

    const { structureRoot, chromeRoot } = buildRectMarker(instance, gridStrokeHex);
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
      propsJson,
      gridStrokeHex,
    });
  } else if (prior.propsJson !== propsJson || prior.gridStrokeHex !== gridStrokeHex) {
    destroyLayerEntry(prior);
    cache.delete(instance.id);

    const { structureRoot, chromeRoot } = buildRectMarker(instance, gridStrokeHex);
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
      propsJson,
      gridStrokeHex,
    });
  } else {
    prior.structureRoot.position.set(rx, ry);
    prior.chromeRoot.position.set(rx, ry);
    prior.structureRoot.zIndex = z;
    prior.chromeRoot.zIndex = z;
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
  layer.addChild(structureLayer);
  layer.addChild(chromeLayer);

  const cache = new Map<string, LayerCacheEntry>();

  syncLayers(structureLayer, chromeLayer, cache);

  const unsub = useAppStore.subscribe((state, prev) => {
    if (
      state.instances !== prev.instances ||
      state.dragState !== prev.dragState ||
      state.grid !== prev.grid ||
      state.selectedInstanceId !== prev.selectedInstanceId
    ) {
      syncLayers(structureLayer, chromeLayer, cache);
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
