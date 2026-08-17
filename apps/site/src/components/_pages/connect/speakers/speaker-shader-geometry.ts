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

export type Point = {
  x: number;
  y: number;
};

export type CursorFrameSeed = {
  center: Point;
  width: number;
  height: number;
};

export type FloatingFrameSettings = {
  count?: number;
  widthScale?: number;
  heightScale?: number;
  horizontalSpeed?: number;
  verticalSpeed?: number;
};

export type CursorFrameSettings = {
  widthScale?: number;
  heightScale?: number;
  follow?: number;
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
  fromX: number;
  toX: number;
  fromY: number;
  toY: number;
  durationXSec: number;
  durationYSec: number;
  phaseX: number;
  phaseY: number;
};

const FLOATING_FRAME_SPECS: readonly FloatingFrameSpec[] = [
  {
    row: 0,
    width: 0.27,
    height: 0.44,
    fromX: 0.02,
    toX: 0.71,
    fromY: 0.08,
    toY: 0.48,
    durationXSec: 18,
    durationYSec: 13,
    phaseX: 0.04,
    phaseY: 0.28,
  },
  {
    row: 0,
    width: 0.16,
    height: 0.62,
    fromX: 0.8,
    toX: 0.14,
    fromY: 0.3,
    toY: 0.02,
    durationXSec: 23,
    durationYSec: 17,
    phaseX: 0.37,
    phaseY: 0.08,
  },
  {
    row: 0,
    width: 0.19,
    height: 0.3,
    fromX: 0.18,
    toX: 0.68,
    fromY: 0.62,
    toY: 0.12,
    durationXSec: 15,
    durationYSec: 11,
    phaseX: 0.71,
    phaseY: 0.46,
  },
  {
    row: 1,
    width: 0.23,
    height: 0.5,
    fromX: 0.08,
    toX: 0.74,
    fromY: 0.14,
    toY: 0.5,
    durationXSec: 21,
    durationYSec: 14,
    phaseX: 0.66,
    phaseY: 0.16,
  },
  {
    row: 1,
    width: 0.15,
    height: 0.58,
    fromX: 0.8,
    toX: 0.2,
    fromY: 0.04,
    toY: 0.34,
    durationXSec: 25,
    durationYSec: 19,
    phaseX: 0.22,
    phaseY: 0.64,
  },
  {
    row: 1,
    width: 0.12,
    height: 0.3,
    fromX: 0.34,
    toX: 0.7,
    fromY: 0.6,
    toY: 0.16,
    durationXSec: 16,
    durationYSec: 12,
    phaseX: 0.84,
    phaseY: 0.38,
  },
] as const;

export const FLOATING_FRAME_COUNT = FLOATING_FRAME_SPECS.length;

/** A stable authored pose used instead of time-based movement in reduced motion. */
export const REDUCED_MOTION_POSE_SEC = 7.25;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const smoothPingPong = (
  timeSec: number,
  durationSec: number,
  phase: number
) => {
  const cycle = (((timeSec / durationSec + phase) % 1) + 1) % 1;
  return 0.5 - 0.5 * Math.cos(cycle * Math.PI * 2);
};

export const measureRelativeRect = (
  root: DOMRect,
  aperture: DOMRect,
  zoom = 1
): Rect => ({
  x: (aperture.left - root.left) / zoom,
  y: (aperture.top - root.top) / zoom,
  width: aperture.width / zoom,
  height: aperture.height / zoom,
});

export const mapClientPointToRoot = (
  clientX: number,
  clientY: number,
  root: DOMRect,
  zoom = 1
) => ({
  x: (clientX - root.left) / zoom,
  y: (clientY - root.top) / zoom,
});

/** Source crop for CSS `object-fit: cover; object-position: 50% 0%`. */
export const objectCoverSourceRect = (
  source: Size,
  destination: Size,
  positionX = 0.5,
  positionY = 0
): Rect => {
  if (
    source.width <= 0 ||
    source.height <= 0 ||
    destination.width <= 0 ||
    destination.height <= 0
  ) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  const scale = Math.max(
    destination.width / source.width,
    destination.height / source.height
  );
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
export const resolvePortraitBands = (
  apertures: readonly Rect[],
  stageWidth: number,
  rowTolerancePx = 2
): Rect[] => {
  const rows: Rect[][] = [];
  for (const aperture of [...apertures].sort((a, b) => a.y - b.y)) {
    const row = rows.find(
      (candidate) => Math.abs(candidate[0].y - aperture.y) <= rowTolerancePx
    );
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
  settings: FloatingFrameSettings = {}
): Rect[] => {
  if (portraitBands.length === 0) return [];
  const resolvedTime = reducedMotion ? REDUCED_MOTION_POSE_SEC : timeSec;
  const count = clamp(
    Math.round(settings.count ?? FLOATING_FRAME_COUNT),
    0,
    FLOATING_FRAME_COUNT
  );
  const widthScale = clamp(settings.widthScale ?? 1, 0.35, 2);
  const heightScale = clamp(settings.heightScale ?? 1, 0.35, 2);
  const horizontalSpeed = clamp(settings.horizontalSpeed ?? 1, 0, 4);
  const verticalSpeed = clamp(settings.verticalSpeed ?? 1, 0, 4);

  return FLOATING_FRAME_SPECS.slice(0, count).map((spec) => {
    const band = portraitBands[spec.row % portraitBands.length];
    const width = clamp(band.width * spec.width * widthScale, 48, band.width);
    const height = clamp(
      band.height * spec.height * heightScale,
      40,
      band.height
    );
    const travel = Math.max(0, band.width - width);
    const progressX = smoothPingPong(
      resolvedTime * horizontalSpeed,
      spec.durationXSec,
      spec.phaseX
    );
    const progressY = smoothPingPong(
      resolvedTime * verticalSpeed,
      spec.durationYSec,
      spec.phaseY
    );
    const normalizedX = spec.fromX + (spec.toX - spec.fromX) * progressX;
    const normalizedY = spec.fromY + (spec.toY - spec.fromY) * progressY;

    return {
      x: band.x + clamp(normalizedX, 0, 1) * travel,
      y: band.y + clamp(normalizedY, 0, 1) * Math.max(0, band.height - height),
      width,
      height,
    };
  });
};

export const createCursorFrame = (
  point: Point,
  portraitBands: readonly Rect[],
  settings: CursorFrameSettings = {}
): CursorFrameSeed | null => {
  const band = portraitBands.find(
    (candidate) =>
      point.x >= candidate.x &&
      point.x <= candidate.x + candidate.width &&
      point.y >= candidate.y &&
      point.y <= candidate.y + candidate.height
  );
  if (!band) return null;

  const width = clamp(
    band.width * 0.15 * (settings.widthScale ?? 1),
    48,
    band.width
  );
  const height = clamp(
    band.height * 0.34 * (settings.heightScale ?? 1),
    40,
    band.height
  );
  const center = {
    x: clamp(point.x, band.x + width / 2, band.x + band.width - width / 2),
    y: clamp(point.y, band.y + height / 2, band.y + band.height - height / 2),
  };

  return { center, width, height };
};

export const moveCursorFrame = (
  seed: CursorFrameSeed,
  point: Point,
  portraitBands: readonly Rect[],
  settings: CursorFrameSettings = {}
): CursorFrameSeed => {
  const target = createCursorFrame(point, portraitBands, settings);
  if (!target) return seed;

  const follow = clamp(settings.follow ?? 1, 0.01, 1);
  return {
    center: {
      x: seed.center.x + (target.center.x - seed.center.x) * follow,
      y: seed.center.y + (target.center.y - seed.center.y) * follow,
    },
    width: seed.width + (target.width - seed.width) * follow,
    height: seed.height + (target.height - seed.height) * follow,
  };
};

export const cursorFrameRect = (seed: CursorFrameSeed): Rect => ({
  x: seed.center.x - seed.width / 2,
  y: seed.center.y - seed.height / 2,
  width: seed.width,
  height: seed.height,
});

/** One shader render is reused for every frame/aperture intersection. */
export const buildPartialFramePlan = (
  frames: readonly Rect[],
  apertures: readonly Rect[]
): PartialFramePlan => {
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
