/** Alpha for both icon glyph drop-shadow layers (CSS and Pixi). */
export const ICON_DROP_SHADOW_ALPHA = 0.12;

const hexChannels = (hex: string): [number, number, number] => {
  const normalized = hex.replace("#", "");
  const v = normalized.length === 3 ? normalized.replace(/(.)/g, "$1$1") : normalized;
  return [Number.parseInt(v.slice(0, 2), 16), Number.parseInt(v.slice(2, 4), 16), Number.parseInt(v.slice(4, 6), 16)];
};

/** CSS `filter` for tinted icons: `drop-shadow(0 0.5px 0.5px …) drop-shadow(0 1px 1px …)`. */
export const iconDropShadowFilterCss = (colorHex: string): string => {
  const [r, g, b] = hexChannels(colorHex);
  const c = `rgba(${r}, ${g}, ${b}, ${ICON_DROP_SHADOW_ALPHA})`;
  return `drop-shadow(0 0.5px 0.5px ${c}) drop-shadow(0 1px 1px ${c})`;
};

export type IconDropShadowPixiLayer = {
  offsetX: number;
  offsetY: number;
  blur: number;
  spread: number;
  color: number;
  alpha: number;
  inset: boolean;
};

/** Pixi `BoxShadowFilter` layers matching {@link iconDropShadowFilterCss}. */
export const iconDropShadowPixiLayers = (colorRgb: number): IconDropShadowPixiLayer[] => [
  {
    offsetX: 0,
    offsetY: 0.5,
    blur: 0.5,
    spread: 0,
    color: colorRgb,
    alpha: ICON_DROP_SHADOW_ALPHA,
    inset: false,
  },
  {
    offsetX: 0,
    offsetY: 1,
    blur: 1,
    spread: 0,
    color: colorRgb,
    alpha: ICON_DROP_SHADOW_ALPHA,
    inset: false,
  },
];
