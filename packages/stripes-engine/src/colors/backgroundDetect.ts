const BUCKET_SHIFT = 4;
const BUCKET_SIZE = 1 << BUCKET_SHIFT;
const BUCKET_MASK = ~(BUCKET_SIZE - 1) & 0xff;

export function detectBackgroundColor(pixels: Uint8ClampedArray | Uint8Array, width: number, height: number): number {
  if (width <= 0 || height <= 0 || pixels.length < width * height * 4) {
    return 0x000000;
  }

  const counts = new Map<number, number>();
  const sumR = new Map<number, number>();
  const sumG = new Map<number, number>();
  const sumB = new Map<number, number>();

  const sample = (x: number, y: number) => {
    const i = (y * width + x) * 4;
    const r = pixels[i] & BUCKET_MASK;
    const g = pixels[i + 1] & BUCKET_MASK;
    const b = pixels[i + 2] & BUCKET_MASK;
    const key = (r << 16) | (g << 8) | b;
    counts.set(key, (counts.get(key) ?? 0) + 1);
    sumR.set(key, (sumR.get(key) ?? 0) + pixels[i]);
    sumG.set(key, (sumG.get(key) ?? 0) + pixels[i + 1]);
    sumB.set(key, (sumB.get(key) ?? 0) + pixels[i + 2]);
  };

  for (let x = 0; x < width; x++) {
    sample(x, 0);
    sample(x, height - 1);
  }
  for (let y = 1; y < height - 1; y++) {
    sample(0, y);
    sample(width - 1, y);
  }

  let bestKey = 0;
  let bestCount = 0;
  for (const [key, count] of counts) {
    if (count > bestCount) {
      bestCount = count;
      bestKey = key;
    }
  }

  if (bestCount === 0) {
    return 0x000000;
  }

  const n = bestCount;
  const r = Math.round((sumR.get(bestKey) ?? 0) / n);
  const g = Math.round((sumG.get(bestKey) ?? 0) / n);
  const b = Math.round((sumB.get(bestKey) ?? 0) / n);
  return ((r & 0xff) << 16) | ((g & 0xff) << 8) | (b & 0xff);
}
