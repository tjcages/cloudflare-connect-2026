import type { EngineSource } from "@necatikcl/stripes-engine";
import { createTestImage } from "./testImage";

export type LabTextureKind = "image" | "video";

export interface LabTexturePreset {
  id: string;
  label: string;
  url: string | null;
  kind: LabTextureKind;
}

export const LAB_TEXTURES: LabTexturePreset[] = [
  {
    id: "cloudflare-footer",
    label: "Footer / Cloudflare",
    url: `${import.meta.env.BASE_URL}textures/cloudflare-footer.svg`,
    kind: "image",
  },
  { id: "test-gradient", label: "Test / Gradient", url: null, kind: "image" },
];

export const DEFAULT_LAB_TEXTURE_ID = "cloudflare-footer";

export interface LoadedTextureSource {
  source: EngineSource;
  video: HTMLVideoElement | null;
}

export function loadTextureSource(preset: LabTexturePreset): Promise<LoadedTextureSource> {
  if (preset.url === null) {
    return Promise.resolve({ source: createTestImage(), video: null });
  }

  if (preset.kind === "video") {
    return new Promise((resolve, reject) => {
      const video = document.createElement("video");
      video.src = preset.url as string;
      video.autoplay = true;
      video.loop = true;
      video.muted = true;
      video.playsInline = true;
      video.onloadeddata = () => {
        video.play().catch(() => {});
        resolve({ source: video, video });
      };
      video.onerror = () => reject(new Error(`Failed to load texture: ${preset.url}`));
    });
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ source: img, video: null });
    img.onerror = () => reject(new Error(`Failed to load texture: ${preset.url}`));
    img.src = preset.url as string;
  });
}
