import {
  DEFAULT_PLAYGROUND_VIDEO_ID,
  getPlaygroundVideoOption,
  isUploadVideoId,
  PLAYGROUND_VIDEOS,
  type BuiltinPlaygroundVideoId,
  type PlaygroundDuotoneDefaults,
  type PlaygroundVideoId,
} from "./playgroundVideos";

export const PLAYGROUND_LS_KEY = "section-grid-playground";
export const PLAYGROUND_DB_NAME = "section-grid-playground";
export const PLAYGROUND_DB_VERSION = 1;
export const MAX_PLAYGROUND_UPLOADS = 20;
export const MAX_PLAYGROUND_UPLOAD_BYTES = 50 * 1024 * 1024;

export type PlaygroundPersistedConfig = {
  duotoneEnabled: boolean;
  ignoreColorHex: string;
  ignoreTolerance: number;
  gamma: number;
  threshold: number;
  density: number;
};

export type PlaygroundUploadMeta = {
  id: string;
  label: string;
  createdAt: number;
  displayScale: number;
};

type PlaygroundEnvelope = {
  version: 1;
  lastVideoId: string;
  uploads: PlaygroundUploadMeta[];
  configs: Record<string, PlaygroundPersistedConfig>;
};

export type PlaygroundCatalogEntry = {
  id: PlaygroundVideoId;
  label: string;
  url: string;
  displayScale: number;
  duotone: PlaygroundDuotoneDefaults;
  isUpload: boolean;
};

export type PlaygroundStateWire = {
  v: 1;
  d: boolean;
  c: string;
  t: number;
  g: number;
  th: number;
  de: number;
};

const objectUrls = new Map<string, string>();

function readEnvelope(): PlaygroundEnvelope {
  try {
    const raw = localStorage.getItem(PLAYGROUND_LS_KEY);
    if (!raw) {
      return { version: 1, lastVideoId: DEFAULT_PLAYGROUND_VIDEO_ID, uploads: [], configs: {} };
    }
    const parsed = JSON.parse(raw) as Partial<PlaygroundEnvelope>;
    if (parsed.version !== 1) {
      return { version: 1, lastVideoId: DEFAULT_PLAYGROUND_VIDEO_ID, uploads: [], configs: {} };
    }
    return {
      version: 1,
      lastVideoId: typeof parsed.lastVideoId === "string" ? parsed.lastVideoId : DEFAULT_PLAYGROUND_VIDEO_ID,
      uploads: Array.isArray(parsed.uploads) ? parsed.uploads : [],
      configs: parsed.configs && typeof parsed.configs === "object" ? parsed.configs : {},
    };
  } catch {
    return { version: 1, lastVideoId: DEFAULT_PLAYGROUND_VIDEO_ID, uploads: [], configs: {} };
  }
}

function writeEnvelope(envelope: PlaygroundEnvelope) {
  localStorage.setItem(PLAYGROUND_LS_KEY, JSON.stringify(envelope));
}

function openVideoDb(): Promise<IDBDatabase> {
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

export async function putUploadVideoBlob(uploadId: string, blob: Blob): Promise<void> {
  const db = await openVideoDb();
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

export async function getUploadVideoBlob(uploadId: string): Promise<Blob | null> {
  const db = await openVideoDb();
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

export function revokeUploadObjectUrl(videoId: PlaygroundVideoId) {
  if (!isUploadVideoId(videoId)) {
    return;
  }
  const url = objectUrls.get(videoId);
  if (url) {
    URL.revokeObjectURL(url);
    objectUrls.delete(videoId);
  }
}

export function getUploadObjectUrl(videoId: `upload:${string}`, blob: Blob): string {
  revokeUploadObjectUrl(videoId);
  const url = URL.createObjectURL(blob);
  objectUrls.set(videoId, url);
  return url;
}

export function loadPlaygroundEnvelope() {
  return readEnvelope();
}

export function saveLastVideoId(videoId: PlaygroundVideoId) {
  const envelope = readEnvelope();
  envelope.lastVideoId = videoId;
  writeEnvelope(envelope);
}

export function getPersistedConfig(videoId: PlaygroundVideoId): PlaygroundPersistedConfig | undefined {
  return readEnvelope().configs[videoId];
}

export function savePersistedConfig(videoId: PlaygroundVideoId, config: PlaygroundPersistedConfig) {
  const envelope = readEnvelope();
  envelope.configs[videoId] = config;
  writeEnvelope(envelope);
}

let persistTimer: ReturnType<typeof setTimeout> | undefined;

export function schedulePersistedConfig(videoId: PlaygroundVideoId, config: PlaygroundPersistedConfig) {
  if (persistTimer) {
    clearTimeout(persistTimer);
  }
  persistTimer = setTimeout(() => {
    persistTimer = undefined;
    savePersistedConfig(videoId, config);
  }, 300);
}

export function builtinCatalogEntries(): PlaygroundCatalogEntry[] {
  return PLAYGROUND_VIDEOS.map((entry) => ({
    id: entry.id,
    label: entry.label,
    url: entry.url,
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
    const id = `upload:${upload.id}` as PlaygroundVideoId;
    const url = blobUrlsById.get(id) ?? objectUrls.get(id) ?? "";
    const override = getPersistedConfig(id);
    return {
      id,
      label: upload.label,
      url,
      displayScale: upload.displayScale,
      duotone: override
        ? {
            ignoreColorHex: override.ignoreColorHex,
            ignoreTolerance: override.ignoreTolerance,
            gamma: override.gamma,
            threshold: override.threshold,
            density: override.density,
          }
        : {
            ignoreColorHex: "#000000",
            ignoreTolerance: 0.1,
            gamma: 1.2,
            threshold: 0.64,
            density: 0.3,
          },
      isUpload: true,
    };
  });
  return [...built, ...custom];
}

export function resolveCatalogEntry(
  catalog: PlaygroundCatalogEntry[],
  videoId: PlaygroundVideoId,
): PlaygroundCatalogEntry | undefined {
  return catalog.find((entry) => entry.id === videoId);
}

export function defaultConfigForVideo(videoId: PlaygroundVideoId): PlaygroundPersistedConfig {
  const persisted = getPersistedConfig(videoId);
  if (persisted) {
    return persisted;
  }
  if (!isUploadVideoId(videoId)) {
    const duotone = getPlaygroundVideoOption(videoId as BuiltinPlaygroundVideoId).duotone;
    return {
      duotoneEnabled: true,
      ignoreColorHex: duotone.ignoreColorHex,
      ignoreTolerance: duotone.ignoreTolerance,
      gamma: duotone.gamma,
      threshold: duotone.threshold,
      density: duotone.density,
    };
  }
  return {
    duotoneEnabled: true,
    ignoreColorHex: "#000000",
    ignoreTolerance: 0.1,
    gamma: 1.2,
    threshold: 0.64,
    density: 0.3,
  };
}

export function resolveInitialVideoId(): PlaygroundVideoId {
  const envelope = readEnvelope();
  const { lastVideoId } = envelope;
  if (lastVideoId.startsWith("upload:")) {
    const uploadId = lastVideoId.slice("upload:".length);
    if (envelope.uploads.some((entry) => entry.id === uploadId)) {
      return lastVideoId as PlaygroundVideoId;
    }
    return DEFAULT_PLAYGROUND_VIDEO_ID;
  }
  if (PLAYGROUND_VIDEOS.some((entry) => entry.id === lastVideoId)) {
    return lastVideoId as BuiltinPlaygroundVideoId;
  }
  return DEFAULT_PLAYGROUND_VIDEO_ID;
}

export async function registerUpload(file: File): Promise<{ videoId: PlaygroundVideoId; meta: PlaygroundUploadMeta }> {
  if (file.size > MAX_PLAYGROUND_UPLOAD_BYTES) {
    throw new Error(`Video must be under ${Math.round(MAX_PLAYGROUND_UPLOAD_BYTES / (1024 * 1024))}MB.`);
  }

  const envelope = readEnvelope();
  if (envelope.uploads.length >= MAX_PLAYGROUND_UPLOADS) {
    throw new Error(`At most ${MAX_PLAYGROUND_UPLOADS} uploaded videos.`);
  }

  const id = crypto.randomUUID();
  const videoId = `upload:${id}` as PlaygroundVideoId;
  await putUploadVideoBlob(id, file);

  const label = file.name.replace(/\.[^.]+$/, "") || "Uploaded video";
  const meta: PlaygroundUploadMeta = {
    id,
    label,
    createdAt: Date.now(),
    displayScale: 1,
  };
  envelope.uploads.push(meta);
  writeEnvelope(envelope);
  getUploadObjectUrl(`upload:${id}`, file);

  return { videoId, meta };
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
  return JSON.stringify(wire);
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
  return {
    duotoneEnabled: parsed.d,
    ignoreColorHex: parsed.c,
    ignoreTolerance: t,
    gamma: g,
    threshold: th,
    density: de,
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
    const videoId = `upload:${upload.id}` as PlaygroundVideoId;
    const blob = await getUploadVideoBlob(upload.id);
    if (blob) {
      map.set(videoId, getUploadObjectUrl(`upload:${upload.id}`, blob));
    }
  }
  return map;
}
