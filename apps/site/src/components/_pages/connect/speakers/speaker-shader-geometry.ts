export type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type Size = {
  width: number;
  height: number;
};

export type MaskFragment = {
  frameIndex: number;
  apertureIndex: number;
  rect: Rect;
};

export type PartialFramePlan = {
  maskFragments: MaskFragment[];
  outlines: Rect[];
  renderPasses: 0 | 1;
};

type FloatingFrameSpec = {
  row: number;
  width: number;
  height: number;
  y: number;
  fromX: number;
  toX: number;
  durationSec: number;
  phase: number;
};

const FLOATING_FRAME_SPECS: readonly FloatingFrameSpec[] = [
  {
    row: 0,
    width: 0.27,
    height: 0.44,
    y: 0.12,
    fromX: 0.02,
    toX: 0.71,
    durationSec: 18,
    phase: 0.04,
  },
  {
    row: 0,
    width: 0.16,
    height: 0.62,
    y: 0.3,
    fromX: 0.8,
    toX: 0.14,
    durationSec: 23,
    phase: 0.37,
  },
  {
    row: 1,
    width: 0.23,
    height: 0.5,
    y: 0.2,
    fromX: 0.08,
    toX: 0.74,
    durationSec: 21,
    phase: 0.66,
  },
] as const;

/** A stable authored pose used instead of time-based movement in reduced motion. */
export const REDUCED_MOTION_POSE_SEC = 7.25;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const smoothPingPong = (timeSec: number, durationSec: number, phase: number) => {
  const cycle = (((timeSec / durationSec + phase) % 1) + 1) % 1;
  return 0.5 - 0.5 * Math.cos(cycle * Math.PI * 2);
};

export const measureRelativeRect = (root: DOMRect, aperture: DOMRect, zoom = 1): Rect => ({
  x: (aperture.left - root.left) / zoom,
  y: (aperture.top - root.top) / zoom,
  width: aperture.width / zoom,
  height: aperture.height / zoom,
});

export const mapClientPointToRoot = (clientX: number, clientY: number, root: DOMRect, zoom = 1) => ({
  x: (clientX - root.left) / zoom,
  y: (clientY - root.top) / zoom,
});

/** Source crop for CSS `object-fit: cover; object-position: 50% 0%`. */
export const objectCoverSourceRect = (source: Size, destination: Size, positionX = 0.5, positionY = 0): Rect => {
  if (source.width <= 0 || source.height <= 0 || destination.width <= 0 || destination.height <= 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  const scale = Math.max(destination.width / source.width, destination.height / source.height);
  const width = destination.width / scale;
  const height = destination.height / scale;

  return {
    x: (source.width - width) * positionX,
    y: (source.height - height) * positionY,
    width,
    height,
  };
};

export const intersectRects = (a: Rect, b: Rect): Rect | null => {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  if (right <= x || bottom <= y) return null;
  return { x, y, width: right - x, height: bottom - y };
};

/**
 * Converts portrait apertures into full-width visual bands. Frame outlines may
 * cross the horizontal gutters in these bands without ever entering metadata.
 */
export const resolvePortraitBands = (apertures: readonly Rect[], stageWidth: number, rowTolerancePx = 2): Rect[] => {
  const rows: Rect[][] = [];
  for (const aperture of [...apertures].sort((a, b) => a.y - b.y)) {
    const row = rows.find((candidate) => Math.abs(candidate[0].y - aperture.y) <= rowTolerancePx);
    if (row) row.push(aperture);
    else rows.push([aperture]);
  }

  return rows.map((row) => {
    const top = Math.min(...row.map((rect) => rect.y));
    const bottom = Math.max(...row.map((rect) => rect.y + rect.height));
    return { x: 0, y: top, width: stageWidth, height: bottom - top };
  });
};

export const resolveFloatingFrames = (
  timeSec: number,
  portraitBands: readonly Rect[],
  reducedMotion = false,
): Rect[] => {
  if (portraitBands.length === 0) return [];
  const resolvedTime = reducedMotion ? REDUCED_MOTION_POSE_SEC : timeSec;

  return FLOATING_FRAME_SPECS.map((spec) => {
    const band = portraitBands[spec.row % portraitBands.length];
    const width = clamp(band.width * spec.width, 48, band.width);
    const height = clamp(band.height * spec.height, 40, band.height);
    const travel = Math.max(0, band.width - width);
    const progress = smoothPingPong(resolvedTime, spec.durationSec, spec.phase);
    const normalizedX = spec.fromX + (spec.toX - spec.fromX) * progress;

    return {
      x: band.x + clamp(normalizedX, 0, 1) * travel,
      y: band.y + clamp(spec.y, 0, 1) * Math.max(0, band.height - height),
      width,
      height,
    };
  });
};

/** One shader render is reused for every frame/aperture intersection. */
export const buildPartialFramePlan = (frames: readonly Rect[], apertures: readonly Rect[]): PartialFramePlan => {
  const maskFragments: MaskFragment[] = [];
  frames.forEach((frame, frameIndex) => {
    apertures.forEach((aperture, apertureIndex) => {
      const rect = intersectRects(frame, aperture);
      if (rect) maskFragments.push({ frameIndex, apertureIndex, rect });
    });
  });

  return {
    maskFragments,
    outlines: [...frames],
    renderPasses: maskFragments.length > 0 ? 1 : 0,
  };
};
