import {
  createComponentInstance,
  getComponentDefinition,
  snapComponentPosition,
  snapConnectorCellCenter,
} from "./lib/componentRegistry";
import { DEFAULT_CONFIG } from "./grid/config";
import { generateGrid } from "./grid/generator";
import type {
  ComponentInstance,
  ComponentType,
  ConnectorEndpoint,
  ConnectorLineProps,
  GeneratedGrid,
  GridConfig,
  IconBoxProps,
  PlusMarkerProps,
} from "./grid/types";
import { PALETTE_THEMES } from "./theme/palette";

export type PersistedDocumentSlice = {
  gridConfig: GridConfig;
  instances: ComponentInstance[];
  nextInstanceIndex: number;
  selectedInstanceId: string | null;
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const isFiniteNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

const isComponentType = (value: unknown): value is ComponentType =>
  value === "icon-box" || value === "plus-marker" || value === "connector-line";

const isPlusMarkerProps = (value: unknown): value is PlusMarkerProps => {
  if (!isRecord(value) || !("theme" in value) || typeof value.theme !== "string") {
    return false;
  }
  return PALETTE_THEMES.some((theme) => theme.id === value.theme);
};

const isIconBoxProps = (value: unknown): value is IconBoxProps => {
  if (!isRecord(value)) {
    return false;
  }

  if (!("matchCornersWithTheme" in value) || typeof value.matchCornersWithTheme !== "boolean") {
    return false;
  }

  if (!("theme" in value) || typeof value.theme !== "string") {
    return false;
  }

  if (!("iconId" in value) || typeof value.iconId !== "string") {
    return false;
  }

  if (!("title" in value) || typeof value.title !== "string") {
    return false;
  }

  if ("containerHighlighted" in value && typeof value.containerHighlighted !== "boolean") {
    return false;
  }

  return true;
};

const isConnectorEndpoint = (value: unknown): value is ConnectorEndpoint => {
  if (!isRecord(value) || typeof value.kind !== "string") {
    return false;
  }
  if (value.kind === "cell") {
    return isFiniteNumber(value.x) && isFiniteNumber(value.y);
  }
  if (value.kind === "layer") {
    return typeof value.instanceId === "string" && value.instanceId.length > 0;
  }
  return false;
};

const isConnectorLineProps = (value: unknown): value is ConnectorLineProps => {
  if (!isRecord(value)) {
    return false;
  }
  if (
    !(
      (value.preferredConnection === "horizontal" || value.preferredConnection === "vertical") &&
      isConnectorEndpoint(value.source) &&
      isConnectorEndpoint(value.target)
    )
  ) {
    return false;
  }
  if ("overlayGrid" in value && typeof value.overlayGrid !== "boolean") {
    return false;
  }
  if ("animated" in value && typeof value.animated !== "boolean") {
    return false;
  }
  return true;
};

const isGridConfigLike = (value: unknown): value is GridConfig => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.seed === "string" &&
    isFiniteNumber(value.width) &&
    isFiniteNumber(value.height) &&
    isFiniteNumber(value.density) &&
    isFiniteNumber(value.smallCellRatio) &&
    isFiniteNumber(value.largeCellRatio) &&
    typeof value.strokeColor === "string" &&
    Array.isArray(value.gapMask)
  );
};

const normalizeInstanceForGrid = (
  raw: unknown,
  gridLogicalWidth: number,
  gridLogicalHeight: number,
): ComponentInstance | null => {
  if (!isRecord(raw)) {
    return null;
  }

  if (!isComponentType(raw.type)) {
    return null;
  }

  if (typeof raw.id !== "string" || raw.id.length === 0) {
    return null;
  }

  if (!isFiniteNumber(raw.x) || !isFiniteNumber(raw.y)) {
    return null;
  }

  const definition = getComponentDefinition(raw.type);
  const name = typeof raw.name === "string" && raw.name.trim() ? raw.name : definition.label;
  if (raw.type === "connector-line") {
    const defaultProps = definition.defaultProps as ConnectorLineProps;
    let propsCandidate: unknown = raw.props;
    if (
      isRecord(propsCandidate) &&
      "overlayGrid" in propsCandidate &&
      typeof propsCandidate.overlayGrid !== "boolean"
    ) {
      const { overlayGrid: _drop, ...rest } = propsCandidate;
      propsCandidate = rest;
    }
    if (isRecord(propsCandidate) && "animated" in propsCandidate && typeof propsCandidate.animated !== "boolean") {
      const { animated: _dropA, ...rest } = propsCandidate;
      propsCandidate = rest;
    }
    const rawProps = isConnectorLineProps(propsCandidate) ? propsCandidate : defaultProps;
    const normalizeEndpoint = (endpoint: ConnectorEndpoint): ConnectorEndpoint => {
      if (endpoint.kind === "layer") {
        return endpoint;
      }
      return { kind: "cell", ...snapConnectorCellCenter(endpoint.x, endpoint.y, gridLogicalWidth, gridLogicalHeight) };
    };
    const snapped = snapConnectorCellCenter(raw.x, raw.y, gridLogicalWidth, gridLogicalHeight);

    return {
      id: raw.id,
      type: raw.type,
      name,
      x: snapped.x,
      y: snapped.y,
      props: {
        ...defaultProps,
        ...rawProps,
        source: normalizeEndpoint(rawProps.source),
        target: normalizeEndpoint(rawProps.target),
      },
    };
  }

  if (raw.type === "plus-marker") {
    const defaultProps = definition.defaultProps as PlusMarkerProps;
    const props = isPlusMarkerProps(raw.props) ? { ...defaultProps, ...raw.props } : defaultProps;
    const snapped = snapComponentPosition(raw.x, raw.y, gridLogicalWidth, gridLogicalHeight, raw.type);

    return {
      id: raw.id,
      type: raw.type,
      name,
      x: snapped.x,
      y: snapped.y,
      props,
    };
  }

  const props: IconBoxProps = isIconBoxProps(raw.props)
    ? { ...(definition.defaultProps as IconBoxProps), ...raw.props }
    : { ...(definition.defaultProps as IconBoxProps) };

  const snapped = snapComponentPosition(raw.x, raw.y, gridLogicalWidth, gridLogicalHeight, raw.type);

  return {
    id: raw.id,
    type: raw.type,
    name,
    x: snapped.x,
    y: snapped.y,
    props,
  };
};

const defaultInstancesForGrid = (gridLogicalWidth: number, gridLogicalHeight: number): ComponentInstance[] => [
  createComponentInstance("icon-box", 0, 0, 1, gridLogicalWidth, gridLogicalHeight),
];

const sanitizeInstances = (raw: unknown, gridLogicalWidth: number, gridLogicalHeight: number): ComponentInstance[] => {
  if (!Array.isArray(raw)) {
    return defaultInstancesForGrid(gridLogicalWidth, gridLogicalHeight);
  }

  return raw
    .map((item) => normalizeInstanceForGrid(item, gridLogicalWidth, gridLogicalHeight))
    .filter((x): x is ComponentInstance => x !== null);
};

const maxInstanceOrdinal = (instances: ComponentInstance[]): number => {
  let max = 0;
  for (const inst of instances) {
    const m = /^(?:icon-box|plus-marker|connector-line)-(\d+)$/.exec(inst.id);
    if (m) {
      max = Math.max(max, Number(m[1]));
    }
  }
  return max;
};

const sanitizeNextInstanceIndex = (raw: unknown, instances: ComponentInstance[]): number => {
  const fromIds = maxInstanceOrdinal(instances) + 1;
  const parsed = typeof raw === "number" && Number.isFinite(raw) ? Math.floor(raw) : 2;
  return Math.max(2, fromIds, parsed);
};

const sanitizeSelectedId = (raw: unknown, instances: ComponentInstance[]): string | null => {
  if (typeof raw !== "string") {
    return null;
  }

  return instances.some((i) => i.id === raw) ? raw : null;
};

/** Initial document slice used by the store and test resets. */
export const getDefaultDocumentSlice = (): PersistedDocumentSlice & { grid: GeneratedGrid } => {
  const gridConfig = DEFAULT_CONFIG;
  const grid = generateGrid(gridConfig);
  return {
    gridConfig,
    grid,
    instances: defaultInstancesForGrid(grid.config.logicalWidth, grid.config.logicalHeight),
    selectedInstanceId: null,
    nextInstanceIndex: 2,
  };
};

type DocumentMergeFields = PersistedDocumentSlice & { grid: GeneratedGrid };

/**
 * Recombine persisted (partial) document state with the live store. Regenerates `grid` from `gridConfig`.
 */
export const mergePersistedDocument = <T extends DocumentMergeFields & Record<string, unknown>>(
  persistedState: unknown,
  currentState: T,
): T => {
  if (!isRecord(persistedState)) {
    return currentState;
  }

  if (!isGridConfigLike(persistedState.gridConfig)) {
    return currentState;
  }

  const persistedGrid = persistedState.gridConfig as GridConfig & { overlayGrid?: unknown };
  const { overlayGrid: _legacyDocumentOverlay, ...restPersistedGrid } = persistedGrid;
  const gridConfig: GridConfig = {
    ...DEFAULT_CONFIG,
    ...restPersistedGrid,
    connectorAnimationEnabled:
      typeof restPersistedGrid.connectorAnimationEnabled === "boolean"
        ? restPersistedGrid.connectorAnimationEnabled
        : DEFAULT_CONFIG.connectorAnimationEnabled,
  };

  const grid = generateGrid(gridConfig);
  const instances = sanitizeInstances(persistedState.instances, grid.config.logicalWidth, grid.config.logicalHeight);
  const nextInstanceIndex = sanitizeNextInstanceIndex(persistedState.nextInstanceIndex, instances);
  const selectedInstanceId = sanitizeSelectedId(persistedState.selectedInstanceId, instances);

  return {
    ...currentState,
    gridConfig,
    grid,
    instances,
    nextInstanceIndex,
    selectedInstanceId,
  };
};
