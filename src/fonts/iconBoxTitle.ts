/** CSS/webfont family for the icon-box title strip (Pixi Canvas Text). */
export const ICON_BOX_TITLE_FONT_FAMILY = "Berkeley Mono Trial";

/** Passed to `document.fonts.load` before first render; keep in sync with @font-face in `src/styles/global.css`. */
export const ICON_BOX_TITLE_FONT_LOAD_SPEC = `400 10px "${ICON_BOX_TITLE_FONT_FAMILY}"`;

/** Await before Pixi draws text so Canvas uses the real face (not a fallback). */
export async function preloadIconBoxTitleFont(): Promise<void> {
  if (typeof document === "undefined" || !document.fonts?.load) {
    return;
  }

  try {
    await document.fonts.load(ICON_BOX_TITLE_FONT_LOAD_SPEC);
  } catch {
    /* FontFace unavailable or blocked */
  }
}
