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
