import { DEFAULT_CONFIG } from "../grid/config";
import type {
  ComponentInstance,
  ComponentProps,
  ComponentType,
  ConnectorEndpoint,
  ConnectorLineProps,
  GapMask,
  GridConfig,
  IconBoxProps,
  IconId,
} from "../grid/types";
import { PALETTE_THEMES, type PaletteThemeId } from "../theme/palette";
import { getComponentDefinition } from "./componentRegistry";
import { layoutSpecFromLegacyType, normalizeIconBoxProps } from "./icon-box/layout";

/** Inner zustand `partialize` document slice (not the `{ state, version }` envelope). */
export type BuilderDocumentSnapshot = {
  gridConfig: GridConfig;
  instances: ComponentInstance[];
  nextInstanceIndex: number;
  selectedInstanceId: string | null;
  canvasPan: { x: number; y: number };
};

export type BuilderDocumentSnapshotSource = {
  gridConfig: GridConfig;
  instances: ComponentInstance[];
  nextInstanceIndex: number;
  selectedInstanceId: string | null;
  canvasPan: { x: number; y: number };
};

const COMPACT_V1 = 1 as const;
const COMPACT_V2 = 2 as const;
const COMPACT_V3 = 3 as const;
const COMPACT_V4 = 4 as const;
const GZIP_PREFIX = "z:";

const THEME_TO_CODE = Object.fromEntries(PALETTE_THEMES.map((theme, index) => [theme.id, index])) as Record<
  PaletteThemeId,
  number
>;
const CODE_TO_THEME = PALETTE_THEMES.map((theme) => theme.id);

/** Current compact type table (v4+). */
const COMPONENT_TYPE_CODES: ComponentType[] = ["icon-box", "plus-marker", "rect-marker", "connector-line"];

/** Pre-unification v2/v3 type table — kept for share import only. */
const LEGACY_COMPONENT_TYPE_CODES = [
  "icon-box",
  "icon-box-2x1",
  "plus-marker",
  "rect-marker",
  "connector-line",
  "icon-box-1x2",
] as const;

const TYPE_TO_CODE = Object.fromEntries(COMPONENT_TYPE_CODES.map((type, index) => [type, index])) as Record<
  ComponentType,
  number
>;

const PICKABLE_ICON_IDS: IconId[] = ["section-mark", "isometric-hex", "user-outline"];
const ICON_ID_TO_CODE = Object.fromEntries(PICKABLE_ICON_IDS.map((id, index) => [id, index])) as Record<IconId, number>;
const CODE_TO_ICON_ID = PICKABLE_ICON_IDS;

type CompactGridSparse = {
  s: string;
  w?: number;
  h?: number;
  d?: number;
  r?: number | [number, number];
  c?: string;
  m?: GapMask;
};

type CompactV1GridTuple =
  | [string, number, number, number, number, string, GapMask]
  | [string, number, number, number, number, number, string, GapMask];

type CompactV1Wire = {
  v: typeof COMPACT_V1;
  g: CompactV1GridTuple;
  l: [string, string, string, number, number, ComponentProps][];
  n: number;
  s: string | null;
  p: [number, number];
};

type CompactWire = {
  v: typeof COMPACT_V2 | typeof COMPACT_V3 | typeof COMPACT_V4;
  g: CompactGridSparse;
  l: CompactLayerRow[];
  n: number;
  s?: string;
  p?: [number, number];
};

type CompactV2Wire = CompactWire & { v: typeof COMPACT_V2 };
type CompactV4Wire = CompactWire & { v: typeof COMPACT_V4 };

type CompactEndpointWire = [0, number, number] | [1, number] | [1, string];

/** [typeCode, id, x, y] | [typeCode, id, x, y, propsDelta] | [typeCode, id, x, y, customName] | [typeCode, id, x, y, propsDelta, customName] */
type CompactLayerRow = [number, string, number, number, ...Array<string | Record<string, unknown>>];

export const getBuilderDocumentSnapshot = (state: BuilderDocumentSnapshotSource): BuilderDocumentSnapshot => ({
  gridConfig: state.gridConfig,
  instances: state.instances,
  nextInstanceIndex: state.nextInstanceIndex,
  selectedInstanceId: state.selectedInstanceId,
  canvasPan: state.canvasPan,
});

const gapMaskHasCells = (mask: GapMask) => mask.some((row) => row.some(Boolean));

const toCompactGrid = (gridConfig: GridConfig): CompactGridSparse => {
  const g: CompactGridSparse = { s: gridConfig.seed };
  if (gridConfig.width !== DEFAULT_CONFIG.width) {
    g.w = gridConfig.width;
  }
  if (gridConfig.height !== DEFAULT_CONFIG.height) {
    g.h = gridConfig.height;
  }
  if (gridConfig.density !== DEFAULT_CONFIG.density) {
    g.d = gridConfig.density;
  }
  if (gridConfig.smallCellRatio !== DEFAULT_CONFIG.smallCellRatio) {
    g.r = gridConfig.smallCellRatio;
  }
  if (gridConfig.strokeColor !== DEFAULT_CONFIG.strokeColor) {
    g.c = gridConfig.strokeColor;
  }
  if (gapMaskHasCells(gridConfig.gapMask)) {
    g.m = gridConfig.gapMask;
  }
  return g;
};

const fromCompactGrid = (g: CompactGridSparse): GridConfig => ({
  seed: g.s,
  width: g.w ?? DEFAULT_CONFIG.width,
  height: g.h ?? DEFAULT_CONFIG.height,
  density: g.d ?? DEFAULT_CONFIG.density,
  smallCellRatio: Array.isArray(g.r)
    ? (g.r[0] ?? DEFAULT_CONFIG.smallCellRatio)
    : typeof g.r === "number"
      ? g.r
      : DEFAULT_CONFIG.smallCellRatio,
  strokeColor: g.c ?? DEFAULT_CONFIG.strokeColor,
  gapMask: g.m ?? [],
});

const compactIconBoxPropsDelta = (
  defaults: ComponentProps,
  props: ComponentProps,
): Record<string, unknown> | undefined => {
  const delta: Record<string, unknown> = {};
  const iconDefaults = defaults as Record<string, unknown>;
  const iconProps = props as Record<string, unknown>;

  for (const key of Object.keys(iconProps)) {
    const value = iconProps[key];
    const defaultValue = iconDefaults[key];
    if (JSON.stringify(value) === JSON.stringify(defaultValue)) {
      continue;
    }

    if (key === "iconId" && typeof value === "string" && value in ICON_ID_TO_CODE) {
      delta.i = ICON_ID_TO_CODE[value as IconId];
      continue;
    }

    if (key === "matchCornersWithTheme" && value === true) {
      delta.m = 1;
      continue;
    }

    if (key === "containerHighlighted" && value === true) {
      delta.h = 1;
      continue;
    }

    if (key === "enabledByLine" && value !== "off") {
      delta.e = value;
      continue;
    }

    if (key === "theme" && typeof value === "string" && value in THEME_TO_CODE) {
      delta.t = THEME_TO_CODE[value as PaletteThemeId];
      continue;
    }

    if (key === "title") {
      delta.T = value;
      continue;
    }

    if (key === "length" && typeof value === "number" && value !== 1) {
      delta.l = value;
      continue;
    }

    if (key === "direction" && value === "vertical") {
      delta.d = "v";
      continue;
    }

    delta[key] = value;
  }

  return Object.keys(delta).length ? delta : undefined;
};

const expandIconBoxPropsDelta = (defaults: ComponentProps, delta?: Record<string, unknown>): ComponentProps => {
  if (!delta) {
    return defaults;
  }

  const props = { ...(defaults as Record<string, unknown>) };
  for (const [key, value] of Object.entries(delta)) {
    if (key === "i" && typeof value === "number" && CODE_TO_ICON_ID[value]) {
      props.iconId = CODE_TO_ICON_ID[value];
      continue;
    }
    if (key === "m") {
      props.matchCornersWithTheme = value === 1;
      continue;
    }
    if (key === "h") {
      props.containerHighlighted = value === 1;
      continue;
    }
    if (key === "e") {
      props.enabledByLine = value;
      continue;
    }
    if (key === "t") {
      props.theme = typeof value === "number" && CODE_TO_THEME[value] ? CODE_TO_THEME[value] : value;
      continue;
    }
    if (key === "T") {
      props.title = value;
      continue;
    }
    if (key === "l" && typeof value === "number") {
      props.length = value;
      continue;
    }
    if (key === "d") {
      props.direction = value === "v" ? "vertical" : "horizontal";
      continue;
    }
    props[key] = value;
  }

  return props as ComponentProps;
};

const themeToWire = (theme: unknown): unknown =>
  typeof theme === "string" && theme in THEME_TO_CODE ? THEME_TO_CODE[theme as PaletteThemeId] : theme;

const themeFromWire = (value: unknown): unknown =>
  typeof value === "number" && CODE_TO_THEME[value] ? CODE_TO_THEME[value] : value;

const compactEndpointWire = (endpoint: ConnectorEndpoint, idToIndex: Map<string, number>): CompactEndpointWire => {
  if (endpoint.kind === "cell") {
    return [0, endpoint.x, endpoint.y];
  }

  const index = idToIndex.get(endpoint.instanceId);
  return index !== undefined ? [1, index] : [1, endpoint.instanceId];
};

const expandEndpointWire = (wire: unknown, instanceIds: string[]): ConnectorEndpoint => {
  if (!Array.isArray(wire)) {
    return wire as ConnectorEndpoint;
  }

  if (wire[0] === 0 && typeof wire[1] === "number" && typeof wire[2] === "number") {
    return { kind: "cell", x: wire[1], y: wire[2] };
  }

  if (wire[0] === 1) {
    const second = wire[1];
    if (typeof second === "number") {
      return { kind: "layer", instanceId: instanceIds[second] ?? `layer-${second}` };
    }
    return { kind: "layer", instanceId: String(second) };
  }

  return wire as unknown as ConnectorEndpoint;
};

const compactConnectorPropsDelta = (
  defaults: ConnectorLineProps,
  props: ConnectorLineProps,
  idToIndex: Map<string, number>,
): Record<string, unknown> | undefined => {
  const delta: Record<string, unknown> = {};

  if (props.preferredConnection !== defaults.preferredConnection) {
    delta.p = props.preferredConnection === "vertical" ? 1 : 0;
  }

  if (
    JSON.stringify(compactEndpointWire(props.source, idToIndex)) !==
    JSON.stringify(compactEndpointWire(defaults.source, idToIndex))
  ) {
    delta.S = compactEndpointWire(props.source, idToIndex);
  }

  if (
    JSON.stringify(compactEndpointWire(props.target, idToIndex)) !==
    JSON.stringify(compactEndpointWire(defaults.target, idToIndex))
  ) {
    delta.T = compactEndpointWire(props.target, idToIndex);
  }

  if (props.overlayGrid !== defaults.overlayGrid) {
    delta.o = props.overlayGrid ? 1 : 0;
  }

  if (props.animated !== defaults.animated) {
    delta.a = props.animated ? 1 : 0;
  }

  return Object.keys(delta).length ? delta : undefined;
};

const expandConnectorPropsDelta = (
  defaults: ConnectorLineProps,
  delta: Record<string, unknown> | undefined,
  instanceIds: string[],
): ConnectorLineProps => {
  if (!delta) {
    return defaults;
  }

  return {
    preferredConnection: delta.p === 1 ? "vertical" : delta.p === 0 ? "horizontal" : defaults.preferredConnection,
    source: delta.S !== undefined ? expandEndpointWire(delta.S, instanceIds) : defaults.source,
    target: delta.T !== undefined ? expandEndpointWire(delta.T, instanceIds) : defaults.target,
    overlayGrid: delta.o !== undefined ? delta.o === 1 : defaults.overlayGrid,
    animated: delta.a !== undefined ? delta.a === 1 : defaults.animated,
  };
};

const compactMarkerPropsDelta = (
  defaults: ComponentProps,
  props: ComponentProps,
): Record<string, unknown> | undefined => {
  const propsRecord = props as Record<string, unknown>;
  const defaultRecord = defaults as Record<string, unknown>;
  if (JSON.stringify(propsRecord.theme) === JSON.stringify(defaultRecord.theme)) {
    return undefined;
  }

  return { t: themeToWire(propsRecord.theme) };
};

const pickPropsDelta = (
  type: ComponentType,
  props: ComponentProps,
  idToIndex?: Map<string, number>,
): Record<string, unknown> | undefined => {
  const defaults = getComponentDefinition(type).defaultProps;
  if (type === "icon-box") {
    return compactIconBoxPropsDelta(defaults, props);
  }

  if (type === "connector-line" && idToIndex) {
    return compactConnectorPropsDelta(defaults as ConnectorLineProps, props as ConnectorLineProps, idToIndex);
  }

  if ((type === "plus-marker" || type === "rect-marker") && idToIndex) {
    return compactMarkerPropsDelta(defaults, props);
  }

  const delta: Record<string, unknown> = {};
  const defaultRecord = defaults as Record<string, unknown>;
  const propsRecord = props as Record<string, unknown>;

  for (const key of Object.keys(propsRecord)) {
    if (JSON.stringify(propsRecord[key]) !== JSON.stringify(defaultRecord[key])) {
      delta[key] = propsRecord[key];
    }
  }

  return Object.keys(delta).length ? delta : undefined;
};

const expandPropsDelta = (
  type: ComponentType,
  delta: Record<string, unknown> | undefined,
  instanceIds: string[] = [],
): ComponentProps => {
  const defaults = getComponentDefinition(type).defaultProps;
  if (type === "icon-box") {
    return expandIconBoxPropsDelta(defaults, delta);
  }

  if (type === "connector-line") {
    return expandConnectorPropsDelta(defaults as ConnectorLineProps, delta, instanceIds);
  }

  if ((type === "plus-marker" || type === "rect-marker") && delta?.t !== undefined) {
    return { ...(defaults as Record<string, unknown>), theme: themeFromWire(delta.t) } as ComponentProps;
  }

  return { ...(defaults as Record<string, unknown>), ...delta } as ComponentProps;
};

const toCompactLayerRow = (instance: ComponentInstance, idToIndex?: Map<string, number>): CompactLayerRow => {
  const typeCode = TYPE_TO_CODE[instance.type];
  const definition = getComponentDefinition(instance.type);
  const propsDelta = pickPropsDelta(instance.type, instance.props, idToIndex);
  const customName = instance.name === definition.label ? undefined : instance.name;

  if (propsDelta && customName) {
    return [typeCode, instance.id, instance.x, instance.y, propsDelta, customName];
  }
  if (propsDelta) {
    return [typeCode, instance.id, instance.x, instance.y, propsDelta];
  }
  if (customName) {
    return [typeCode, instance.id, instance.x, instance.y, customName];
  }
  return [typeCode, instance.id, instance.x, instance.y];
};

const resolveCompactLayerType = (
  typeCode: number,
  version: typeof COMPACT_V2 | typeof COMPACT_V3 | typeof COMPACT_V4,
): { type: ComponentType; layoutMigration?: Pick<IconBoxProps, "length" | "direction"> } => {
  if (version === COMPACT_V4) {
    const type = COMPONENT_TYPE_CODES[typeCode];
    if (!type) {
      throw new Error(`Unknown component type code: ${typeCode}`);
    }
    return { type };
  }

  const legacyType = LEGACY_COMPONENT_TYPE_CODES[typeCode];
  if (!legacyType) {
    throw new Error(`Unknown component type code: ${typeCode}`);
  }

  const legacySpec = layoutSpecFromLegacyType(legacyType);
  if (legacySpec) {
    return { type: "icon-box", layoutMigration: legacySpec };
  }

  return { type: legacyType as ComponentType };
};

const fromCompactLayerRow = (
  row: CompactLayerRow,
  instanceIds: string[] = [],
  version: typeof COMPACT_V2 | typeof COMPACT_V3 | typeof COMPACT_V4 = COMPACT_V4,
): ComponentInstance => {
  const typeCode = row[0];
  const { type, layoutMigration } = resolveCompactLayerType(typeCode, version);

  const id = row[1];
  const x = row[2];
  const y = row[3];
  let propsDelta: Record<string, unknown> | undefined;
  let customName: string | undefined;

  if (row.length === 5) {
    const fourth = row[4];
    if (typeof fourth === "string") {
      customName = fourth;
    } else if (isRecord(fourth)) {
      propsDelta = fourth;
    }
  } else if (row.length === 6) {
    const fourth = row[4];
    const fifth = row[5];
    if (isRecord(fourth) && typeof fifth === "string") {
      propsDelta = fourth;
      customName = fifth;
    }
  }

  const definition = getComponentDefinition(type);
  const defaultProps = definition.defaultProps;
  let props = expandPropsDelta(type, Object.keys(propsDelta ?? {}).length ? propsDelta : undefined, instanceIds);
  if (type === "icon-box" && layoutMigration) {
    props = normalizeIconBoxProps({ ...(props as IconBoxProps), ...layoutMigration }, defaultProps as IconBoxProps);
  }

  return {
    id,
    type,
    name: customName ?? definition.label,
    x,
    y,
    props,
  } as ComponentInstance;
};

const buildCompactWire = (
  snapshot: BuilderDocumentSnapshot,
  version: typeof COMPACT_V2 | typeof COMPACT_V3 | typeof COMPACT_V4,
): CompactWire => {
  const idToIndex =
    version === COMPACT_V3 || version === COMPACT_V4
      ? new Map(snapshot.instances.map((instance, index) => [instance.id, index]))
      : undefined;

  const wire: CompactWire = {
    v: version,
    g: toCompactGrid(snapshot.gridConfig),
    l: snapshot.instances.map((instance) => toCompactLayerRow(instance, idToIndex)),
    n: snapshot.nextInstanceIndex,
  };

  if (snapshot.selectedInstanceId) {
    wire.s = snapshot.selectedInstanceId;
  }

  if (snapshot.canvasPan.x !== 0 || snapshot.canvasPan.y !== 0) {
    wire.p = [snapshot.canvasPan.x, snapshot.canvasPan.y];
  }

  return wire;
};

const toCompactV2 = (snapshot: BuilderDocumentSnapshot): CompactV2Wire =>
  buildCompactWire(snapshot, COMPACT_V2) as CompactV2Wire;

const toCompactV4 = (snapshot: BuilderDocumentSnapshot): CompactV4Wire =>
  buildCompactWire(snapshot, COMPACT_V4) as CompactV4Wire;

const toCompactV1 = (snapshot: BuilderDocumentSnapshot): CompactV1Wire => {
  const g = snapshot.gridConfig;
  return {
    v: COMPACT_V1,
    g: [g.seed, g.width, g.height, g.density, g.smallCellRatio, g.strokeColor, g.gapMask],
    l: snapshot.instances.map((instance) => [
      instance.id,
      instance.type,
      instance.name,
      instance.x,
      instance.y,
      instance.props,
    ]),
    n: snapshot.nextInstanceIndex,
    s: snapshot.selectedInstanceId,
    p: [snapshot.canvasPan.x, snapshot.canvasPan.y],
  };
};

const expandCompactWire = (compact: CompactWire): BuilderDocumentSnapshot => {
  const instanceIds = compact.l.map((row) => row[1]);
  return {
    gridConfig: fromCompactGrid(compact.g),
    instances: compact.l.map((row) => fromCompactLayerRow(row, instanceIds, compact.v)),
    nextInstanceIndex: compact.n,
    selectedInstanceId: compact.s ?? null,
    canvasPan: { x: compact.p?.[0] ?? 0, y: compact.p?.[1] ?? 0 },
  };
};

export const expandCompactBuilderDocumentSnapshot = (
  snapshot: BuilderDocumentSnapshot | CompactV1Wire | CompactWire,
): BuilderDocumentSnapshot => {
  if ("v" in snapshot && (snapshot.v === COMPACT_V2 || snapshot.v === COMPACT_V3 || snapshot.v === COMPACT_V4)) {
    return expandCompactWire(snapshot as CompactWire);
  }

  const compact = snapshot as CompactV1Wire;
  const legacyGrid = compact.g.length >= 8;
  const strokeColor = legacyGrid ? compact.g[6] : compact.g[5];
  const gapMask = legacyGrid ? compact.g[7] : compact.g[6];
  const smallCellRatio = compact.g[4];

  return {
    gridConfig: {
      seed: compact.g[0],
      width: compact.g[1],
      height: compact.g[2],
      density: compact.g[3],
      smallCellRatio: Number.isFinite(smallCellRatio) ? smallCellRatio : DEFAULT_CONFIG.smallCellRatio,
      strokeColor: typeof strokeColor === "string" ? strokeColor : DEFAULT_CONFIG.strokeColor,
      gapMask: Array.isArray(gapMask) ? gapMask : [],
    },
    instances: compact.l.map(
      ([id, type, name, x, y, props]) =>
        ({
          id,
          type,
          name,
          x,
          y,
          props,
        }) as ComponentInstance,
    ),
    nextInstanceIndex: compact.n,
    selectedInstanceId: compact.s,
    canvasPan: { x: compact.p[0], y: compact.p[1] },
  };
};

const minifiedCompactJsonCandidates = (snapshot: BuilderDocumentSnapshot): string[] => [
  JSON.stringify(toCompactV4(snapshot)),
];

/** Minified compact JSON (v4; gzip may wrap further on copy). */
export const serializeBuilderDocumentSnapshot = (snapshot: BuilderDocumentSnapshot): string =>
  JSON.stringify(toCompactV4(snapshot));

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const isCompactGridSparse = (value: unknown): value is CompactGridSparse =>
  isRecord(value) && typeof value.s === "string";

const isCompactLayerRow = (value: unknown): value is CompactLayerRow => {
  if (!Array.isArray(value) || value.length < 4 || value.length > 6) {
    return false;
  }

  if (
    typeof value[0] !== "number" ||
    typeof value[1] !== "string" ||
    typeof value[2] !== "number" ||
    typeof value[3] !== "number"
  ) {
    return false;
  }

  if (value.length === 5) {
    const fourth = value[4];
    return typeof fourth === "string" || isRecord(fourth);
  }

  if (value.length === 6) {
    return isRecord(value[4]) && typeof value[5] === "string";
  }

  return true;
};

const isCompactWire = (value: unknown): value is CompactWire => {
  if (!isRecord(value) || (value.v !== COMPACT_V2 && value.v !== COMPACT_V3 && value.v !== COMPACT_V4)) {
    return false;
  }

  return (
    isCompactGridSparse(value.g) &&
    Array.isArray(value.l) &&
    value.l.every(isCompactLayerRow) &&
    typeof value.n === "number"
  );
};

const isCompactV1Wire = (value: unknown): value is CompactV1Wire => {
  if (!isRecord(value) || value.v !== COMPACT_V1) {
    return false;
  }

  const g = value.g;
  return (
    Array.isArray(g) &&
    g.length >= 7 &&
    g.length <= 8 &&
    typeof g[0] === "string" &&
    Array.isArray(value.l) &&
    typeof value.n === "number"
  );
};

const unwrapPersistEnvelope = (parsed: unknown): unknown => {
  if (isRecord(parsed) && "state" in parsed) {
    return parsed.state;
  }
  return parsed;
};

const parseJsonSnapshot = (jsonText: string): unknown => {
  const parsed = unwrapPersistEnvelope(JSON.parse(jsonText));
  if (isCompactWire(parsed) || isCompactV1Wire(parsed)) {
    return expandCompactBuilderDocumentSnapshot(parsed);
  }
  return parsed;
};

const bytesToBase64Url = (bytes: Uint8Array): string => {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/u, "");
};

const base64UrlToBytes = (encoded: string): Uint8Array => {
  const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

const gzipUtf8 = async (text: string): Promise<Uint8Array | null> => {
  if (typeof CompressionStream === "undefined") {
    return null;
  }

  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
};

const gunzipUtf8 = async (bytes: Uint8Array): Promise<string> => {
  if (typeof DecompressionStream === "undefined") {
    throw new Error("DecompressionStream is not available");
  }

  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Response(stream).text();
};

const pickShortestClipboardPayload = async (snapshot: BuilderDocumentSnapshot): Promise<string> => {
  const candidates: string[] = [...minifiedCompactJsonCandidates(snapshot)];

  for (const json of [...candidates]) {
    const gzipped = await gzipUtf8(json);
    if (!gzipped) {
      continue;
    }

    candidates.push(`${GZIP_PREFIX}${bytesToBase64Url(gzipped)}`);
  }

  return candidates.reduce((shortest, next) => (next.length < shortest.length ? next : shortest));
};

/** Parses pasted compact/legacy JSON or gzip payload (`z:` prefix). */
export const parseBuilderDocumentSnapshotInput = async (text: string): Promise<unknown> => {
  const trimmed = text.trim();
  if (trimmed.startsWith(GZIP_PREFIX)) {
    const json = await gunzipUtf8(base64UrlToBytes(trimmed.slice(GZIP_PREFIX.length)));
    return parseJsonSnapshot(json);
  }

  return parseJsonSnapshot(trimmed);
};

export const copyBuilderDocumentSnapshotToClipboard = async (snapshot: BuilderDocumentSnapshot): Promise<boolean> => {
  const text = await pickShortestClipboardPayload(snapshot);

  if (!navigator.clipboard?.writeText) {
    return false;
  }

  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
};

/** @internal Compare wire sizes for tests. */
export const __testOnlySerializeV1 = (snapshot: BuilderDocumentSnapshot): string =>
  JSON.stringify(toCompactV1(snapshot));
export const __testOnlySerializeV2 = (snapshot: BuilderDocumentSnapshot): string =>
  JSON.stringify(toCompactV2(snapshot));
