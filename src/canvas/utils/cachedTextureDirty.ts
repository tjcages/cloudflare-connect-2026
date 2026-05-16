/**
 * Helpers for Pixi `cacheAsTexture` layers whose **pixels** rarely change but whose
 * **layout** (position / z-order) changes often — for example during drag.
 *
 * ## Rules
 *
 * - Call {@link classifyCachedTextureDirty} each sync tick with the last persisted
 *   {@link CachedTextureLayoutSnapshot} and content fingerprint.
 * - When the result is **`"content"`**, rebuild or redraw cached descendants, then enable
 *   or refresh caching (`cacheAsTexture(true)` on first build; after inline edits,
 *   `updateCacheTexture()`).
 * - When the result is **`"layout"`**, only update `position` / `zIndex` on the cached
 *   container. **Do not** call `updateCacheTexture()` — translating the cached subtree is cheap.
 * - When the result is **`"none"`**, skip touching the display object entirely.
 *
 * This intentionally ignores pointer-driven churn: layout snapshots come from store state,
 * so high-frequency mouse events only matter when they produce new coordinates in `instances`.
 */

/** Affine layout inputs that affect sorting and placement but not cached raster pixels. */
export type CachedTextureLayoutSnapshot = {
  readonly x: number;
  readonly y: number;
  readonly zIndex: number;
};

export type ClassifyCachedTextureDirtyArgs = {
  readonly priorLayout: CachedTextureLayoutSnapshot | undefined;
  readonly priorContentKey: string | undefined;
  readonly layout: CachedTextureLayoutSnapshot;
  readonly contentKey: string;
};

/** `"none"` → skip work; `"layout"` → move only; `"content"` → rebuild / refresh texture. */
export type CachedTextureDirtyKind = "none" | "layout" | "content";

export function classifyCachedTextureDirty(args: ClassifyCachedTextureDirtyArgs): CachedTextureDirtyKind {
  if (args.priorContentKey !== args.contentKey) {
    return "content";
  }

  const pl = args.priorLayout;
  if (pl === undefined || pl.x !== args.layout.x || pl.y !== args.layout.y || pl.zIndex !== args.layout.zIndex) {
    return "layout";
  }

  return "none";
}

/** Stable fingerprint for marker fills/strokes that depend on props + grid stroke color. */
export function markerVisualContentKey(props: unknown, gridStrokeHex: string): string {
  return `${JSON.stringify(props)}\0${gridStrokeHex}`;
}
