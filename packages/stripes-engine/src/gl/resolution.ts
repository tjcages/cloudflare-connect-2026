export type Size = { width: number; height: number };

export function clampToMaxTexture(size: Size, maxTextureSize: number): Size {
  const longest = Math.max(size.width, size.height);
  if (longest <= maxTextureSize) {
    return { width: Math.max(1, Math.round(size.width)), height: Math.max(1, Math.round(size.height)) };
  }
  const scale = maxTextureSize / longest;
  return {
    width: Math.max(1, Math.round(size.width * scale)),
    height: Math.max(1, Math.round(size.height * scale)),
  };
}

export function resolveOutputSize(cssWidth: number, cssHeight: number, dpr: number, maxTextureSize: number): Size {
  return clampToMaxTexture({ width: cssWidth * dpr, height: cssHeight * dpr }, maxTextureSize);
}

export function resolveFieldSize(output: Size, fieldScale: number): Size {
  return {
    width: Math.max(1, Math.floor(output.width * fieldScale)),
    height: Math.max(1, Math.floor(output.height * fieldScale)),
  };
}

/**
 * Cap the field chain to the resolution the stripe grid can actually read.
 *
 * With stripes on, the field is consumed only by the downsample passes, which
 * take a fixed `taps × taps` grid of samples per cell at UVs
 * `(taps * cell + i + 0.5) / (taps * grid)`. A field sized exactly
 * `taps * grid` puts a texel centre on every one of those UVs, so each tap
 * resolves to one texel with no interpolation and the downsample becomes an
 * exact box average. Any resolution above that is shaded and thrown away: the
 * extra texels are never sampled, they only blur the tapped ones through
 * bilinear filtering.
 *
 * Never upscales — a field already at or below the cap is returned unchanged.
 */
export function capFieldToTaps(field: Size, cols: number, rows: number, taps: number): Size {
  return {
    width: Math.max(1, Math.min(field.width, Math.ceil(cols * taps))),
    height: Math.max(1, Math.min(field.height, Math.ceil(rows * taps))),
  };
}
