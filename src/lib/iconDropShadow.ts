const hexChannels = (hex: string): [number, number, number] => {
  const normalized = hex.replace("#", "");
  const v = normalized.length === 3 ? normalized.replace(/(.)/g, "$1$1") : normalized;
  return [Number.parseInt(v.slice(0, 2), 16), Number.parseInt(v.slice(2, 4), 16), Number.parseInt(v.slice(4, 6), 16)];
};

export type DropShadowLayerSpec = {
  offsetY: number;
  blur: number;
  alpha: number;
};

/** Icon glyph drop-shadow layers (CSS and Pixi). */
export const ICON_DROP_SHADOW_LAYERS: readonly DropShadowLayerSpec[] = [
  { offsetY: 0.5, blur: 0.5, alpha: 0.12 },
  { offsetY: 1, blur: 1.5, alpha: 0.16 },
  { offsetY: 2, blur: 2.5, alpha: 0.12 },
];

/** Accent bar drop-shadow layers (Pixi). */
export const ACCENT_BAR_DROP_SHADOW_LAYERS: readonly DropShadowLayerSpec[] = [
  { offsetY: 0.5, blur: 0.5, alpha: 0.12 },
  { offsetY: 1, blur: 1, alpha: 0.16 },
  { offsetY: 2, blur: 4, alpha: 0.12 },
  { offsetY: 4, blur: 12, alpha: 0.48 },
];

const dropShadowFilterCss = (colorHex: string, layers: readonly DropShadowLayerSpec[]): string => {
  const [r, g, b] = hexChannels(colorHex);
  return layers
    .map(({ offsetY, blur, alpha }) => `drop-shadow(0 ${offsetY}px ${blur}px rgba(${r}, ${g}, ${b}, ${alpha}))`)
    .join(" ");
};

/** CSS `filter` for tinted icons. */
export const iconDropShadowFilterCss = (colorHex: string): string =>
  dropShadowFilterCss(colorHex, ICON_DROP_SHADOW_LAYERS);

export type IconDropShadowPixiLayer = {
  offsetX: number;
  offsetY: number;
  blur: number;
  spread: number;
  color: number;
  alpha: number;
  inset: boolean;
};

const dropShadowPixiLayers = (colorRgb: number, layers: readonly DropShadowLayerSpec[]): IconDropShadowPixiLayer[] =>
  layers.map(({ offsetY, blur, alpha }) => ({
    offsetX: 0,
    offsetY,
    blur,
    spread: 0,
    color: colorRgb,
    alpha,
    inset: false,
  }));

/** Pixi `BoxShadowFilter` layers matching {@link iconDropShadowFilterCss}. */
export const iconDropShadowPixiLayers = (colorRgb: number): IconDropShadowPixiLayer[] =>
  dropShadowPixiLayers(colorRgb, ICON_DROP_SHADOW_LAYERS);

/** Pixi `BoxShadowFilter` layers for icon-box accent bars. */
export const accentBarDropShadowPixiLayers = (colorRgb: number): IconDropShadowPixiLayer[] =>
  dropShadowPixiLayers(colorRgb, ACCENT_BAR_DROP_SHADOW_LAYERS);
