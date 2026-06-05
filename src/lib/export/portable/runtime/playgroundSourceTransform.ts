export type PlaygroundSourceFit = "stretch" | "contain" | "cover";

export type PlaygroundSourceTransform = {
  fit: PlaygroundSourceFit;
  zoom: number;
  panX: number;
  panY: number;
};

export type PlaygroundSize = {
  width: number;
  height: number;
};

export type PlaygroundSourceRect = {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
};

export type PlaygroundDestinationRect = {
  dx: number;
  dy: number;
  dw: number;
  dh: number;
};

export type PlaygroundDrawRects = {
  source: PlaygroundSourceRect;
  destination: PlaygroundDestinationRect;
};

export const DEFAULT_PLAYGROUND_SOURCE_TRANSFORM: PlaygroundSourceTransform = {
  fit: "stretch",
  zoom: 1,
  panX: 0,
  panY: 0,
};

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, numeric));
}

export function normalizePlaygroundSourceTransform(
  input: Partial<PlaygroundSourceTransform> | undefined,
): PlaygroundSourceTransform {
  const base = DEFAULT_PLAYGROUND_SOURCE_TRANSFORM;
  if (!input) {
    return { ...base };
  }
  const fit: PlaygroundSourceFit = input.fit === "contain" || input.fit === "cover" ? input.fit : base.fit;
  return {
    fit,
    zoom: clampNumber(input.zoom ?? base.zoom, 0.1, 8, base.zoom),
    panX: clampNumber(input.panX ?? base.panX, -1, 1, base.panX),
    panY: clampNumber(input.panY ?? base.panY, -1, 1, base.panY),
  };
}

function clampRectToSource(rect: PlaygroundSourceRect, source: PlaygroundSize): PlaygroundSourceRect {
  const sw = Math.min(source.width, Math.max(1, rect.sw));
  const sh = Math.min(source.height, Math.max(1, rect.sh));
  return {
    sx: Math.min(source.width - sw, Math.max(0, rect.sx)),
    sy: Math.min(source.height - sh, Math.max(0, rect.sy)),
    sw,
    sh,
  };
}

export function resolvePlaygroundSourceRect(
  source: PlaygroundSize,
  display: PlaygroundSize,
  transformInput: PlaygroundSourceTransform,
): PlaygroundSourceRect {
  const transform = normalizePlaygroundSourceTransform(transformInput);
  if (source.width <= 0 || source.height <= 0 || display.width <= 0 || display.height <= 0) {
    return { sx: 0, sy: 0, sw: Math.max(1, source.width), sh: Math.max(1, source.height) };
  }
  if (transform.fit === "contain") {
    return { sx: 0, sy: 0, sw: source.width, sh: source.height };
  }
  const sourceAspect = source.width / source.height;
  const displayAspect = display.width / display.height;
  let sw = source.width;
  let sh = source.height;
  if (transform.fit === "cover") {
    if (sourceAspect > displayAspect) {
      sw = source.height * displayAspect;
    } else {
      sh = source.width / displayAspect;
    }
  }
  sw /= transform.zoom;
  sh /= transform.zoom;
  const availableX = source.width - sw;
  const availableY = source.height - sh;
  const sx = availableX * 0.5 + transform.panX * availableX * 0.5;
  const sy = availableY * 0.5 + transform.panY * availableY * 0.5;
  return clampRectToSource({ sx, sy, sw, sh }, source);
}

export function resolvePlaygroundDrawRects(
  source: PlaygroundSize,
  display: PlaygroundSize,
  transformInput: PlaygroundSourceTransform,
): PlaygroundDrawRects {
  const transform = normalizePlaygroundSourceTransform(transformInput);
  const sourceRect = resolvePlaygroundSourceRect(source, display, transform);
  if (source.width <= 0 || source.height <= 0 || display.width <= 0 || display.height <= 0) {
    return {
      source: sourceRect,
      destination: { dx: 0, dy: 0, dw: Math.max(1, display.width), dh: Math.max(1, display.height) },
    };
  }
  if (transform.fit !== "contain") {
    return {
      source: sourceRect,
      destination: { dx: 0, dy: 0, dw: display.width, dh: display.height },
    };
  }
  const scale = Math.min(display.width / source.width, display.height / source.height) * transform.zoom;
  const dw = source.width * scale;
  const dh = source.height * scale;
  const availableX = display.width - dw;
  const availableY = display.height - dh;
  return {
    source: sourceRect,
    destination: {
      dx: availableX * 0.5 + transform.panX * availableX * 0.5,
      dy: availableY * 0.5 + transform.panY * availableY * 0.5,
      dw,
      dh,
    },
  };
}
