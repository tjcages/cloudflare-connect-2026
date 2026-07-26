import type { EngineSource } from "@necatikcl/stripes-engine";
import type { UploadEntry, UploadTextureVariant } from "./uploads";
import { getTextureBlob } from "./textureStore";

export type LabTextureKind = "image" | "video";
export type LabTextureOrigin = "builtin" | "upload";

export interface LabTextureEntry {
  id: string;
  label: string;
  url: string | null;
  kind: LabTextureKind;
  defaultScale: number;
  origin: LabTextureOrigin;
  dark?: UploadTextureVariant;
}

export const LAB_TEXTURES: LabTextureEntry[] = [
  {
    id: "cf-base",
    label: "Cloudflare Base",
    url: `${import.meta.env.BASE_URL}textures/cf-base.png`,
    kind: "image",
    defaultScale: 1,
    origin: "builtin",
  },
];

export const DEFAULT_LAB_TEXTURE_ID = LAB_TEXTURES[0]?.id ?? "cf-base";

export function buildTextureEntries(manifest: UploadEntry[]): LabTextureEntry[] {
  const uploads = manifest.map(
    (e): LabTextureEntry => ({
      id: e.id,
      label: e.label,
      url: null,
      kind: e.kind,
      defaultScale: e.defaultScale,
      origin: "upload",
      ...(e.dark ? { dark: e.dark } : {}),
    }),
  );
  return [...LAB_TEXTURES, ...uploads];
}

export function findTextureEntry(textureId: string, manifest: UploadEntry[]): LabTextureEntry | undefined {
  return buildTextureEntries(manifest).find((t) => t.id === textureId);
}

export interface LoadedTextureSource {
  source: EngineSource;
  video: HTMLVideoElement | null;
  objectUrl: string | null;
  width: number;
  height: number;
}

export function resolveTextureVariant(
  entry: LabTextureEntry,
  theme: "light" | "dark",
): { id: string; kind: LabTextureKind } {
  const variant = entry.origin === "upload" && theme === "dark" ? entry.dark : undefined;
  return {
    id: variant?.id ?? entry.id,
    kind: variant?.kind ?? entry.kind,
  };
}

export function loadTextureSource(
  entry: LabTextureEntry,
  theme: "light" | "dark" = "light",
): Promise<LoadedTextureSource> {
  if (entry.origin === "upload") {
    const variant = resolveTextureVariant(entry, theme);
    return loadUploadSource(variant.id, variant.kind);
  }
  if (entry.url === null) {
    return Promise.reject(new Error(`Missing texture URL: ${entry.id}`));
  }
  return entry.kind === "video" ? loadVideoFromUrl(entry.url, null) : loadImageFromUrl(entry.url, null);
}

export function loadFileSource(file: File): Promise<LoadedTextureSource> {
  const objectUrl = URL.createObjectURL(file);
  const kind: LabTextureKind = file.type.startsWith("video/") ? "video" : "image";
  return kind === "video" ? loadVideoFromUrl(objectUrl, objectUrl) : loadImageFromUrl(objectUrl, objectUrl);
}

async function loadUploadSource(id: string, kind: LabTextureKind): Promise<LoadedTextureSource> {
  const stored = await getTextureBlob(id);
  if (!stored) throw new Error(`Missing stored bytes for upload: ${id}`);
  const objectUrl = URL.createObjectURL(stored.blob);
  return kind === "video" ? loadVideoFromUrl(objectUrl, objectUrl) : loadImageFromUrl(objectUrl, objectUrl);
}

function loadVideoFromUrl(url: string, objectUrl: string | null): Promise<LoadedTextureSource> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    let done = false;
    const finish = () => {
      if (done) return;
      const width = video.videoWidth || 0;
      const height = video.videoHeight || 0;
      if (width <= 0 || height <= 0) return;
      done = true;
      video.play().catch(() => {});
      resolve({ source: video, video, objectUrl, width, height });
    };
    video.src = url;
    video.autoplay = true;
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.onloadedmetadata = finish;
    video.onloadeddata = finish;
    video.oncanplay = finish;
    video.onerror = () => {
      if (!done) reject(new Error(`Failed to load texture: ${url}`));
    };
    if (video.readyState >= 1) finish();
  });
}

function loadImageFromUrl(url: string, objectUrl: string | null): Promise<LoadedTextureSource> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    let done = false;
    const finish = () => {
      if (done) return;
      const width = img.naturalWidth || img.width || 0;
      const height = img.naturalHeight || img.height || 0;
      if (width <= 0 || height <= 0) return;
      done = true;
      resolve({ source: img, video: null, objectUrl, width, height });
    };
    img.onload = finish;
    img.onerror = () => {
      if (!done) reject(new Error(`Failed to load texture: ${url}`));
    };
    img.src = url;
    if (img.complete) queueMicrotask(finish);
    img
      .decode?.()
      .then(finish)
      .catch(() => {});
  });
}
