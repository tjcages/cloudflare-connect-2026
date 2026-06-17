import { Texture } from "pixi.js";
import { CODE_SNIPPET_FONT_FAMILY } from "./codeSnippet";
import { STRIPE_LETTER_CHARSET, STRIPE_LETTER_FONT_SIZE_PX, STRIPE_LETTER_RASTER_SCALE } from "./stripeLetterConstants";

export { STRIPE_LETTER_CHARSET, STRIPE_LETTER_FONT_SIZE_PX, STRIPE_LETTER_RASTER_SCALE };

export const STRIPE_LETTER_FONT_FAMILY = CODE_SNIPPET_FONT_FAMILY;

export function stripeLetterCanvasFont(fontSizePx: number = STRIPE_LETTER_FONT_SIZE_PX): string {
  return `400 ${fontSizePx}px "${STRIPE_LETTER_FONT_FAMILY}"`;
}

export const STRIPE_LETTER_CANVAS_FONT = stripeLetterCanvasFont();
export const STRIPE_LETTER_FONT_LOAD_SPEC = stripeLetterCanvasFont();

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

export function rasterizeStripeLetterGlyph(
  char: string,
  scale = STRIPE_LETTER_RASTER_SCALE,
  fontSizePx: number = STRIPE_LETTER_FONT_SIZE_PX,
): StripeLetterRasterGlyph {
  const font = stripeLetterCanvasFont(fontSizePx);
  const measureCanvas = document.createElement("canvas");
  const measureCtx = measureCanvas.getContext("2d");
  if (!measureCtx) {
    const fallback = document.createElement("canvas");
    fallback.width = 1;
    fallback.height = 1;
    return { canvas: fallback, width: 1, height: 1 };
  }

  measureCtx.font = font;
  const metrics = measureCtx.measureText(char);
  const logicalWidth = Math.max(1, Math.ceil(metrics.width));
  const logicalHeight = Math.max(1, Math.ceil(fontSizePx));

  const canvas = document.createElement("canvas");
  canvas.width = logicalWidth * scale;
  canvas.height = logicalHeight * scale;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return { canvas, width: logicalWidth, height: logicalHeight };
  }

  ctx.scale(scale, scale);
  ctx.font = font;
  ctx.fillStyle = "#ffffff";
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.fillText(char, 0, 0);

  return { canvas, width: logicalWidth, height: logicalHeight };
}

export function buildStripeLetterSvgGlyphs(
  charset: readonly string[] = STRIPE_LETTER_CHARSET,
  fontSizePx: number = STRIPE_LETTER_FONT_SIZE_PX,
): Map<string, StripeLetterSvgGlyph> {
  const glyphs = new Map<string, StripeLetterSvgGlyph>();
  for (const char of charset) {
    const raster = rasterizeStripeLetterGlyph(char, STRIPE_LETTER_RASTER_SCALE, fontSizePx);
    glyphs.set(char, {
      id: stripeLetterSvgGlyphId(char),
      dataUrl: raster.canvas.toDataURL("image/png"),
      width: raster.width,
      height: raster.height,
    });
  }
  return glyphs;
}

function rasterizeStripeLetterTexture(
  char: string,
  scale = STRIPE_LETTER_RASTER_SCALE,
  fontSizePx: number = STRIPE_LETTER_FONT_SIZE_PX,
): StripeLetterGlyph {
  const raster = rasterizeStripeLetterGlyph(char, scale, fontSizePx);
  const texture = Texture.from(raster.canvas);
  texture.source.scaleMode = "linear";
  return {
    texture,
    width: raster.width,
    height: raster.height,
  };
}

export function buildStripeLetterAtlas(
  charset: readonly string[] = STRIPE_LETTER_CHARSET,
  fontSizePx: number = STRIPE_LETTER_FONT_SIZE_PX,
): StripeLetterAtlas {
  const atlas: StripeLetterAtlas = new Map();
  for (const char of charset) {
    atlas.set(char, rasterizeStripeLetterTexture(char, STRIPE_LETTER_RASTER_SCALE, fontSizePx));
  }
  return atlas;
}

export function destroyStripeLetterAtlas(atlas: StripeLetterAtlas): void {
  for (const glyph of atlas.values()) {
    glyph.texture.destroy(true);
  }
  atlas.clear();
}
