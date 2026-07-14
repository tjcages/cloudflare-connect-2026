import { buildLetterAtlas, createLetterAtlasTexture } from "./letterAtlas";
import { buildTextGlyphMap, textGlyphMapKey } from "./textGlyphMap";
import { createDataTexture, updateDataTexture } from "../gl/dataTexture";

export type LetterResources = {
  readonly atlasTex: WebGLTexture | null;
  readonly atlasGrid: [number, number];
  readonly dummyTex: WebGLTexture | null;
  ensureAtlas(fontFamily: string): void;
  ensureTextMap(
    cols: number,
    rows: number,
    orientation: "vertical" | "horizontal",
    text: string,
    textCopies: number,
  ): WebGLTexture;
  reset(nextGl: WebGL2RenderingContext): void;
  dispose(): void;
};

export function createLetterResources(gl: WebGL2RenderingContext): LetterResources {
  let atlasTex: WebGLTexture | null = null;
  let atlasGrid: [number, number] = [1, 1];
  let atlasFontFamily = "";
  let dummyTex: WebGLTexture | null = null;
  let textGlyphTex: WebGLTexture | null = null;
  let textGlyphKey = "";
  return {
    get atlasTex() {
      return atlasTex;
    },
    get atlasGrid() {
      return atlasGrid;
    },
    get dummyTex() {
      return dummyTex;
    },
    ensureAtlas(fontFamily) {
      if (!atlasTex || atlasFontFamily !== fontFamily) {
        if (atlasTex) gl.deleteTexture(atlasTex);
        const atlas = buildLetterAtlas({ fontFamily });
        atlasTex = createLetterAtlasTexture(gl, atlas);
        atlasGrid = [atlas.gridCols, atlas.gridRows];
        atlasFontFamily = fontFamily;
      }
      if (!dummyTex) {
        dummyTex = createDataTexture(gl, new Uint8Array(4), 1, 1);
      }
    },
    ensureTextMap(cols, rows, orientation, text, textCopies) {
      const key = textGlyphMapKey(cols, rows, orientation, textCopies, text);
      if (textGlyphTex && textGlyphKey === key) return textGlyphTex;
      const bytes = buildTextGlyphMap(cols, rows, orientation, text, textCopies);
      if (textGlyphTex) {
        updateDataTexture(gl, textGlyphTex, bytes, cols, rows);
      } else {
        textGlyphTex = createDataTexture(gl, bytes, cols, rows);
      }
      textGlyphKey = key;
      return textGlyphTex;
    },
    reset(nextGl) {
      gl = nextGl;
      atlasTex = null;
      atlasFontFamily = "";
      dummyTex = null;
      textGlyphTex = null;
      textGlyphKey = "";
    },
    dispose() {
      if (atlasTex) {
        gl.deleteTexture(atlasTex);
        atlasTex = null;
      }
      if (dummyTex) {
        gl.deleteTexture(dummyTex);
        dummyTex = null;
      }
      if (textGlyphTex) {
        gl.deleteTexture(textGlyphTex);
        textGlyphTex = null;
      }
    },
  };
}
