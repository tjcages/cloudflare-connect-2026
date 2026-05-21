import type { ComponentInstance, IconBoxEnabledByLineMode, IconBoxProps } from "../grid/types";
import { isIconBoxInstance } from "./icon-box/layout";

export const DEFAULT_ICON_BOX_ENABLED_BY_LINE: IconBoxEnabledByLineMode = "off";

export type IconBoxLineEnableCounters = {
  hitCount: number;
  onceLatched: boolean;
};

export const initialIconBoxLineEnableCounters = (): IconBoxLineEnableCounters => ({
  hitCount: 0,
  onceLatched: false,
});

export const isIconBoxLayerConnectorTarget = (instances: ComponentInstance[], boxId: string): boolean =>
  instances.some(
    (i) => i.type === "connector-line" && i.props.target.kind === "layer" && i.props.target.instanceId === boxId,
  );

/** Connector ids whose layer source is `boxId`, in document instance order. */
export const listOutgoingConnectorsFromLayerSource = (instances: ComponentInstance[], boxId: string): string[] =>
  instances
    .filter(
      (i) => i.type === "connector-line" && i.props.source.kind === "layer" && i.props.source.instanceId === boxId,
    )
    .map((i) => i.id);

export const getIconBoxPropsOrUndefined = (instances: ComponentInstance[], boxId: string): IconBoxProps | undefined => {
  const inst = instances.find((i) => i.id === boxId);
  if (!inst || !isIconBoxInstance(inst)) {
    return undefined;
  }
  return inst.props;
};

/** Logical presentation (before Motion debounce): themed vs gray-line-disabled. */
export const lineEnablePresentationEnabled = (
  mode: IconBoxEnabledByLineMode,
  counters: IconBoxLineEnableCounters,
): boolean => {
  if (mode === "off") {
    return true;
  }
  if (mode === "once") {
    return counters.onceLatched;
  }
  return counters.hitCount > 0;
};

/** Target-side pulse bookkeeping for global hitCount / once latch. */
export const applyHitToLineEnableState = (
  mode: IconBoxEnabledByLineMode,
  prior: IconBoxLineEnableCounters,
): IconBoxLineEnableCounters => {
  if (mode === "off") {
    return prior;
  }
  if (mode === "once") {
    return { hitCount: prior.hitCount, onceLatched: true };
  }
  return { hitCount: prior.hitCount + 1, onceLatched: prior.onceLatched };
};

export const iconBoxOutgoingBudget = (
  mode: IconBoxEnabledByLineMode,
  presentationEnabled: boolean,
  counters: IconBoxLineEnableCounters,
): number => {
  if (mode === "off" || !presentationEnabled) {
    return 0;
  }
  if (mode === "once") {
    return Number.POSITIVE_INFINITY;
  }
  return Math.max(0, counters.hitCount);
};

export const shouldGateOutgoingPulses = (mode: IconBoxEnabledByLineMode): boolean => mode !== "off";
