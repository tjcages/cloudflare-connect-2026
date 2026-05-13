/** Parse `#RRGGBB` / `#RGB` hex to Pixi-compatible 0xRRGGBB (no alpha channel). */
export const parseHexColor = (hex: string): number => {
  const normalized = hex.replace("#", "");
  const value = normalized.length === 3 ? normalized.replace(/(.)/g, "$1$1") : normalized;

  return Number.parseInt(value, 16);
};

export const hexToRgbaCss = (hex: string, alpha: number): string => {
  const normalized = hex.replace("#", "");
  const v = normalized.length === 3 ? normalized.replace(/(.)/g, "$1$1") : normalized;
  const red = Number.parseInt(v.slice(0, 2), 16);
  const green = Number.parseInt(v.slice(2, 4), 16);
  const blue = Number.parseInt(v.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
};
