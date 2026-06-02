import {
  DEFAULT_STRIPE_BAND_BREAKPOINTS,
  normalizeStripeBandBreakpoints,
  type StripeBandBreakpoints,
} from "./stripeBandThresholds";
import {
  DEFAULT_PLAYGROUND_TEXTURE_ID,
  DEFAULT_PLAYGROUND_UPLOAD_DUOTONE,
  detectUploadMediaKind,
  getPlaygroundTextureOption,
  isUploadTextureId,
  PLAYGROUND_TEXTURES,
  type BuiltinPlaygroundTextureId,
  type PlaygroundDuotoneDefaults,
  type PlaygroundMediaKind,
  type PlaygroundTextureId,
} from "./playgroundTextures";

export const PLAYGROUND_LS_KEY = "section-grid-playground";
export const PLAYGROUND_DB_NAME = "section-grid-playground";
export const PLAYGROUND_DB_VERSION = 1;
export const MAX_PLAYGROUND_UPLOAD_BYTES = 50 * 1024 * 1024;

export type PlaygroundPersistedConfig = {
  duotoneEnabled: boolean;
  sparkleEnabled?: boolean;
  ignoreColorHex: string;
  ignoreTolerance: number;
  gamma: number;
  threshold: number;
  density: number;
  /** Canvas width in px; omitted = match native source width on load. */
  displayWidth?: number;
  /** Canvas height in px; omitted = match native source height on load. */
  displayHeight?: number;
  /** Connected distance upper limits for stripe color bands 1…4. */
  bandBreakpoints?: StripeBandBreakpoints;
};

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
  duotone: PlaygroundDuotoneDefaults;
  isUpload: boolean;
};

export type PlaygroundStateWire = {
  v: 1;
  d: boolean;
  sk?: boolean;
  c: string;
  t: number;
  g: number;
  th: number;
  de: number;
  w?: number;
  h?: number;
  bp?: number[];
};

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
    duotone: { ...entry.duotone },
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
      duotone: override
        ? {
            ignoreColorHex: override.ignoreColorHex,
            ignoreTolerance: override.ignoreTolerance,
            gamma: override.gamma,
            threshold: override.threshold,
            density: override.density,
          }
        : { ...DEFAULT_PLAYGROUND_UPLOAD_DUOTONE },
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

export function defaultConfigForTexture(textureId: PlaygroundTextureId): PlaygroundPersistedConfig {
  const persisted = getPersistedConfig(textureId);
  const bandBreakpoints = normalizeStripeBandBreakpoints(persisted?.bandBreakpoints ?? DEFAULT_STRIPE_BAND_BREAKPOINTS);
  if (persisted) {
    return { ...persisted, bandBreakpoints };
  }
  if (!isUploadTextureId(textureId)) {
    const duotone = getPlaygroundTextureOption(textureId as BuiltinPlaygroundTextureId).duotone;
    return {
      duotoneEnabled: true,
      ignoreColorHex: duotone.ignoreColorHex,
      ignoreTolerance: duotone.ignoreTolerance,
      gamma: duotone.gamma,
      threshold: duotone.threshold,
      density: duotone.density,
      bandBreakpoints,
    };
  }
  return {
    duotoneEnabled: true,
    ...DEFAULT_PLAYGROUND_UPLOAD_DUOTONE,
    bandBreakpoints,
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
  const wire: PlaygroundStateWire = {
    v: 1,
    d: config.duotoneEnabled,
    c: config.ignoreColorHex,
    t: config.ignoreTolerance,
    g: config.gamma,
    th: config.threshold,
    de: config.density,
  };
  if (config.sparkleEnabled) {
    wire.sk = true;
  }
  if (config.displayWidth && config.displayWidth > 0) {
    wire.w = config.displayWidth;
  }
  if (config.displayHeight && config.displayHeight > 0) {
    wire.h = config.displayHeight;
  }
  if (config.bandBreakpoints) {
    wire.bp = [...config.bandBreakpoints];
  }
  return JSON.stringify(wire);
}

function parseBandBreakpoints(raw: unknown): StripeBandBreakpoints | undefined {
  if (!Array.isArray(raw) || raw.length !== 4) {
    return undefined;
  }
  const values = raw.map((entry) => Number(entry));
  if (!values.every(Number.isFinite)) {
    return undefined;
  }
  return normalizeStripeBandBreakpoints(values);
}

export function parsePlaygroundStateInput(text: string): PlaygroundPersistedConfig {
  const parsed = JSON.parse(text.trim()) as Partial<PlaygroundStateWire>;
  if (parsed.v !== 1) {
    throw new Error("Unsupported playground state version.");
  }
  if (typeof parsed.d !== "boolean" || typeof parsed.c !== "string") {
    throw new Error("Invalid playground state.");
  }
  const t = Number(parsed.t);
  const g = Number(parsed.g);
  const th = Number(parsed.th);
  const de = Number(parsed.de);
  if (![t, g, th, de].every(Number.isFinite)) {
    throw new Error("Invalid playground state numbers.");
  }
  const w = parsed.w === undefined ? undefined : Number(parsed.w);
  const h = parsed.h === undefined ? undefined : Number(parsed.h);
  return {
    duotoneEnabled: parsed.d,
    sparkleEnabled: parsed.sk === true,
    ignoreColorHex: parsed.c,
    ignoreTolerance: t,
    gamma: g,
    threshold: th,
    density: de,
    displayWidth: w && Number.isFinite(w) && w > 0 ? Math.round(w) : undefined,
    displayHeight: h && Number.isFinite(h) && h > 0 ? Math.round(h) : undefined,
    bandBreakpoints: parseBandBreakpoints(parsed.bp) ?? DEFAULT_STRIPE_BAND_BREAKPOINTS,
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
