export function pixelLuminance(r: number, g: number, b: number): number {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

export function pixelSaturation(r: number, g: number, b: number): number {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  if (max <= 0) {
    return 0;
  }
  return (max - min) / max;
}

export function colorDistanceLuminance(r: number, g: number, b: number, backgroundColor: number): number {
  const bg = backgroundColor & 0xffffff;
  const br = (bg >> 16) & 0xff;
  const bgc = (bg >> 8) & 0xff;
  const bb = bg & 0xff;
  const dr = r - br;
  const dg = g - bgc;
  const db = b - bb;
  return Math.min(1, Math.sqrt(dr * dr + dg * dg + db * db) / (255 * Math.sqrt(3)));
}
