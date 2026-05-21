import { getComponentDefinition, snapComponentPosition, snapConnectorCellCenter } from "./lib/componentRegistry";
import { normalizeCodeSnippetProps } from "./lib/code-snippet/layout";
import { migrateLegacyIconBoxRaw, normalizeIconBoxProps } from "./lib/icon-box/layout";
import { DEFAULT_CONFIG } from "./grid/config";
import { generateGrid } from "./grid/generator";
import type {
  CodeSnippetLanguage,
  CodeSnippetProps,
  ComponentInstance,
  ComponentType,
  ConnectorEndpoint,
  ConnectorLineProps,
  GeneratedGrid,
  GridConfig,
  IconBoxEnabledByLineMode,
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

const isPersistedComponentType = (value: unknown): value is ComponentType | "icon-box-2x1" | "icon-box-1x2" =>
  value === "icon-box" ||
  value === "icon-box-2x1" ||
  value === "icon-box-1x2" ||
  value === "plus-marker" ||
  value === "rect-marker" ||
  value === "connector-line" ||
  value === "code-snippet";

const CODE_SNIPPET_LANGUAGES: CodeSnippetLanguage[] = ["auto", "javascript", "typescript", "json", "bash", "text"];

const isCodeSnippetProps = (value: unknown): value is CodeSnippetProps => {
  if (!isRecord(value)) {
    return false;
  }
  if (!("code" in value) || typeof value.code !== "string") {
    return false;
  }
  if (!("language" in value) || !CODE_SNIPPET_LANGUAGES.includes(value.language as CodeSnippetLanguage)) {
    return false;
  }
  if (!("theme" in value) || typeof value.theme !== "string") {
    return false;
  }
  if ("widthCells" in value && (!isFiniteNumber(value.widthCells) || value.widthCells < 2)) {
    return false;
  }
  if ("heightCells" in value && (!isFiniteNumber(value.heightCells) || value.heightCells < 2)) {
    return false;
  }
  return true;
};

const isPlusMarkerProps = (value: unknown): value is PlusMarkerProps => {
  if (!isRecord(value) || !("theme" in value) || typeof value.theme !== "string") {
    return false;
  }
  return PALETTE_THEMES.some((theme) => theme.id === value.theme);
};

const isIconBoxEnabledByLineMode = (value: unknown): value is IconBoxEnabledByLineMode =>
  value === "off" || value === "once" || value === "iterated";

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

  if ("enabledByLine" in value && !isIconBoxEnabledByLineMode(value.enabledByLine)) {
    return false;
  }

  if ("length" in value && (!isFiniteNumber(value.length) || value.length < 1)) {
    return false;
  }

  if ("direction" in value && value.direction !== "horizontal" && value.direction !== "vertical") {
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
  if ("style" in value && value.style !== "solid" && value.style !== "dashed") {
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

  if (!isPersistedComponentType(raw.type)) {
    return null;
  }

  if (typeof raw.id !== "string" || raw.id.length === 0) {
    return null;
  }

  if (!isFiniteNumber(raw.x) || !isFiniteNumber(raw.y)) {
    return null;
  }

  const definition = getComponentDefinition(
    raw.type === "icon-box-2x1" || raw.type === "icon-box-1x2" ? "icon-box" : raw.type,
  );
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
    if (
      isRecord(propsCandidate) &&
      "style" in propsCandidate &&
      propsCandidate.style !== "solid" &&
      propsCandidate.style !== "dashed"
    ) {
      const { style: _dropS, ...rest } = propsCandidate;
      propsCandidate = rest;
    }
    if (isRecord(propsCandidate) && "staticEndLeg" in propsCandidate) {
      const { staticEndLeg: _dropE, ...rest } = propsCandidate;
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

  if (raw.type === "plus-marker" || raw.type === "rect-marker") {
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

  if (raw.type === "code-snippet") {
    const defaultSnippet = getComponentDefinition("code-snippet").defaultProps as CodeSnippetProps;
    const props = isCodeSnippetProps(raw.props) ? normalizeCodeSnippetProps(raw.props, defaultSnippet) : defaultSnippet;
    const snapped = snapComponentPosition(raw.x, raw.y, gridLogicalWidth, gridLogicalHeight, "code-snippet", props);

    return {
      id: raw.id,
      type: "code-snippet",
      name,
      x: snapped.x,
      y: snapped.y,
      props,
    };
  }

  if (raw.type === "icon-box" || raw.type === "icon-box-2x1" || raw.type === "icon-box-1x2") {
    const defaultIcon = getComponentDefinition("icon-box").defaultProps as IconBoxProps;
    const propsMerged: IconBoxProps = isIconBoxProps(raw.props)
      ? normalizeIconBoxProps(raw.props, defaultIcon)
      : { ...defaultIcon };
    const props: IconBoxProps = {
      ...propsMerged,
      enabledByLine: isIconBoxEnabledByLineMode(propsMerged.enabledByLine) ? propsMerged.enabledByLine : "off",
    };
    const { type, props: migratedProps } = migrateLegacyIconBoxRaw(raw.type, props);
    const snapped = snapComponentPosition(raw.x, raw.y, gridLogicalWidth, gridLogicalHeight, "icon-box", migratedProps);

    return {
      id: raw.id,
      type,
      name,
      x: snapped.x,
      y: snapped.y,
      props: migratedProps,
    };
  }

  return null;
};

const defaultInstancesForGrid = (_gridLogicalWidth: number, _gridLogicalHeight: number): ComponentInstance[] => [
  {
    id: "icon-box-2x1-14",
    type: "icon-box",
    name: "Icon Box 2x1 14",
    x: 0,
    y: 372,
    props: {
      matchCornersWithTheme: false,
      theme: "purple",
      iconId: "section-mark",
      title: "Workers 4",
      containerHighlighted: false,
      enabledByLine: "off",
      length: 2,
      direction: "horizontal",
    },
  },
  {
    id: "rect-marker-16",
    type: "rect-marker",
    name: "Rect Marker 16",
    x: 558,
    y: 478,
    props: {
      theme: "orange",
    },
  },
  {
    id: "rect-marker-15",
    type: "rect-marker",
    name: "Rect Marker 15",
    x: 438,
    y: 358,
    props: {
      theme: "orange",
    },
  },
  {
    id: "rect-marker-10",
    type: "rect-marker",
    name: "Rect Marker 10",
    x: 398,
    y: 478,
    props: {
      theme: "purple",
    },
  },
  {
    id: "plus-marker-6",
    type: "plus-marker",
    name: "Plus Marker 6",
    x: 240,
    y: 520,
    props: {
      theme: "orange",
    },
  },
  {
    id: "plus-marker-5",
    type: "plus-marker",
    name: "Plus Marker 5",
    x: 400,
    y: 0,
    props: {
      theme: "orange",
    },
  },
  {
    id: "plus-marker-4",
    type: "plus-marker",
    name: "Plus Marker 4",
    x: 80,
    y: 280,
    props: {
      theme: "orange",
    },
  },
  {
    id: "icon-box-11",
    type: "icon-box",
    name: "Icon Box 11",
    x: 480,
    y: 292,
    props: {
      matchCornersWithTheme: true,
      theme: "orange",
      iconId: "isometric-hex",
      title: "Durable Objects 3",
      containerHighlighted: true,
      enabledByLine: "off",
      length: 1,
      direction: "horizontal",
    },
  },
  {
    id: "icon-box-2",
    type: "icon-box",
    name: "Icon Box 2",
    x: 480,
    y: 132,
    props: {
      matchCornersWithTheme: true,
      theme: "orange",
      iconId: "isometric-hex",
      title: "Durable Objects 1",
      containerHighlighted: true,
      enabledByLine: "off",
      length: 1,
      direction: "horizontal",
    },
  },
  {
    id: "icon-box-12",
    type: "icon-box",
    name: "Icon Box 12",
    x: 240,
    y: 372,
    props: {
      matchCornersWithTheme: false,
      theme: "purple",
      iconId: "section-mark",
      title: "Workers 3",
      containerHighlighted: false,
      enabledByLine: "off",
      length: 1,
      direction: "horizontal",
    },
  },
  {
    id: "icon-box-7",
    type: "icon-box",
    name: "Icon Box 7",
    x: 240,
    y: 212,
    props: {
      matchCornersWithTheme: false,
      theme: "purple",
      iconId: "section-mark",
      title: "Workers 2",
      containerHighlighted: false,
      enabledByLine: "off",
      length: 1,
      direction: "horizontal",
    },
  },
  {
    id: "icon-box-1",
    type: "icon-box",
    name: "Icon Box 1",
    x: 320,
    y: 52,
    props: {
      matchCornersWithTheme: false,
      theme: "purple",
      iconId: "section-mark",
      title: "Workers 1",
      containerHighlighted: false,
      enabledByLine: "off",
      length: 1,
      direction: "horizontal",
    },
  },
  {
    id: "connector-line-3",
    type: "connector-line",
    name: "Connector Line 3",
    x: 280,
    y: 120,
    props: {
      preferredConnection: "horizontal",
      source: {
        kind: "layer",
        instanceId: "icon-box-2",
      },
      target: {
        kind: "layer",
        instanceId: "icon-box-1",
      },
      overlayGrid: true,
      animated: true,
      style: "solid",
    },
  },
  {
    id: "connector-line-9",
    type: "connector-line",
    name: "Connector Line 9",
    x: 200,
    y: 360,
    props: {
      preferredConnection: "horizontal",
      source: {
        kind: "layer",
        instanceId: "icon-box-7",
      },
      target: {
        kind: "layer",
        instanceId: "icon-box-2x1-14",
      },
      overlayGrid: true,
      animated: true,
      style: "solid",
    },
  },
  {
    id: "connector-line-13",
    type: "connector-line",
    name: "Connector Line 13",
    x: 200,
    y: 360,
    props: {
      preferredConnection: "horizontal",
      source: {
        kind: "layer",
        instanceId: "icon-box-12",
      },
      target: {
        kind: "layer",
        instanceId: "icon-box-2x1-14",
      },
      overlayGrid: true,
      animated: true,
      style: "solid",
    },
  },
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
    const m = /^(?:icon-box-2x1|icon-box-1x2|icon-box|plus-marker|rect-marker|connector-line)-(\d+)$/.exec(inst.id);
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

const sanitizeCanvasPan = (raw: unknown, fallback: { x: number; y: number }): { x: number; y: number } => {
  if (!isRecord(raw)) {
    return fallback;
  }

  const x = isFiniteNumber(raw.x) ? raw.x : fallback.x;
  const y = isFiniteNumber(raw.y) ? raw.y : fallback.y;
  return { x, y };
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
    nextInstanceIndex: 17,
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

  const persistedGrid = persistedState.gridConfig as GridConfig & {
    overlayGrid?: unknown;
    connectorAnimationEnabled?: unknown;
  };
  const {
    overlayGrid: _legacyDocumentOverlay,
    connectorAnimationEnabled: _legacyConnectorAnimation,
    ...restPersistedGrid
  } = persistedGrid;
  const gridConfig: GridConfig = {
    ...DEFAULT_CONFIG,
    ...restPersistedGrid,
  };

  const grid = generateGrid(gridConfig);
  const instances = sanitizeInstances(persistedState.instances, grid.config.logicalWidth, grid.config.logicalHeight);
  const nextInstanceIndex = sanitizeNextInstanceIndex(persistedState.nextInstanceIndex, instances);
  const selectedInstanceId = sanitizeSelectedId(persistedState.selectedInstanceId, instances);
  const canvasPan = sanitizeCanvasPan(
    "canvasPan" in persistedState ? persistedState.canvasPan : undefined,
    sanitizeCanvasPan("canvasPan" in currentState ? currentState.canvasPan : undefined, { x: 0, y: 0 }),
  );

  return {
    ...currentState,
    gridConfig,
    grid,
    instances,
    nextInstanceIndex,
    selectedInstanceId,
    canvasPan,
  };
};
