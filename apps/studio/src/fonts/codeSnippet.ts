/** CSS/webfont family for code-snippet canvas text (Pixi + Pretext). */
export const CODE_SNIPPET_FONT_FAMILY = "Berkeley Mono Trial";

/** Pretext / Canvas font string — keep in sync with @font-face in `src/styles/global.css`. */
export const CODE_SNIPPET_PRETEXT_FONT = `400 12px "${CODE_SNIPPET_FONT_FAMILY}"`;

/** Passed to `document.fonts.load` before first render. */
export const CODE_SNIPPET_FONT_LOAD_SPEC = `400 12px "${CODE_SNIPPET_FONT_FAMILY}"`;

export async function preloadCodeSnippetFont(): Promise<void> {
  if (typeof document === "undefined" || !document.fonts?.load) {
    return;
  }

  try {
    await document.fonts.load(CODE_SNIPPET_FONT_LOAD_SPEC);
  } catch {
    /* FontFace unavailable or blocked */
  }
}
