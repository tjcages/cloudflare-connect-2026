import { Texture } from "pixi.js";

/** Must match @font-face family in the consuming app's CSS (see export AI instructions). */
export const STRIPE_LETTER_FONT_FAMILY = "Berkeley Mono Trial";
export const STRIPE_LETTER_FONT_SIZE_PX = 6;
/** High-res bake; sprites display at logical {@link STRIPE_LETTER_FONT_SIZE_PX} via width/height. */
export const STRIPE_LETTER_RASTER_SCALE = 8;

/** Printable ASCII except space: A–Z, a–z, 0–9, and symbols. */
export const STRIPE_LETTER_CHARSET: readonly string[] = [
  ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  ..."abcdefghijklmnopqrstuvwxyz",
  ..."0123456789",
  ..."!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~",
];

export const STRIPE_LETTER_CANVAS_FONT = `400 ${STRIPE_LETTER_FONT_SIZE_PX}px "${STRIPE_LETTER_FONT_FAMILY}"`;
export const STRIPE_LETTER_FONT_LOAD_SPEC = `400 ${STRIPE_LETTER_FONT_SIZE_PX}px "${STRIPE_LETTER_FONT_FAMILY}"`;

export type StripeLetterRasterGlyph = {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
};

export type StripeLetterGlyph = {
  texture: Texture;
  width: number;
  height: number;
};

export type StripeLetterSvgGlyph = {
  id: string;
  dataUrl: string;
  width: number;
  height: number;
};

export type StripeLetterAtlas = Map<string, StripeLetterGlyph>;

export async function preloadStripeLetterFont(): Promise<void> {
  if (typeof document === "undefined" || !document.fonts?.load) {
    return;
  }

  try {
    await document.fonts.load(STRIPE_LETTER_FONT_LOAD_SPEC);
  } catch {
    /* FontFace unavailable or blocked */
  }
}

export function stripeLetterSvgGlyphId(char: string): string {
  return `stripe-letter-glyph-${char.charCodeAt(0)}`;
}

export function rasterizeStripeLetterGlyph(char: string, scale = STRIPE_LETTER_RASTER_SCALE): StripeLetterRasterGlyph {
  const measureCanvas = document.createElement("canvas");
  const measureCtx = measureCanvas.getContext("2d");
  if (!measureCtx) {
    const fallback = document.createElement("canvas");
    fallback.width = 1;
    fallback.height = 1;
    return { canvas: fallback, width: 1, height: 1 };
  }

  measureCtx.font = STRIPE_LETTER_CANVAS_FONT;
  const metrics = measureCtx.measureText(char);
  const logicalWidth = Math.max(1, Math.ceil(metrics.width));
  const logicalHeight = STRIPE_LETTER_FONT_SIZE_PX;

  const canvas = document.createElement("canvas");
  canvas.width = logicalWidth * scale;
  canvas.height = logicalHeight * scale;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return { canvas, width: logicalWidth, height: logicalHeight };
  }

  ctx.scale(scale, scale);
  ctx.font = STRIPE_LETTER_CANVAS_FONT;
  ctx.fillStyle = "#ffffff";
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.fillText(char, 0, 0);

  return { canvas, width: logicalWidth, height: logicalHeight };
}

export function buildStripeLetterSvgGlyphs(
  charset: readonly string[] = STRIPE_LETTER_CHARSET,
): Map<string, StripeLetterSvgGlyph> {
  const glyphs = new Map<string, StripeLetterSvgGlyph>();
  for (const char of charset) {
    const raster = rasterizeStripeLetterGlyph(char);
    glyphs.set(char, {
      id: stripeLetterSvgGlyphId(char),
      dataUrl: raster.canvas.toDataURL("image/png"),
      width: raster.width,
      height: raster.height,
    });
  }
  return glyphs;
}

function rasterizeStripeLetterTexture(char: string, scale = STRIPE_LETTER_RASTER_SCALE): StripeLetterGlyph {
  const raster = rasterizeStripeLetterGlyph(char, scale);
  const texture = Texture.from(raster.canvas);
  texture.source.scaleMode = "linear";
  return {
    texture,
    width: raster.width,
    height: raster.height,
  };
}

export function buildStripeLetterAtlas(charset: readonly string[] = STRIPE_LETTER_CHARSET): StripeLetterAtlas {
  const atlas: StripeLetterAtlas = new Map();
  for (const char of charset) {
    atlas.set(char, rasterizeStripeLetterTexture(char));
  }
  return atlas;
}

export function destroyStripeLetterAtlas(atlas: StripeLetterAtlas): void {
  for (const glyph of atlas.values()) {
    glyph.texture.destroy(true);
  }
  atlas.clear();
}
