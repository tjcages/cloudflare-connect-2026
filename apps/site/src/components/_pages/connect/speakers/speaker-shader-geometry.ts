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

/** Image-relative frame; `x`/`y`/`width`/`height` are fractions of the anchor. */
export type ImageRelativeFrame = {
  imageIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  span: boolean;
};

export type ResolvedAuthoredFrame<T extends ImageRelativeFrame> = T & {
  rect: Rect;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

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

const imageRelativeRect = (placement: ImageRelativeFrame, aperture: Rect): Rect => ({
  x: aperture.x + placement.x * aperture.width,
  y: aperture.y + placement.y * aperture.height,
  width: placement.width * aperture.width,
  height: placement.height * aperture.height,
});

/**
 * Resolves authored frames against the live portrait boxes. Coordinates stay
 * locked to each image, so desktop / tablet / mobile reflow keeps the same
 * crop. `span` lets overflow paint neighboring portraits; otherwise overflow
 * clips back to the anchor.
 */
export const resolveAuthoredFrames = <T extends ImageRelativeFrame>(
  placements: readonly T[],
  apertures: readonly Rect[],
): ResolvedAuthoredFrame<T>[] => {
  const resolved: ResolvedAuthoredFrame<T>[] = [];
  for (const placement of placements) {
    const aperture = apertures[placement.imageIndex];
    if (!aperture || aperture.width <= 0 || aperture.height <= 0) continue;
    const rect = imageRelativeRect(placement, aperture);
    if (placement.span) {
      if (rect.width > 0 && rect.height > 0) {
        resolved.push({ ...placement, rect });
      }
      continue;
    }
    const clipped = intersectRects(rect, aperture);
    if (clipped) resolved.push({ ...placement, rect: clipped });
  }
  return resolved;
};

export const createCursorFrame = (
  point: Point,
  portraitBands: readonly Rect[],
  settings: CursorFrameSettings = {},
): CursorFrameSeed | null => {
  const band = portraitBands.find(
    (candidate) =>
      point.x >= candidate.x &&
      point.x <= candidate.x + candidate.width &&
      point.y >= candidate.y &&
      point.y <= candidate.y + candidate.height,
  );
  if (!band) return null;

  const width = clamp(band.width * 0.15 * (settings.widthScale ?? 1), 48, band.width);
  const height = clamp(band.height * 0.34 * (settings.heightScale ?? 1), 40, band.height);
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
  settings: CursorFrameSettings = {},
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
