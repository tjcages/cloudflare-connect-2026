import type { ImageMetadata } from "astro";

const LOCAL_IMAGES = import.meta.glob<{ default: ImageMetadata }>(
  "/src/assets/blog/**/*.{png,jpg,jpeg}",
  { eager: true }
);

export const LOCAL_IMAGE_PREFIX = "@/assets/";

export function isLocalImage(src: string) {
  return src.startsWith(LOCAL_IMAGE_PREFIX);
}

export function resolveLocalImage(src: string): ImageMetadata {
  const path = src.replace(LOCAL_IMAGE_PREFIX, "/src/assets/");
  const module = LOCAL_IMAGES[path];

  if (!module) {
    const message = `Article image "${src}" resolves to "${path}", which does not exist under src/assets/.`;
    console.error(message);
    throw new Error(message);
  }

  return module.default;
}
