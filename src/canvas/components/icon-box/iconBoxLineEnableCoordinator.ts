import { animate, cubicBezier, motionValue } from "motion";
import type { Container, Graphics, Sprite, Text } from "pixi.js";
import type { ComponentInstance } from "../../../grid/types";
import { isIconBoxInstance, TITLE_BAR_HEIGHT } from "../../../lib/icon-box/layout";
import { useAppStore, type IconBoxLineEnableDebugRow } from "../../../store";
import {
  applyHitToLineEnableState,
  getIconBoxPropsOrUndefined,
  iconBoxOutgoingBudget,
  initialIconBoxLineEnableCounters,
  lineEnablePresentationEnabled,
  listOutgoingConnectorsFromLayerSource,
  shouldGateOutgoingPulses,
  type IconBoxLineEnableCounters,
} from "../../../lib/iconBoxEnabledByLine";
import {
  createOutgoingPulseGateState,
  releaseOutgoingPulseSlot,
  resetOutgoingPulseGate,
  tryAcquireOutgoingPulseSlot,
} from "../../../lib/iconBoxOutgoingPulseGate";
import { paletteBrush } from "../../../theme/palette";

type IconBoxRenderableInstance = Extract<ComponentInstance, { type: "icon-box" }>;

export const LINE_ENABLE_COLOR_DURATION_SEC = 0.45;
/** After presentation color motion is fully idle, wait this long before starting the next transition. */
export const LINE_ENABLE_DEBOUNCE_MS = 100;
/** Merge stacked `scheduleDebouncedVisual` calls; 0 = next macrotask (no extra fixed wait before the pipeline). */
const LINE_ENABLE_SCHEDULE_COALESCE_MS = 0;
const LINE_ENABLE_EASE = cubicBezier(0.6, 0.6, 0, 1);

const unpackRgb = (packed: number): [number, number, number] => [
  (packed >> 16) & 255,
  (packed >> 8) & 255,
  packed & 255,
];

const packRgb = (r: number, g: number, b: number): number => (r << 16) | (g << 8) | b;

const lerpChannel = (a: number, b: number, t: number): number => Math.round(a + (b - a) * t);

const lerpPackedRgb = (from: number, to: number, t: number): number => {
  const [r1, g1, b1] = unpackRgb(from);
  const [r2, g2, b2] = unpackRgb(to);
  return packRgb(lerpChannel(r1, r2, t), lerpChannel(g1, g2, t), lerpChannel(b1, b2, t));
};

export type IconBoxAccentAnimHandle = {
  scaleRoot: Container;
};

export type IconBoxAnimHandles = {
  instance: IconBoxRenderableInstance;
  titleLabel: Text;
  titleBg: Graphics;
  titleBarLayout: { barLeft: number; rectWidth: number };
  iconSprites: Sprite[];
  markersRedraw: (cornerPackedRgb: number) => void;
  accentScaleRoots: IconBoxAccentAnimHandle[];
};

type BoxRuntime = {
  counters: IconBoxLineEnableCounters;
  debounceTimer: ReturnType<typeof setTimeout> | undefined;
  /** Serializes `commitDebouncedVisual` so coalesced schedules cannot overlap while async work runs. */
  visualCommitChain: Promise<void> | undefined;
  colorBusy: boolean;
  hasCompletedInitialEnable: boolean;
  visualEnabled: boolean;
  handles: IconBoxAnimHandles | null;
  gridStrokeHex: string;
  lastEnabledByLine: IconBoxRenderableInstance["props"]["enabledByLine"];
  needsFlushAfterTween: boolean;
  presentationEpoch: number;
};

const boxes = new Map<string, BoxRuntime>();
const outgoingGates = new Map<string, ReturnType<typeof createOutgoingPulseGateState>>();

const getNeutralSync = (hex: string) => ({ neutralFillSyncHex: hex });

const resolveCornerPacked = (
  presentationEnabled: boolean,
  props: IconBoxRenderableInstance["props"],
  gridStrokeHex: string,
): number => {
  const themed = paletteBrush(props.theme, getNeutralSync(gridStrokeHex));
  const neutral = paletteBrush("neutral", getNeutralSync(gridStrokeHex));
  if (!presentationEnabled) {
    return neutral.fill;
  }
  return props.matchCornersWithTheme ? themed.fill : neutral.fill;
};

export const computeLineEnablePackedColors = (
  instance: IconBoxRenderableInstance,
  gridStrokeHex: string,
  presentationEnabled: boolean,
) => {
  const themed = paletteBrush(instance.props.theme, getNeutralSync(gridStrokeHex));
  const neutral = paletteBrush("neutral", getNeutralSync(gridStrokeHex));
  if (!presentationEnabled) {
    return {
      titleBg: neutral.fill,
      titleText: neutral.fillText,
      icon: neutral.iconFill,
      corner: resolveCornerPacked(false, instance.props, gridStrokeHex),
    };
  }
  return {
    titleBg: themed.fill,
    titleText: themed.fillText,
    icon: themed.iconFill,
    corner: resolveCornerPacked(true, instance.props, gridStrokeHex),
  };
};

const paintTitleBg = (g: Graphics, barLeft: number, rectWidth: number, fillPacked: number) => {
  g.clear();
  g.rect(barLeft, 0, rectWidth, TITLE_BAR_HEIGHT).fill({ color: fillPacked });
};

export const applyLineEnableFrameToHandles = (
  handles: IconBoxAnimHandles,
  instance: IconBoxRenderableInstance,
  gridStrokeHex: string,
  presentationEnabled: boolean,
  accentScale01: number,
) => {
  const cols = computeLineEnablePackedColors(instance, gridStrokeHex, presentationEnabled);
  const { barLeft, rectWidth } = handles.titleBarLayout;
  paintTitleBg(handles.titleBg, barLeft, rectWidth, cols.titleBg);
  handles.titleLabel.style.fill = `#${cols.titleText.toString(16).padStart(6, "0")}`;
  for (const sp of handles.iconSprites) {
    sp.tint = cols.icon;
  }
  handles.markersRedraw(cols.corner);
  const scale = presentationEnabled && instance.props.theme !== "neutral" ? accentScale01 : 0;
  for (const { scaleRoot } of handles.accentScaleRoots) {
    scaleRoot.scale.x = scale;
  }
};

const instancesSnapshot = (): ComponentInstance[] => useAppStore.getState().instances;

const syncLineEnableDebugToStore = (boxId: string) => {
  const instances = instancesSnapshot();
  const inst = instances.find((i) => i.id === boxId);
  if (!inst || !isIconBoxInstance(inst)) {
    useAppStore.getState().patchIconBoxLineEnableDebug(boxId, null);
    return;
  }
  const mode = inst.props.enabledByLine;
  if (mode === "off") {
    useAppStore.getState().patchIconBoxLineEnableDebug(boxId, null);
    return;
  }

  const rt = boxes.get(boxId);
  const counters = rt?.counters ?? initialIconBoxLineEnableCounters();
  const logical = lineEnablePresentationEnabled(mode, counters);
  const gate = outgoingGates.get(boxId);
  const row: IconBoxLineEnableDebugRow = {
    boxId,
    hitCount: counters.hitCount,
    onceLatched: counters.onceLatched,
    visualEnabled: rt?.visualEnabled ?? logical,
    logicalEnabled: logical,
    colorBusy: rt?.colorBusy ?? false,
    hasHandles: !!rt?.handles,
    mode,
    outgoingActive: gate?.active.size ?? 0,
    outgoingWaiting: gate?.waiting.size ?? 0,
    updatedAt: Date.now(),
  };
  useAppStore.getState().patchIconBoxLineEnableDebug(boxId, row);
};

/** Iterated: decrement hitCount after a full pulse cycle (outgoing slot release and/or layer-target cycle end). */
const applyIteratedCycleDecrementForBox = (boxId: string) => {
  const instances = instancesSnapshot();
  const inst = instances.find((i) => i.id === boxId);
  if (!inst || !isIconBoxInstance(inst)) {
    return;
  }
  if (inst.props.enabledByLine !== "iterated") {
    return;
  }

  let rt = boxes.get(boxId);
  if (!rt) {
    rt = {
      counters: initialIconBoxLineEnableCounters(),
      debounceTimer: undefined,
      visualCommitChain: undefined,
      colorBusy: false,
      hasCompletedInitialEnable: false,
      visualEnabled: false,
      handles: null,
      gridStrokeHex: "#F3F3F3",
      lastEnabledByLine: "iterated",
      needsFlushAfterTween: false,
      presentationEpoch: 0,
    };
    boxes.set(boxId, rt);
  }

  rt.counters = {
    ...rt.counters,
    hitCount: Math.max(0, rt.counters.hitCount - 1),
  };
  iconBoxLineEnableCoordinator.refreshOutgoingGateForSource(boxId);
  iconBoxLineEnableCoordinator.scheduleDebouncedVisual(boxId);
  syncLineEnableDebugToStore(boxId);
};

export const iconBoxLineEnableCoordinator = {
  attachHandles(boxId: string, handles: IconBoxAnimHandles, gridStrokeHex: string) {
    let rt = boxes.get(boxId);
    if (!rt) {
      const initialMode = handles.instance.props.enabledByLine;
      const initialCounters = initialIconBoxLineEnableCounters();
      rt = {
        counters: initialCounters,
        debounceTimer: undefined,
        visualCommitChain: undefined,
        colorBusy: false,
        hasCompletedInitialEnable: false,
        visualEnabled: initialMode === "off" ? true : lineEnablePresentationEnabled(initialMode, initialCounters),
        handles: null,
        gridStrokeHex,
        lastEnabledByLine: initialMode,
        needsFlushAfterTween: false,
        presentationEpoch: 0,
      };
      boxes.set(boxId, rt);
    }

    rt.presentationEpoch += 1;
    rt.handles = handles;
    rt.gridStrokeHex = gridStrokeHex;

    const mode = handles.instance.props.enabledByLine;
    if (rt.lastEnabledByLine !== mode) {
      if (mode === "off") {
        rt.counters = initialIconBoxLineEnableCounters();
        rt.colorBusy = false;
        rt.hasCompletedInitialEnable = false;
        rt.visualEnabled = true;
        rt.needsFlushAfterTween = false;
        outgoingGates.delete(boxId);
      } else {
        rt.counters = initialIconBoxLineEnableCounters();
        rt.visualEnabled = lineEnablePresentationEnabled(mode, rt.counters);
        rt.hasCompletedInitialEnable = rt.visualEnabled;
      }
      rt.lastEnabledByLine = mode;
    }

    if (mode === "off") {
      applyLineEnableFrameToHandles(handles, handles.instance, gridStrokeHex, true, 1);
      rt.visualEnabled = true;
      syncLineEnableDebugToStore(boxId);
      return;
    }

    /**
     * Paint from last **committed** visual state, not live `logical`, so the commit pipeline can tween
     * (`commitDebouncedVisual` compares `desired` vs `rt.visualEnabled`). Counters still update eagerly in `notifyTargetHit`.
     */
    const paintEnabled = rt.visualEnabled;
    applyLineEnableFrameToHandles(handles, handles.instance, gridStrokeHex, paintEnabled, paintEnabled ? 1 : 0);
    syncLineEnableDebugToStore(boxId);
  },

  detachHandles(boxId: string) {
    const rt = boxes.get(boxId);
    if (!rt) {
      return;
    }
    if (rt.debounceTimer) {
      clearTimeout(rt.debounceTimer);
      rt.debounceTimer = undefined;
    }
    rt.presentationEpoch += 1;
    rt.needsFlushAfterTween = false;
    rt.handles = null;
    syncLineEnableDebugToStore(boxId);
  },

  removeBox(boxId: string) {
    const rt = boxes.get(boxId);
    if (rt?.debounceTimer) {
      clearTimeout(rt.debounceTimer);
    }
    boxes.delete(boxId);
    outgoingGates.delete(boxId);
    useAppStore.getState().patchIconBoxLineEnableDebug(boxId, null);
  },

  notifyTargetHit(args: { connectorId: string; leg: "forward" | "backward"; boxId: string }) {
    const instances = instancesSnapshot();
    const inst = instances.find((i) => i.id === args.boxId);
    if (!inst || !isIconBoxInstance(inst)) {
      return;
    }
    const conn = instances.find((i) => i.id === args.connectorId);
    if (!conn || conn.type !== "connector-line") {
      return;
    }
    if (conn.props.target.kind !== "layer" || conn.props.target.instanceId !== args.boxId) {
      return;
    }
    const mode = inst.props.enabledByLine;
    if (mode === "off") {
      return;
    }

    if (mode === "iterated" && args.leg === "backward") {
      return;
    }

    let rt = boxes.get(args.boxId);
    if (!rt) {
      rt = {
        counters: initialIconBoxLineEnableCounters(),
        debounceTimer: undefined,
        visualCommitChain: undefined,
        colorBusy: false,
        hasCompletedInitialEnable: false,
        visualEnabled: false,
        handles: null,
        gridStrokeHex: "#F3F3F3",
        lastEnabledByLine: mode,
        needsFlushAfterTween: false,
        presentationEpoch: 0,
      };
      boxes.set(args.boxId, rt);
    }

    rt.counters = applyHitToLineEnableState(mode, rt.counters, args.leg);
    iconBoxLineEnableCoordinator.refreshOutgoingGateForSource(args.boxId);
    iconBoxLineEnableCoordinator.scheduleDebouncedVisual(args.boxId);
    syncLineEnableDebugToStore(args.boxId);
  },

  scheduleDebouncedVisual(boxId: string) {
    const rt = boxes.get(boxId);
    if (!rt) {
      return;
    }
    if (rt.debounceTimer) {
      clearTimeout(rt.debounceTimer);
    }
    rt.debounceTimer = setTimeout(() => {
      rt.debounceTimer = undefined;
      const prev = rt.visualCommitChain ?? Promise.resolve();
      rt.visualCommitChain = prev.catch(() => {}).then(() => iconBoxLineEnableCoordinator.commitDebouncedVisual(boxId));
      void rt.visualCommitChain;
    }, LINE_ENABLE_SCHEDULE_COALESCE_MS);
  },

  /** Iterated: one full pulse cycle completed on a layer-source connector (throw back to source box). */
  notifyOutgoingCycleComplete(sourceLayerId: string) {
    applyIteratedCycleDecrementForBox(sourceLayerId);
  },

  /**
   * Iterated: pulse **reversed** off the connector's layer target (backward leg about to run). Not used when
   * source is a layer on the same box — `notifyOutgoingCycleComplete` runs at full cycle end for that case.
   */
  notifyTargetLayerPulseCycleComplete(args: { connectorId: string; targetLayerId: string }) {
    const instances = instancesSnapshot();
    const conn = instances.find((i) => i.id === args.connectorId);
    if (!conn || conn.type !== "connector-line") {
      return;
    }
    if (conn.props.target.kind !== "layer" || conn.props.target.instanceId !== args.targetLayerId) {
      return;
    }
    if (conn.props.source.kind === "layer" && conn.props.source.instanceId === args.targetLayerId) {
      return;
    }
    applyIteratedCycleDecrementForBox(args.targetLayerId);
  },

  async commitDebouncedVisual(boxId: string) {
    try {
      let rt = boxes.get(boxId);
      if (!rt?.handles) {
        return;
      }
      let instances = instancesSnapshot();
      let inst = instances.find((i) => i.id === boxId);
      if (!inst || !isIconBoxInstance(inst)) {
        return;
      }
      let mode = inst.props.enabledByLine;
      if (mode === "off") {
        return;
      }

      while (true) {
        rt = boxes.get(boxId);
        if (!rt?.handles) {
          return;
        }
        if (!rt.colorBusy) {
          break;
        }
        await new Promise<void>((r) => setTimeout(r, 24));
      }

      rt = boxes.get(boxId);
      if (!rt?.handles) {
        return;
      }
      instances = instancesSnapshot();
      inst = instances.find((i) => i.id === boxId);
      if (!inst || !isIconBoxInstance(inst)) {
        return;
      }
      mode = inst.props.enabledByLine;
      if (mode === "off") {
        return;
      }

      const desiredAfterIdle = lineEnablePresentationEnabled(mode, rt.counters);
      const skipPostIdleSettle = desiredAfterIdle && !rt.hasCompletedInitialEnable;

      if (!skipPostIdleSettle) {
        await new Promise<void>((r) => setTimeout(r, LINE_ENABLE_DEBOUNCE_MS));
      }

      rt = boxes.get(boxId);
      if (!rt?.handles) {
        return;
      }
      instances = instancesSnapshot();
      inst = instances.find((i) => i.id === boxId);
      if (!inst || !isIconBoxInstance(inst)) {
        return;
      }
      mode = inst.props.enabledByLine;
      if (mode === "off") {
        return;
      }

      const desired = lineEnablePresentationEnabled(mode, rt.counters);
      iconBoxLineEnableCoordinator.refreshOutgoingGateForSource(boxId);

      if (desired === rt.visualEnabled) {
        return;
      }

      const firstIntoEnabled = desired && !rt.hasCompletedInitialEnable;

      if (!firstIntoEnabled && rt.colorBusy) {
        rt.needsFlushAfterTween = true;
        return;
      }

      const fromEnabled = rt.visualEnabled;
      await iconBoxLineEnableCoordinator.runPresentationTween(
        inst as IconBoxRenderableInstance,
        fromEnabled,
        desired,
        rt,
      );

      rt.visualEnabled = desired;
      if (desired) {
        rt.hasCompletedInitialEnable = true;
      } else {
        rt.hasCompletedInitialEnable = false;
      }

      if (rt.needsFlushAfterTween) {
        rt.needsFlushAfterTween = false;
        iconBoxLineEnableCoordinator.scheduleDebouncedVisual(boxId);
      }
    } finally {
      syncLineEnableDebugToStore(boxId);
    }
  },

  async runPresentationTween(
    instance: IconBoxRenderableInstance,
    fromEnabled: boolean,
    toEnabled: boolean,
    rt: BoxRuntime,
  ) {
    const handles = rt.handles;
    if (!handles) {
      return;
    }
    const gridStrokeHex = rt.gridStrokeHex;
    const fromCols = computeLineEnablePackedColors(instance, gridStrokeHex, fromEnabled);
    const toCols = computeLineEnablePackedColors(instance, gridStrokeHex, toEnabled);

    const progress = motionValue(0);
    const epochAtStart = rt.presentationEpoch;
    rt.colorBusy = true;

    const unsub = progress.on("change", (t) => {
      const titleBg = lerpPackedRgb(fromCols.titleBg, toCols.titleBg, t);
      const titleText = lerpPackedRgb(fromCols.titleText, toCols.titleText, t);
      const iconRgb = lerpPackedRgb(fromCols.icon, toCols.icon, t);
      const corner = lerpPackedRgb(fromCols.corner, toCols.corner, t);
      paintTitleBg(handles.titleBg, handles.titleBarLayout.barLeft, handles.titleBarLayout.rectWidth, titleBg);
      handles.titleLabel.style.fill = `#${titleText.toString(16).padStart(6, "0")}`;
      for (const sp of handles.iconSprites) {
        sp.tint = iconRgb;
      }
      handles.markersRedraw(corner);
      const scale01 = toEnabled ? t : 1 - t;
      const scale = instance.props.theme !== "neutral" ? scale01 : 0;
      for (const { scaleRoot } of handles.accentScaleRoots) {
        scaleRoot.scale.x = scale;
      }
    });

    const ctrl = animate(progress, 1, {
      duration: LINE_ENABLE_COLOR_DURATION_SEC,
      ease: LINE_ENABLE_EASE,
    });

    await ctrl.finished;
    unsub();
    rt.colorBusy = false;

    if (epochAtStart !== rt.presentationEpoch) {
      return;
    }

    applyLineEnableFrameToHandles(handles, instance, gridStrokeHex, toEnabled, toEnabled ? 1 : 0);
  },

  async waitForOutgoingPulseSlot(args: { connectorId: string; sourceLayerId: string; isCancelled: () => boolean }) {
    const instances = instancesSnapshot();
    const props = getIconBoxPropsOrUndefined(instances, args.sourceLayerId);
    if (!props || !shouldGateOutgoingPulses(props.enabledByLine)) {
      return;
    }

    const pollMs = 32;
    while (!args.isCancelled()) {
      if (iconBoxLineEnableCoordinator.tryAcquireOutgoingPulseSlot(args.connectorId, args.sourceLayerId)) {
        return;
      }
      await new Promise<void>((r) => setTimeout(r, pollMs));
    }
  },

  tryAcquireOutgoingPulseSlot(connectorId: string, sourceLayerId: string): boolean {
    const instances = instancesSnapshot();
    const props = getIconBoxPropsOrUndefined(instances, sourceLayerId);
    if (!props || !shouldGateOutgoingPulses(props.enabledByLine)) {
      return true;
    }

    const rt = boxes.get(sourceLayerId);
    const counters = rt?.counters ?? initialIconBoxLineEnableCounters();
    const logical = lineEnablePresentationEnabled(props.enabledByLine, counters);
    const budget = iconBoxOutgoingBudget(props.enabledByLine, logical, counters);

    if (!Number.isFinite(budget)) {
      return true;
    }

    const ordered = listOutgoingConnectorsFromLayerSource(instances, sourceLayerId);
    const gate = outgoingGates.get(sourceLayerId) ?? createOutgoingPulseGateState();
    const { granted, state } = tryAcquireOutgoingPulseSlot(ordered, budget, connectorId, gate);
    outgoingGates.set(sourceLayerId, state);
    syncLineEnableDebugToStore(sourceLayerId);
    return granted;
  },

  releaseOutgoingPulseCycleSlot(args: { connectorId: string; sourceLayerId: string }) {
    const instances = instancesSnapshot();
    const props = getIconBoxPropsOrUndefined(instances, args.sourceLayerId);
    if (!props || !shouldGateOutgoingPulses(props.enabledByLine)) {
      return;
    }

    const rt = boxes.get(args.sourceLayerId);
    const counters = rt?.counters ?? initialIconBoxLineEnableCounters();
    const logical = lineEnablePresentationEnabled(props.enabledByLine, counters);
    const budget = iconBoxOutgoingBudget(props.enabledByLine, logical, counters);

    if (!Number.isFinite(budget)) {
      return;
    }

    const ordered = listOutgoingConnectorsFromLayerSource(instances, args.sourceLayerId);
    const gate = outgoingGates.get(args.sourceLayerId) ?? createOutgoingPulseGateState();
    outgoingGates.set(args.sourceLayerId, releaseOutgoingPulseSlot(ordered, budget, args.connectorId, gate));
    iconBoxLineEnableCoordinator.notifyOutgoingCycleComplete(args.sourceLayerId);
    syncLineEnableDebugToStore(args.sourceLayerId);
  },

  refreshOutgoingGateForSource(sourceLayerId: string) {
    const instances = instancesSnapshot();
    const props = getIconBoxPropsOrUndefined(instances, sourceLayerId);
    if (!props || !shouldGateOutgoingPulses(props.enabledByLine)) {
      outgoingGates.delete(sourceLayerId);
      syncLineEnableDebugToStore(sourceLayerId);
      return;
    }
    const rt = boxes.get(sourceLayerId);
    const counters = rt?.counters ?? initialIconBoxLineEnableCounters();
    const logical = lineEnablePresentationEnabled(props.enabledByLine, counters);
    const budget = iconBoxOutgoingBudget(props.enabledByLine, logical, counters);
    const gate = outgoingGates.get(sourceLayerId);
    if (Number.isFinite(budget) && budget <= 0) {
      outgoingGates.set(sourceLayerId, resetOutgoingPulseGate());
      syncLineEnableDebugToStore(sourceLayerId);
      return;
    }
    if (gate && Number.isFinite(budget) && gate.active.size > budget) {
      outgoingGates.set(sourceLayerId, resetOutgoingPulseGate());
    }
    syncLineEnableDebugToStore(sourceLayerId);
  },

  _getCounters(boxId: string) {
    return boxes.get(boxId)?.counters;
  },

  _resetAllForTests() {
    for (const rt of boxes.values()) {
      if (rt.debounceTimer) {
        clearTimeout(rt.debounceTimer);
      }
    }
    boxes.clear();
    outgoingGates.clear();
    useAppStore.getState().clearIconBoxLineEnableDebug();
  },

  /** Canvas teardown: drops runtime without preserving per-id counters. */
  clearRuntime() {
    for (const rt of boxes.values()) {
      if (rt.debounceTimer) {
        clearTimeout(rt.debounceTimer);
      }
    }
    boxes.clear();
    outgoingGates.clear();
    useAppStore.getState().clearIconBoxLineEnableDebug();
  },
};
