export type SourceRect = { u0: number; v0: number; u1: number; v1: number };

export function resolveSourceRect(
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number,
  fit: "stretch" | "contain" | "cover",
  zoom: number,
  panX: number,
  panY: number,
): SourceRect {
  if (srcH <= 0 || dstH <= 0 || srcW <= 0 || dstW <= 0 || zoom <= 0) {
    return { u0: 0, v0: 0, u1: 1, v1: 1 };
  }
  // base span in source UV (1 = whole source) per axis
  let spanU = 1,
    spanV = 1;
  if (fit !== "stretch") {
    const srcAspect = srcW / srcH;
    const dstAspect = dstW / dstH;
    if (fit === "cover") {
      if (srcAspect > dstAspect) spanU = dstAspect / srcAspect;
      else spanV = srcAspect / dstAspect;
    } else {
      // contain — span may exceed 1 (letterbox), UV overflows [0,1]
      if (srcAspect > dstAspect) spanV = srcAspect / dstAspect;
      else spanU = dstAspect / srcAspect;
    }
  }
  spanU /= zoom;
  spanV /= zoom;
  // pan shifts the rect center by half the rect span per ±1 (so zoom=2,panX=1 ⟹ center 0.75, rect [0.5,1.0])
  const cu = 0.5 + panX * spanU * 0.5;
  const cv = 0.5 + panY * spanV * 0.5;
  return { u0: cu - spanU / 2, v0: cv - spanV / 2, u1: cu + spanU / 2, v1: cv + spanV / 2 };
}
