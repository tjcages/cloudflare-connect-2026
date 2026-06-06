import { DEFAULT_TEXTURE_GAMMA, normalizeTextureGamma } from "./colorWhiteness";
import { DEFAULT_PLAYGROUND_BACKGROUND_COLOR } from "./canvasBackgroundCss";
import {
  isDefaultPlaygroundGridConfig,
  normalizePlaygroundGridConfig,
  type PlaygroundGridConfig,
} from "./playgroundGridConfig";
import { cloneDefaultStripes, normalizeStripe, type Stripe } from "./stripeColors";
import {
  DEFAULT_PLAYGROUND_SPARKLE_GAPS_ACTIVE_PERCENT,
  DEFAULT_PLAYGROUND_SPARKLE_GAPS_SPEED,
  migrateSparkleGapsSpeedFromWireV1,
  normalizeSparkleGapsActivePercent,
  normalizeSparkleGapsSpeed,
  normalizeSparkleRate,
} from "./playgroundSparkle";
import {
  DEFAULT_PLAYGROUND_SPARKLE_WIDTH_ACTIVE_PERCENT,
  DEFAULT_PLAYGROUND_SPARKLE_WIDTH_SPEED,
  migrateSparkleWidthSpeedFromWireV1,
  normalizeSparkleWidthActivePercent,
  normalizeSparkleWidthSpeed,
} from "./playgroundWidthShuffle";
import {
  DEFAULT_PLAYGROUND_SOURCE_TRANSFORM,
  isDefaultPlaygroundSourceTransform,
  normalizePlaygroundSourceTransform,
  type PlaygroundSourceFit,
  type PlaygroundSourceTransform,
} from "./playgroundSourceTransform";
import {
  DEFAULT_PLAYGROUND_TEXTURE_ADJUSTMENTS,
  isDefaultPlaygroundTextureAdjustments,
  normalizePlaygroundTextureAdjustments,
  type PlaygroundTextureAdjustments,
} from "./playgroundTextureAdjustments";
import {
  DEFAULT_PLAYGROUND_FLAMES_CONFIG,
  isDefaultPlaygroundFlamesConfig,
  normalizePlaygroundFlamesConfig,
  type PlaygroundFlamesConfig,
} from "./playgroundFlamesConfig";
import {
  DEFAULT_PLAYGROUND_REVEAL_CONFIG,
  isDefaultPlaygroundRevealConfig,
  normalizePlaygroundRevealConfig,
  type PlaygroundRevealConfig,
  type PlaygroundWaveRevealPosition,
} from "./playgroundRevealConfig";
import {
  DEFAULT_PLAYGROUND_TEXTURE_ID,
  DEFAULT_PLAYGROUND_UPLOAD_STRIPES,
  detectUploadMediaKind,
  getPlaygroundTextureOption,
  isUploadTextureId,
  PLAYGROUND_TEXTURES,
  type BuiltinPlaygroundTextureId,
  type PlaygroundMediaKind,
  type PlaygroundTextureId,
} from "./playgroundTextures";

export const PLAYGROUND_LS_KEY = "section-grid-playground";
export const PLAYGROUND_DB_NAME = "section-grid-playground";
export const PLAYGROUND_DB_VERSION = 1;
export const MAX_PLAYGROUND_UPLOAD_BYTES = 50 * 1024 * 1024;

export type PlaygroundPersistedConfig = {
  duotoneEnabled: boolean;
  /** Stripe overlay visibility. False keeps the source texture visible without stripe bucketing. */
  stripesEnabled?: boolean;
  /** Raw CSS declarations applied to the playground canvas element. */
  backgroundCss?: string;
  /** Canvas background color as 0xRRGGBB when CSS is empty. Omitted when white. */
  backgroundColor?: number;
  /** Positive texture luminance gamma. Omitted when 1. */
  /** @deprecated Use textureAdjustments.gamma. */
  textureGamma?: number;
  /** Designer texture/tone adjustments. Omitted = defaults. */
  textureAdjustments?: PlaygroundTextureAdjustments;
  /** Source fit/crop transform. Omitted = stretch/full source. */
  sourceTransform?: PlaygroundSourceTransform;
  /** Active cell ratio 0–1. 0 = off. Default 0.22. */
  sparkleGapsActivePercent?: number;
  /** Gap pulse speed factor (1 = baseline). Default 1. */
  sparkleGapsSpeed?: number;
  /** @deprecated Migrated to sparkleGapsActivePercent / sparkleGapsSpeed. */
  sparkleRate?: number;
  /** @deprecated Migrated to sparkleGapsActivePercent. */
  sparkleEnabled?: boolean;
  /** Active cell ratio 0–1. 0 = off. Default 0.3. */
  sparkleWidthActivePercent?: number;
  /** Width pulse speed factor (1 = baseline). Default 1. */
  sparkleWidthSpeed?: number;
  /** Canvas width in px; omitted = match native source width on load. */
  displayWidth?: number;
  /** Canvas height in px; omitted = match native source height on load. */
  displayHeight?: number;
  /** Designer-tunable grid geometry / letter / animation config. Omitted = defaults. */
  grid?: PlaygroundGridConfig;
  /** Background flame streak settings. Omitted = defaults. */
  flames?: PlaygroundFlamesConfig;
  /** Reveal animation settings. Omitted = defaults. */
  reveal?: PlaygroundRevealConfig;
  /** Ordered luminosity stripes (color + start-from + width). */
  stripes: Stripe[];
};

export function resolvePersistedGridConfig(config: PlaygroundPersistedConfig): PlaygroundGridConfig {
  return normalizePlaygroundGridConfig(config.grid);
}

export function resolvePersistedTextureGamma(config: PlaygroundPersistedConfig): number {
  return resolvePersistedTextureAdjustments(config).gamma;
}

export function resolvePersistedTextureAdjustments(config: PlaygroundPersistedConfig): PlaygroundTextureAdjustments {
  return normalizePlaygroundTextureAdjustments({
    ...config.textureAdjustments,
    gamma: config.textureAdjustments?.gamma ?? config.textureGamma ?? DEFAULT_TEXTURE_GAMMA,
  });
}

export function resolvePersistedSourceTransform(config: PlaygroundPersistedConfig): PlaygroundSourceTransform {
  return normalizePlaygroundSourceTransform(config.sourceTransform);
}

export function resolvePersistedFlamesConfig(config: PlaygroundPersistedConfig): PlaygroundFlamesConfig {
  return normalizePlaygroundFlamesConfig(config.flames);
}

export function resolvePersistedRevealConfig(config: PlaygroundPersistedConfig): PlaygroundRevealConfig {
  return normalizePlaygroundRevealConfig(config.reveal);
}

export type PlaygroundUploadMeta = {
  id: string;
  label: string;
  createdAt: number;
  displayScale: number;
  mediaKind?: PlaygroundMediaKind;
};

type PlaygroundEnvelope = {
  version: 1;
  lastTextureId: string;
  uploads: PlaygroundUploadMeta[];
  configs: Record<string, PlaygroundPersistedConfig>;
};

export type PlaygroundCatalogEntry = {
  id: PlaygroundTextureId;
  label: string;
  url: string;
  mediaKind: PlaygroundMediaKind;
  displayScale: number;
  stripes: readonly Stripe[];
  isUpload: boolean;
};

/** Compact per-stripe wire entry (id is regenerated on parse). */
export type StripeWire = {
  hex: string;
  p3?: string;
  s: number;
  w: number;
};

export type PlaygroundStateWire = {
  v: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  d: boolean;
  se?: boolean;
  /** v5+: raw CSS declarations applied to the playground canvas element. */
  bg?: string;
  /** v5+: canvas background hex when CSS is omitted. */
  bgh?: string;
  sk?: boolean;
  sr?: number;
  sgap?: number;
  sgsp?: number;
  swa?: number;
  sws?: number;
  /** Positive texture luminance gamma. Default 1 when omitted. */
  tgm?: number;
  /** v6+: texture/tone adjustments. */
  ta?: TextureAdjustmentsWire;
  /** v6+: source fit/crop transform. */
  xf?: SourceTransformWire;
  w?: number;
  h?: number;
  /** v4+: designer grid/letter/animation config (omitted = defaults). */
  gc?: Partial<PlaygroundGridConfig>;
  /** v3+: ordered luminosity stripes. */
  st?: StripeWire[];
  /** v6+: background flame settings. */
  fl?: FlamesWire;
  /** v7+: reveal animation settings. */
  rv?: RevealWire;
  /** @deprecated v1/v2 distance-model fields, migrated to default stripes. */
  c?: string;
  t?: number;
  g?: number;
  th?: number;
  de?: number;
  bp?: number[];
};

type TextureAdjustmentsWire = {
  br?: number;
  ex?: number;
  co?: number;
  bp?: number;
  wp?: number;
  gm?: number;
  iv?: boolean;
  po?: number;
  tb?: number;
  no?: number;
  bl?: number;
  sh?: number;
};

type SourceTransformWire = {
  f?: PlaygroundSourceFit;
  z?: number;
  x?: number;
  y?: number;
};

type FlamesWire = {
  en?: boolean;
  dir?: "up" | "down" | "left" | "right";
  wmn?: number;
  wmx?: number;
  hmn?: number;
  hmx?: number;
  spd?: number;
  svr?: number;
  si?: number;
  sj?: number;
  ma?: number;
  es?: number;
  em?: boolean;
  ms?: number;
  me?: number;
  mp?: number;
};

type RevealWire = {
  p?: "wave";
  wp?: PlaygroundWaveRevealPosition;
  wd?: number;
  ws?: number;
  ww?: number;
  wn?: number;
};

function stripesToWire(stripes: readonly Stripe[]): StripeWire[] {
  return stripes.map((stripe) => ({ hex: stripe.hex, p3: stripe.p3Css, s: stripe.startFrom, w: stripe.width }));
}

function wireToStripes(raw: unknown): Stripe[] | undefined {
  if (!Array.isArray(raw)) {
    return undefined;
  }
  const stripes = raw
    .filter(
      (entry): entry is StripeWire =>
        !!entry && typeof entry === "object" && typeof (entry as StripeWire).hex === "string",
    )
    .map((entry) =>
      normalizeStripe({ hex: entry.hex, p3Css: entry.p3, startFrom: Number(entry.s), width: Number(entry.w) }),
    );
  return stripes.length > 0 ? stripes : undefined;
}

function textureAdjustmentsToWire(adjustments: PlaygroundTextureAdjustments): TextureAdjustmentsWire | undefined {
  if (isDefaultPlaygroundTextureAdjustments(adjustments)) {
    return undefined;
  }
  const base = DEFAULT_PLAYGROUND_TEXTURE_ADJUSTMENTS;
  const wire: TextureAdjustmentsWire = {};
  if (adjustments.brightness !== base.brightness) wire.br = adjustments.brightness;
  if (adjustments.exposure !== base.exposure) wire.ex = adjustments.exposure;
  if (adjustments.contrast !== base.contrast) wire.co = adjustments.contrast;
  if (adjustments.blackPoint !== base.blackPoint) wire.bp = adjustments.blackPoint;
  if (adjustments.whitePoint !== base.whitePoint) wire.wp = adjustments.whitePoint;
  if (adjustments.gamma !== base.gamma) wire.gm = adjustments.gamma;
  if (adjustments.invert !== base.invert) wire.iv = adjustments.invert;
  if (adjustments.posterizeLevels !== base.posterizeLevels) wire.po = adjustments.posterizeLevels;
  if (adjustments.thresholdBias !== base.thresholdBias) wire.tb = adjustments.thresholdBias;
  if (adjustments.noiseAmount !== base.noiseAmount) wire.no = adjustments.noiseAmount;
  if (adjustments.blurRadius !== base.blurRadius) wire.bl = adjustments.blurRadius;
  if (adjustments.sharpenAmount !== base.sharpenAmount) wire.sh = adjustments.sharpenAmount;
  return wire;
}

function wireToTextureAdjustments(
  raw: unknown,
  legacyGamma: number | undefined,
): PlaygroundTextureAdjustments | undefined {
  if (!raw || typeof raw !== "object") {
    return legacyGamma !== undefined ? normalizePlaygroundTextureAdjustments({ gamma: legacyGamma }) : undefined;
  }
  const wire = raw as TextureAdjustmentsWire;
  return normalizePlaygroundTextureAdjustments({
    brightness: wire.br,
    exposure: wire.ex,
    contrast: wire.co,
    blackPoint: wire.bp,
    whitePoint: wire.wp,
    gamma: wire.gm ?? legacyGamma,
    invert: wire.iv,
    posterizeLevels: wire.po,
    thresholdBias: wire.tb,
    noiseAmount: wire.no,
    blurRadius: wire.bl,
    sharpenAmount: wire.sh,
  });
}

function sourceTransformToWire(transform: PlaygroundSourceTransform): SourceTransformWire | undefined {
  if (isDefaultPlaygroundSourceTransform(transform)) {
    return undefined;
  }
  const base = DEFAULT_PLAYGROUND_SOURCE_TRANSFORM;
  const wire: SourceTransformWire = {};
  if (transform.fit !== base.fit) wire.f = transform.fit;
  if (transform.zoom !== base.zoom) wire.z = transform.zoom;
  if (transform.panX !== base.panX) wire.x = transform.panX;
  if (transform.panY !== base.panY) wire.y = transform.panY;
  return wire;
}

function wireToSourceTransform(raw: unknown): PlaygroundSourceTransform | undefined {
  if (!raw || typeof raw !== "object") {
    return undefined;
  }
  const wire = raw as SourceTransformWire;
  return normalizePlaygroundSourceTransform({
    fit: wire.f,
    zoom: wire.z,
    panX: wire.x,
    panY: wire.y,
  });
}

function flamesToWire(config: PlaygroundFlamesConfig): FlamesWire | undefined {
  const normalized = normalizePlaygroundFlamesConfig(config);
  if (isDefaultPlaygroundFlamesConfig(normalized)) {
    return undefined;
  }
  const base = DEFAULT_PLAYGROUND_FLAMES_CONFIG;
  const wire: FlamesWire = {};
  if (normalized.enabled !== base.enabled) wire.en = normalized.enabled;
  if (normalized.direction !== base.direction) wire.dir = normalized.direction;
  if (normalized.minWidthRatio !== base.minWidthRatio) wire.wmn = normalized.minWidthRatio;
  if (normalized.maxWidthRatio !== base.maxWidthRatio) wire.wmx = normalized.maxWidthRatio;
  if (normalized.minHeightRatio !== base.minHeightRatio) wire.hmn = normalized.minHeightRatio;
  if (normalized.maxHeightRatio !== base.maxHeightRatio) wire.hmx = normalized.maxHeightRatio;
  if (normalized.baseSpeedPxPerSec !== base.baseSpeedPxPerSec) wire.spd = normalized.baseSpeedPxPerSec;
  if (normalized.speedVariation !== base.speedVariation) wire.svr = normalized.speedVariation;
  if (normalized.spawnIntervalMs !== base.spawnIntervalMs) wire.si = normalized.spawnIntervalMs;
  if (normalized.spawnJitterMs !== base.spawnJitterMs) wire.sj = normalized.spawnJitterMs;
  if (normalized.maxActive !== base.maxActive) wire.ma = normalized.maxActive;
  if (normalized.edgeSharpness !== base.edgeSharpness) wire.es = normalized.edgeSharpness;
  if (normalized.edgeMaskEnabled !== base.edgeMaskEnabled) wire.em = normalized.edgeMaskEnabled;
  if (normalized.edgeMaskStart !== base.edgeMaskStart) wire.ms = normalized.edgeMaskStart;
  if (normalized.edgeMaskEnd !== base.edgeMaskEnd) wire.me = normalized.edgeMaskEnd;
  if (normalized.edgeMaskPower !== base.edgeMaskPower) wire.mp = normalized.edgeMaskPower;
  return wire;
}

function wireToFlames(raw: unknown): PlaygroundFlamesConfig | undefined {
  if (!raw || typeof raw !== "object") {
    return undefined;
  }
  const wire = raw as FlamesWire;
  return normalizePlaygroundFlamesConfig({
    enabled: wire.en,
    direction: wire.dir,
    minWidthRatio: wire.wmn,
    maxWidthRatio: wire.wmx,
    minHeightRatio: wire.hmn,
    maxHeightRatio: wire.hmx,
    baseSpeedPxPerSec: wire.spd,
    speedVariation: wire.svr,
    spawnIntervalMs: wire.si,
    spawnJitterMs: wire.sj,
    maxActive: wire.ma,
    edgeSharpness: wire.es,
    edgeMaskEnabled: wire.em,
    edgeMaskStart: wire.ms,
    edgeMaskEnd: wire.me,
    edgeMaskPower: wire.mp,
  });
}

function revealToWire(config: PlaygroundRevealConfig): RevealWire | undefined {
  const normalized = normalizePlaygroundRevealConfig(config);
  if (isDefaultPlaygroundRevealConfig(normalized)) {
    return undefined;
  }
  const base = DEFAULT_PLAYGROUND_REVEAL_CONFIG;
  const wire: RevealWire = { p: normalized.preset };
  if (normalized.wave.position !== base.wave.position) wire.wp = normalized.wave.position;
  if (normalized.wave.durationMs !== base.wave.durationMs) wire.wd = normalized.wave.durationMs;
  if (normalized.wave.softness !== base.wave.softness) wire.ws = normalized.wave.softness;
  if (normalized.wave.waviness !== base.wave.waviness) wire.ww = normalized.wave.waviness;
  if (normalized.wave.noiseScale !== base.wave.noiseScale) wire.wn = normalized.wave.noiseScale;
  return wire;
}

function wireToReveal(raw: unknown): PlaygroundRevealConfig | undefined {
  if (!raw || typeof raw !== "object") {
    return undefined;
  }
  const wire = raw as RevealWire;
  return normalizePlaygroundRevealConfig({
    preset: wire.p,
    wave: {
      position: wire.wp,
      durationMs: wire.wd,
      softness: wire.ws,
      waviness: wire.ww,
      noiseScale: wire.wn,
    },
  });
}

export function normalizePlaygroundBackgroundCss(raw: unknown): string | undefined {
  if (typeof raw !== "string") {
    return undefined;
  }
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function normalizePlaygroundBackgroundColor(raw: unknown): number {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return raw & 0xffffff;
  }
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (trimmed.length > 0) {
      const parsed = Number.parseInt(trimmed.replace(/^#/, ""), 16);
      return Number.isFinite(parsed) ? parsed & 0xffffff : DEFAULT_PLAYGROUND_BACKGROUND_COLOR;
    }
  }
  return DEFAULT_PLAYGROUND_BACKGROUND_COLOR;
}

const objectUrls = new Map<string, string>();

function uploadMediaKind(meta: PlaygroundUploadMeta): PlaygroundMediaKind {
  return meta.mediaKind === "image" ? "image" : "video";
}

function readEnvelope(): PlaygroundEnvelope {
  try {
    const raw = localStorage.getItem(PLAYGROUND_LS_KEY);
    if (!raw) {
      return { version: 1, lastTextureId: DEFAULT_PLAYGROUND_TEXTURE_ID, uploads: [], configs: {} };
    }
    const parsed = JSON.parse(raw) as Partial<PlaygroundEnvelope> & { lastVideoId?: string };
    if (parsed.version !== 1) {
      return { version: 1, lastTextureId: DEFAULT_PLAYGROUND_TEXTURE_ID, uploads: [], configs: {} };
    }
    const lastTextureId =
      typeof parsed.lastTextureId === "string"
        ? parsed.lastTextureId
        : typeof parsed.lastVideoId === "string"
          ? parsed.lastVideoId
          : DEFAULT_PLAYGROUND_TEXTURE_ID;
    return {
      version: 1,
      lastTextureId,
      uploads: Array.isArray(parsed.uploads) ? parsed.uploads : [],
      configs: parsed.configs && typeof parsed.configs === "object" ? parsed.configs : {},
    };
  } catch {
    return { version: 1, lastTextureId: DEFAULT_PLAYGROUND_TEXTURE_ID, uploads: [], configs: {} };
  }
}

function writeEnvelope(envelope: PlaygroundEnvelope) {
  localStorage.setItem(PLAYGROUND_LS_KEY, JSON.stringify(envelope));
}

function openTextureDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(PLAYGROUND_DB_NAME, PLAYGROUND_DB_VERSION);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB open failed"));
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("videos")) {
        db.createObjectStore("videos");
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

export async function putUploadTextureBlob(uploadId: string, blob: Blob): Promise<void> {
  const db = await openTextureDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("videos", "readwrite");
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB write failed"));
    tx.objectStore("videos").put(blob, uploadId);
  });
}

export async function getUploadTextureBlob(uploadId: string): Promise<Blob | null> {
  const db = await openTextureDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("videos", "readonly");
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB read failed"));
    const req = tx.objectStore("videos").get(uploadId);
    req.onsuccess = () => {
      db.close();
      resolve((req.result as Blob | undefined) ?? null);
    };
    req.onerror = () => reject(req.error ?? new Error("IndexedDB get failed"));
  });
}

/** @deprecated Use {@link putUploadTextureBlob}. */
export const putUploadVideoBlob = putUploadTextureBlob;

/** @deprecated Use {@link getUploadTextureBlob}. */
export const getUploadVideoBlob = getUploadTextureBlob;

export function revokeUploadObjectUrl(textureId: PlaygroundTextureId) {
  if (!isUploadTextureId(textureId)) {
    return;
  }
  const url = objectUrls.get(textureId);
  if (url) {
    URL.revokeObjectURL(url);
    objectUrls.delete(textureId);
  }
}

export function getUploadObjectUrl(textureId: `upload:${string}`, blob: Blob): string {
  revokeUploadObjectUrl(textureId);
  const url = URL.createObjectURL(blob);
  objectUrls.set(textureId, url);
  return url;
}

export function loadPlaygroundEnvelope() {
  return readEnvelope();
}

export function saveLastTextureId(textureId: PlaygroundTextureId) {
  const envelope = readEnvelope();
  envelope.lastTextureId = textureId;
  writeEnvelope(envelope);
}

/** @deprecated Use {@link saveLastTextureId}. */
export const saveLastVideoId = saveLastTextureId;

export function getPersistedConfig(textureId: PlaygroundTextureId): PlaygroundPersistedConfig | undefined {
  return readEnvelope().configs[textureId];
}

export function savePersistedConfig(textureId: PlaygroundTextureId, config: PlaygroundPersistedConfig) {
  const envelope = readEnvelope();
  envelope.configs[textureId] = config;
  writeEnvelope(envelope);
}

let persistTimer: ReturnType<typeof setTimeout> | undefined;

export function schedulePersistedConfig(textureId: PlaygroundTextureId, config: PlaygroundPersistedConfig) {
  if (persistTimer) {
    clearTimeout(persistTimer);
  }
  persistTimer = setTimeout(() => {
    persistTimer = undefined;
    savePersistedConfig(textureId, config);
  }, 300);
}

export function builtinCatalogEntries(): PlaygroundCatalogEntry[] {
  return PLAYGROUND_TEXTURES.map((entry) => ({
    id: entry.id,
    label: entry.label,
    url: entry.url,
    mediaKind: entry.mediaKind,
    displayScale: entry.displayScale,
    stripes: entry.stripes,
    isUpload: false,
  }));
}

export function mergeCatalog(
  uploads: PlaygroundUploadMeta[],
  blobUrlsById: Map<string, string>,
): PlaygroundCatalogEntry[] {
  const built = builtinCatalogEntries();
  const custom = uploads.map((upload) => {
    const id = `upload:${upload.id}` as PlaygroundTextureId;
    const url = blobUrlsById.get(id) ?? objectUrls.get(id) ?? "";
    const override = getPersistedConfig(id);
    return {
      id,
      label: upload.label,
      url,
      mediaKind: uploadMediaKind(upload),
      displayScale: upload.displayScale,
      stripes: override?.stripes ?? DEFAULT_PLAYGROUND_UPLOAD_STRIPES,
      isUpload: true,
    };
  });
  return [...built, ...custom];
}

export function resolveCatalogEntry(
  catalog: PlaygroundCatalogEntry[],
  textureId: PlaygroundTextureId,
): PlaygroundCatalogEntry | undefined {
  return catalog.find((entry) => entry.id === textureId);
}

/** First catalog entry with a non-empty source URL. */
export function firstCatalogEntryWithUrl(catalog: PlaygroundCatalogEntry[]): PlaygroundCatalogEntry | undefined {
  return catalog.find((entry) => entry.url.length > 0);
}

/** Catalog entries that can be loaded, with `preferredId` first when it has a URL. */
export function catalogEntriesForLoadAttempt(
  catalog: PlaygroundCatalogEntry[],
  preferredId: PlaygroundTextureId,
): PlaygroundCatalogEntry[] {
  const withUrl = catalog.filter((entry) => entry.url.length > 0);
  const preferredIndex = withUrl.findIndex((entry) => entry.id === preferredId);
  if (preferredIndex <= 0) {
    return withUrl;
  }
  return [...withUrl.slice(preferredIndex), ...withUrl.slice(0, preferredIndex)];
}

export function defaultConfigForTexture(textureId: PlaygroundTextureId): PlaygroundPersistedConfig {
  const persisted = getPersistedConfig(textureId);
  if (persisted) {
    return { ...persisted, stripes: persisted.stripes.map((stripe) => ({ ...stripe })) };
  }
  if (!isUploadTextureId(textureId)) {
    const option = getPlaygroundTextureOption(textureId as BuiltinPlaygroundTextureId);
    return {
      duotoneEnabled: true,
      stripes: option.stripes.map((stripe) => ({ ...stripe })),
    };
  }
  return {
    duotoneEnabled: true,
    stripes: cloneDefaultStripes(),
  };
}

/** @deprecated Use {@link defaultConfigForTexture}. */
export const defaultConfigForVideo = defaultConfigForTexture;

export function resolveInitialTextureId(): PlaygroundTextureId {
  const envelope = readEnvelope();
  const { lastTextureId } = envelope;
  if (lastTextureId.startsWith("upload:")) {
    const uploadId = lastTextureId.slice("upload:".length);
    if (envelope.uploads.some((entry) => entry.id === uploadId)) {
      return lastTextureId as PlaygroundTextureId;
    }
    return DEFAULT_PLAYGROUND_TEXTURE_ID;
  }
  if (PLAYGROUND_TEXTURES.some((entry) => entry.id === lastTextureId)) {
    return lastTextureId as BuiltinPlaygroundTextureId;
  }
  return DEFAULT_PLAYGROUND_TEXTURE_ID;
}

/** @deprecated Use {@link resolveInitialTextureId}. */
export const resolveInitialVideoId = resolveInitialTextureId;

export async function registerUpload(
  file: File,
): Promise<{ textureId: PlaygroundTextureId; meta: PlaygroundUploadMeta }> {
  if (file.size > MAX_PLAYGROUND_UPLOAD_BYTES) {
    throw new Error(`Texture must be under ${Math.round(MAX_PLAYGROUND_UPLOAD_BYTES / (1024 * 1024))}MB.`);
  }

  const mediaKind = detectUploadMediaKind(file);
  if (!mediaKind) {
    throw new Error("Upload a video or image file.");
  }

  const envelope = readEnvelope();

  const id = crypto.randomUUID();
  const textureId = `upload:${id}` as PlaygroundTextureId;
  await putUploadTextureBlob(id, file);

  const label = file.name.replace(/\.[^.]+$/, "") || "Uploaded texture";
  const meta: PlaygroundUploadMeta = {
    id,
    label,
    createdAt: Date.now(),
    displayScale: 1,
    mediaKind,
  };
  envelope.uploads.push(meta);
  writeEnvelope(envelope);
  getUploadObjectUrl(`upload:${id}`, file);

  return { textureId, meta };
}

export function serializePlaygroundState(config: PlaygroundPersistedConfig): string {
  const grid = normalizePlaygroundGridConfig(config.grid);
  const includeGrid = !isDefaultPlaygroundGridConfig(grid);
  const backgroundCss = normalizePlaygroundBackgroundCss(config.backgroundCss);
  const backgroundColor = normalizePlaygroundBackgroundColor(config.backgroundColor);
  const backgroundColorHex =
    backgroundColor !== DEFAULT_PLAYGROUND_BACKGROUND_COLOR
      ? `#${(backgroundColor & 0xffffff).toString(16).padStart(6, "0")}`
      : undefined;
  const textureAdjustments = resolvePersistedTextureAdjustments(config);
  const textureAdjustmentsWire = textureAdjustmentsToWire(textureAdjustments);
  const sourceTransform = resolvePersistedSourceTransform(config);
  const sourceTransformWire = sourceTransformToWire(sourceTransform);
  const flames = resolvePersistedFlamesConfig(config);
  const flamesWire = flamesToWire(flames);
  const reveal = resolvePersistedRevealConfig(config);
  const revealWire = revealToWire(reveal);
  const wire: PlaygroundStateWire = {
    v:
      revealWire
        ? 7
        : textureAdjustmentsWire || sourceTransformWire || flamesWire
          ? 6
          : backgroundCss || backgroundColorHex
            ? 5
            : includeGrid
              ? 4
              : 3,
    d: config.duotoneEnabled,
    st: stripesToWire(config.stripes),
  };
  if (config.stripesEnabled === false) {
    wire.se = false;
    wire.v = 6;
  }
  if (includeGrid) {
    wire.gc = grid;
  }
  if (backgroundCss) {
    wire.bg = backgroundCss;
  }
  if (backgroundColorHex) {
    wire.bgh = backgroundColorHex;
  }
  if (textureAdjustmentsWire) {
    wire.ta = textureAdjustmentsWire;
  }
  if (sourceTransformWire) {
    wire.xf = sourceTransformWire;
  }
  if (flamesWire) {
    wire.fl = flamesWire;
    wire.v = 6;
  }
  if (revealWire) {
    wire.rv = revealWire;
    wire.v = 7;
  }
  const gapsActive =
    config.sparkleGapsActivePercent !== undefined
      ? normalizeSparkleGapsActivePercent(config.sparkleGapsActivePercent)
      : legacySparkleGapsActivePercent(config);
  if (gapsActive > 0) {
    wire.sgap = gapsActive;
  }
  const gapsSpeed =
    config.sparkleGapsSpeed !== undefined
      ? normalizeSparkleGapsSpeed(config.sparkleGapsSpeed)
      : legacySparkleGapsSpeed(config);
  if (gapsActive > 0 && gapsSpeed !== DEFAULT_PLAYGROUND_SPARKLE_GAPS_SPEED) {
    wire.sgsp = gapsSpeed;
  }
  const activePercent =
    config.sparkleWidthActivePercent !== undefined
      ? normalizeSparkleWidthActivePercent(config.sparkleWidthActivePercent)
      : DEFAULT_PLAYGROUND_SPARKLE_WIDTH_ACTIVE_PERCENT;
  if (activePercent !== DEFAULT_PLAYGROUND_SPARKLE_WIDTH_ACTIVE_PERCENT) {
    wire.swa = activePercent;
  }
  const widthSpeed =
    config.sparkleWidthSpeed !== undefined
      ? normalizeSparkleWidthSpeed(config.sparkleWidthSpeed)
      : DEFAULT_PLAYGROUND_SPARKLE_WIDTH_SPEED;
  if (widthSpeed !== DEFAULT_PLAYGROUND_SPARKLE_WIDTH_SPEED) {
    wire.sws = widthSpeed;
  }
  if (config.displayWidth && config.displayWidth > 0) {
    wire.w = config.displayWidth;
  }
  if (config.displayHeight && config.displayHeight > 0) {
    wire.h = config.displayHeight;
  }
  const textureGamma = textureAdjustments.gamma;
  if (textureGamma !== DEFAULT_TEXTURE_GAMMA) {
    wire.tgm = textureGamma;
  }
  return JSON.stringify(wire);
}

function parseSparkleWidthActivePercent(raw: unknown, wireVersion: PlaygroundStateWire["v"]): number | undefined {
  if (raw === undefined) {
    return undefined;
  }
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    return undefined;
  }
  if (wireVersion === 1 && value > 1) {
    return normalizeSparkleWidthActivePercent(value / 100);
  }
  return normalizeSparkleWidthActivePercent(value);
}

function parseSparkleWidthSpeed(raw: unknown, wireVersion: PlaygroundStateWire["v"]): number | undefined {
  if (raw === undefined) {
    return undefined;
  }
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    return undefined;
  }
  const migrated = wireVersion === 1 ? migrateSparkleWidthSpeedFromWireV1(value) : value;
  return normalizeSparkleWidthSpeed(migrated);
}

function parseSparkleGapsActivePercent(
  sgap: unknown,
  sr: unknown,
  sk: unknown,
  wireVersion: PlaygroundStateWire["v"],
): number | undefined {
  const fromWire = parseRatioField(sgap, wireVersion);
  if (fromWire !== undefined) {
    return fromWire;
  }
  if (sr !== undefined) {
    const rate = Number(sr);
    if (Number.isFinite(rate) && normalizeSparkleRate(rate) > 0) {
      return DEFAULT_PLAYGROUND_SPARKLE_GAPS_ACTIVE_PERCENT;
    }
    return undefined;
  }
  return sk === true ? DEFAULT_PLAYGROUND_SPARKLE_GAPS_ACTIVE_PERCENT : undefined;
}

function parseSparkleGapsSpeed(
  sgsp: unknown,
  sr: unknown,
  sk: unknown,
  wireVersion: PlaygroundStateWire["v"],
): number | undefined {
  if (sgsp !== undefined) {
    const value = Number(sgsp);
    if (!Number.isFinite(value)) {
      return undefined;
    }
    const migrated = wireVersion === 1 ? migrateSparkleGapsSpeedFromWireV1(value) : value;
    return normalizeSparkleGapsSpeed(migrated);
  }
  if (sr !== undefined) {
    const rate = Number(sr);
    if (!Number.isFinite(rate)) {
      return undefined;
    }
    const normalized = normalizeSparkleRate(rate);
    return normalized > 0 ? migrateSparkleGapsSpeedFromWireV1(normalized) : undefined;
  }
  return sk === true ? DEFAULT_PLAYGROUND_SPARKLE_GAPS_SPEED : undefined;
}

function parseRatioField(raw: unknown, wireVersion: PlaygroundStateWire["v"]): number | undefined {
  if (raw === undefined) {
    return undefined;
  }
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    return undefined;
  }
  if (wireVersion === 1 && value > 1) {
    return normalizeSparkleGapsActivePercent(value / 100);
  }
  return normalizeSparkleGapsActivePercent(value);
}

function legacySparkleGapsActivePercent(config: PlaygroundPersistedConfig): number {
  if (config.sparkleRate !== undefined && config.sparkleRate > 0) {
    return DEFAULT_PLAYGROUND_SPARKLE_GAPS_ACTIVE_PERCENT;
  }
  if (config.sparkleEnabled) {
    return DEFAULT_PLAYGROUND_SPARKLE_GAPS_ACTIVE_PERCENT;
  }
  return 0;
}

function legacySparkleGapsSpeed(config: PlaygroundPersistedConfig): number {
  if (config.sparkleRate !== undefined && config.sparkleRate > 0) {
    return migrateSparkleGapsSpeedFromWireV1(normalizeSparkleRate(config.sparkleRate));
  }
  if (config.sparkleEnabled) {
    return DEFAULT_PLAYGROUND_SPARKLE_GAPS_SPEED;
  }
  return DEFAULT_PLAYGROUND_SPARKLE_GAPS_SPEED;
}

export function parsePlaygroundStateInput(text: string): PlaygroundPersistedConfig {
  const parsed = JSON.parse(text.trim()) as Partial<PlaygroundStateWire>;
  if (
    parsed.v !== 1 &&
    parsed.v !== 2 &&
    parsed.v !== 3 &&
    parsed.v !== 4 &&
    parsed.v !== 5 &&
    parsed.v !== 6 &&
    parsed.v !== 7
  ) {
    throw new Error("Unsupported playground state version.");
  }
  const wireVersion = parsed.v;
  if (typeof parsed.d !== "boolean") {
    throw new Error("Invalid playground state.");
  }
  const w = parsed.w === undefined ? undefined : Number(parsed.w);
  const h = parsed.h === undefined ? undefined : Number(parsed.h);
  // v1/v2 used a distance model; those configs migrate to the default stripe palette.
  const stripes = wireToStripes(parsed.st) ?? cloneDefaultStripes();
  const textureGamma = parsed.tgm === undefined ? undefined : normalizeTextureGamma(Number(parsed.tgm));
  const grid = parsed.gc ? normalizePlaygroundGridConfig(parsed.gc) : undefined;
  const textureAdjustments = wireToTextureAdjustments(parsed.ta, textureGamma);
  const sourceTransform = wireToSourceTransform(parsed.xf);
  const flames = wireToFlames(parsed.fl);
  const reveal = wireToReveal(parsed.rv);

  return {
    duotoneEnabled: parsed.d,
    stripesEnabled: parsed.se === false ? false : undefined,
    textureGamma: textureGamma !== undefined && textureGamma !== DEFAULT_TEXTURE_GAMMA ? textureGamma : undefined,
    textureAdjustments:
      textureAdjustments && !isDefaultPlaygroundTextureAdjustments(textureAdjustments) ? textureAdjustments : undefined,
    sourceTransform:
      sourceTransform && !isDefaultPlaygroundSourceTransform(sourceTransform) ? sourceTransform : undefined,
    sparkleGapsActivePercent: parseSparkleGapsActivePercent(parsed.sgap, parsed.sr, parsed.sk, wireVersion),
    sparkleGapsSpeed: parseSparkleGapsSpeed(parsed.sgsp, parsed.sr, parsed.sk, wireVersion),
    sparkleWidthActivePercent: parseSparkleWidthActivePercent(parsed.swa, wireVersion),
    sparkleWidthSpeed: parseSparkleWidthSpeed(parsed.sws, wireVersion),
    backgroundCss: normalizePlaygroundBackgroundCss(parsed.bg),
    backgroundColor:
      parsed.bgh === undefined
        ? undefined
        : (() => {
            const color = normalizePlaygroundBackgroundColor(parsed.bgh);
            return color !== DEFAULT_PLAYGROUND_BACKGROUND_COLOR ? color : undefined;
          })(),
    grid: grid && !isDefaultPlaygroundGridConfig(grid) ? grid : undefined,
    flames: flames && !isDefaultPlaygroundFlamesConfig(flames) ? flames : undefined,
    reveal: reveal && !isDefaultPlaygroundRevealConfig(reveal) ? reveal : undefined,
    stripes,
    displayWidth: w && Number.isFinite(w) && w > 0 ? Math.round(w) : undefined,
    displayHeight: h && Number.isFinite(h) && h > 0 ? Math.round(h) : undefined,
  };
}

export async function copyPlaygroundStateToClipboard(config: PlaygroundPersistedConfig): Promise<boolean> {
  const text = serializePlaygroundState(config);
  if (!navigator.clipboard?.writeText) {
    return false;
  }
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export async function hydrateUploadUrls(uploads: PlaygroundUploadMeta[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (const upload of uploads) {
    const textureId = `upload:${upload.id}` as PlaygroundTextureId;
    const blob = await getUploadTextureBlob(upload.id);
    if (blob) {
      map.set(textureId, getUploadObjectUrl(`upload:${upload.id}`, blob));
    }
  }
  return map;
}
