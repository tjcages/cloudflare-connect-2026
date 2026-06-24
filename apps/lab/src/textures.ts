import type { EngineSource } from "@necatikcl/stripes-engine";
import { createTestImage } from "./testImage";
import type { UploadEntry } from "./uploads";
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
}

export const LAB_TEXTURES: LabTextureEntry[] = [
  {
    id: "cloudflare-footer",
    label: "Footer / Cloudflare",
    url: `${import.meta.env.BASE_URL}textures/cloudflare-footer.svg`,
    kind: "image",
    defaultScale: 2,
    origin: "builtin",
  },
  {
    id: "cta",
    label: "CTA",
    url: `${import.meta.env.BASE_URL}textures/cta.mp4`,
    kind: "video",
    defaultScale: 4,
    origin: "builtin",
  },
];

export const DEFAULT_LAB_TEXTURE_ID = "cloudflare-footer";

export function buildTextureEntries(manifest: UploadEntry[]): LabTextureEntry[] {
  const uploads = manifest.map(
    (e): LabTextureEntry => ({
      id: e.id,
      label: e.label,
      url: null,
      kind: e.kind,
      defaultScale: e.defaultScale,
      origin: "upload",
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
}

export function loadTextureSource(entry: LabTextureEntry): Promise<LoadedTextureSource> {
  if (entry.origin === "upload") return loadUploadSource(entry);
  if (entry.url === null) {
    return Promise.resolve({ source: createTestImage(), video: null, objectUrl: null });
  }
  return entry.kind === "video" ? loadVideoFromUrl(entry.url, null) : loadImageFromUrl(entry.url, null);
}

export function loadFileSource(file: File): Promise<LoadedTextureSource> {
  const objectUrl = URL.createObjectURL(file);
  const kind: LabTextureKind = file.type.startsWith("video/") ? "video" : "image";
  return kind === "video" ? loadVideoFromUrl(objectUrl, objectUrl) : loadImageFromUrl(objectUrl, objectUrl);
}

async function loadUploadSource(entry: LabTextureEntry): Promise<LoadedTextureSource> {
  const stored = await getTextureBlob(entry.id);
  if (!stored) throw new Error(`Missing stored bytes for upload: ${entry.id}`);
  const objectUrl = URL.createObjectURL(stored.blob);
  return entry.kind === "video" ? loadVideoFromUrl(objectUrl, objectUrl) : loadImageFromUrl(objectUrl, objectUrl);
}

function loadVideoFromUrl(url: string, objectUrl: string | null): Promise<LoadedTextureSource> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.src = url;
    video.autoplay = true;
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    video.onloadeddata = () => {
      video.play().catch(() => {});
      resolve({ source: video, video, objectUrl });
    };
    video.onerror = () => reject(new Error(`Failed to load texture: ${url}`));
  });
}

function loadImageFromUrl(url: string, objectUrl: string | null): Promise<LoadedTextureSource> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ source: img, video: null, objectUrl });
    img.onerror = () => reject(new Error(`Failed to load texture: ${url}`));
    img.src = url;
  });
}
