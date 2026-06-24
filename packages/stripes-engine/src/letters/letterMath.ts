const BASE_DELAY_SEC = 0.25;
const JITTER_SEC = 0.3;
const BURST_SEC = 0.18;
const STEP_SEC = 0.045;

const K1 = 137;
const K2 = 61;

function cellHash(col: number, row: number, salt: number): number {
  const x = Math.sin(col * 12.9898 + row * 78.233 + salt * 43.7381) * 43758.5453;
  return x - Math.floor(x);
}

export function letterHash(x: number, y: number): number {
  return cellHash(x, y, 0);
}

export function letterCellPresent(
  col: number,
  row: number,
  cellLuma: number,
  topBandThreshold: number,
  coverage: number,
): boolean {
  if (coverage <= 0) return false;
  if (cellLuma < topBandThreshold) return false;
  return cellHash(col, row, 1) < coverage;
}

export function letterBaseGlyph(col: number, row: number, charsetLen: number): number {
  const h = cellHash(col, row, 2);
  return Math.min(Math.floor(h * charsetLen), charsetLen - 1);
}

export function letterGlyphAt(
  col: number,
  row: number,
  timeSec: number,
  charsetLen: number,
  shuffleSpeed: number,
): number {
  const speed = Math.max(shuffleSpeed, 0.05);
  const jitter = cellHash(col, row, 3);
  const cycleLen = (BASE_DELAY_SEC + jitter * JITTER_SEC) / speed;
  const burstDur = BURST_SEC / speed;
  const stepDur = STEP_SEC / speed;

  const cycleIndex = Math.floor(timeSec / cycleLen);
  const localTime = timeSec - cycleIndex * cycleLen;

  if (localTime >= burstDur) {
    return letterBaseGlyph(col, row, charsetLen);
  }

  const stepIndex = Math.floor(localTime / stepDur);
  const h = cellHash(col + K1 * cycleIndex + K2 * stepIndex, row + K1 * stepIndex + K2 * cycleIndex, 5);
  return Math.min(Math.floor(h * charsetLen), charsetLen - 1);
}
