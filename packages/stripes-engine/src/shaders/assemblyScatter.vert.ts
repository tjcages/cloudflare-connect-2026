export const ASSEMBLY_SCATTER_VERT = `#version 300 es
precision highp float;
uniform vec2 uBlockGrid;
uniform float uProgress;
uniform float uSpread;
uniform float uFlight;
uniform float uSpawnDist;
uniform vec2 uScatter;
uniform float uAngleJitter;
uniform vec2 uSigmaUv;
uniform float uBlurStart;
out vec2 vSampleUv;
flat out highp float vBlurAmount;
flat out vec2 vRectMin;
flat out vec2 vRectMax;

highp float fract1(highp float v) {
  return v - floor(v);
}

highp float cellNoise(highp float col, highp float row, highp float scale) {
  highp float s = max(0.1, scale);
  highp float px = floor(col / s);
  highp float py = floor(row / s);
  highp float p3x = fract1(px * 0.1031);
  highp float p3y = fract1(py * 0.103);
  highp float p3z = fract1(px * 0.0973);
  highp float d = p3x * (p3y + 33.33) + p3y * (p3z + 33.33) + p3z * (p3x + 33.33);
  p3x += d;
  p3y += d;
  p3z += d;
  return fract1((p3x + p3y) * p3z);
}

highp float bezierAxis(highp float a1, highp float a2, highp float s) {
  highp float c = 3.0 * a1;
  highp float b = 3.0 * (a2 - a1) - c;
  highp float a = 1.0 - c - b;
  return ((a * s + b) * s + c) * s;
}

highp float bezierSlope(highp float a1, highp float a2, highp float s) {
  highp float c = 3.0 * a1;
  highp float b = 3.0 * (a2 - a1) - c;
  highp float a = 1.0 - c - b;
  return (3.0 * a * s + 2.0 * b) * s + c;
}

highp float cubicBezier(highp float t, highp float x1, highp float y1, highp float x2, highp float y2) {
  highp float s = t;
  for (int i = 0; i < 5; i++) {
    highp float dx = bezierAxis(x1, x2, s) - t;
    highp float d = bezierSlope(x1, x2, s);
    if (abs(d) < 0.00001) break;
    s = clamp(s - dx / d, 0.0, 1.0);
  }
  return bezierAxis(y1, y2, s);
}

highp float orderNorm(highp float col, highp float row, highp float cols, highp float rows) {
  highp float cx = cols <= 1.0 ? 0.5 : (col + 0.5) / cols;
  highp float cy = rows <= 1.0 ? 0.5 : (row + 0.5) / rows;
  return length(vec2(cx - 0.5, cy - 0.5)) / 0.70710678;
}

void main() {
  highp float bCols = uBlockGrid.x;
  highp float instance = float(gl_InstanceID);
  highp float bx = mod(instance, bCols);
  highp float by = floor(instance / bCols);

  vec2 uv0 = vec2(bx / uBlockGrid.x, by / uBlockGrid.y);
  vec2 uv1 = vec2(min(1.0, (bx + 1.0) / uBlockGrid.x), min(1.0, (by + 1.0) / uBlockGrid.y));
  vec2 blockCenterUv = 0.5 * (uv0 + uv1);
  vec2 halfExt = 0.5 * (uv1 - uv0);

  highp float orderKey = orderNorm(bx, by, uBlockGrid.x, uBlockGrid.y);
  highp float f = clamp((uProgress - uSpread * orderKey) / max(uFlight, 1e-4), 0.0, 1.0);

  int vid = gl_VertexID;
  highp float qx = (vid == 1 || vid == 2 || vid == 4) ? 1.0 : 0.0;
  highp float qy = (vid == 2 || vid == 4 || vid == 5) ? 1.0 : 0.0;

  if (f <= 0.0) {
    vSampleUv = blockCenterUv;
    vBlurAmount = 1.0;
    vRectMin = uv0;
    vRectMax = uv1;
    gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
    return;
  }

  highp float dL = blockCenterUv.x;
  highp float dR = 1.0 - blockCenterUv.x;
  highp float dT = blockCenterUv.y;
  highp float dB = 1.0 - blockCenterUv.y;
  vec2 edgeDir;
  highp float edgeDistTo;
  if (dL <= dR && dL <= dT && dL <= dB) { edgeDir = vec2(-1.0, 0.0); edgeDistTo = dL; }
  else if (dR <= dT && dR <= dB) { edgeDir = vec2(1.0, 0.0); edgeDistTo = dR; }
  else if (dT <= dB) { edgeDir = vec2(0.0, -1.0); edgeDistTo = dT; }
  else { edgeDir = vec2(0.0, 1.0); edgeDistTo = dB; }

  highp float ang = (cellNoise(bx + 17.0, by + 23.0, 1.0) - 0.5) * 2.0 * uAngleJitter;
  highp float ca = cos(ang);
  highp float sa = sin(ang);
  edgeDir = vec2(edgeDir.x * ca - edgeDir.y * sa, edgeDir.x * sa + edgeDir.y * ca);

  highp float offMargin = 0.06 + 0.16 * cellNoise(bx, by, 1.0);
  vec2 perp = vec2(-edgeDir.y, edgeDir.x);
  highp float spr = (cellNoise(by + 11.0, bx + 5.0, 1.0) - 0.5) * 0.18;
  vec2 spawnOffset = edgeDir * (edgeDistTo + offMargin) + perp * spr;
  vec2 jitter = vec2(cellNoise(bx + 3.0, by + 7.0, 1.0), cellNoise(bx + 31.0, by + 13.0, 1.0)) - 0.5;
  spawnOffset += jitter * 2.0 * uScatter;

  highp float ease = cubicBezier(f, 0.25, 0.1, 0.25, 1.0);
  vec2 offset = (1.0 - ease) * spawnOffset;

  highp float fBlur = clamp((f - uBlurStart) / max(1.0 - uBlurStart, 1e-4), 0.0, 1.0);
  highp float blurAmount = 1.0 - cubicBezier(fBlur, 0.25, 0.1, 0.25, 1.0);
  vec2 ext = blurAmount * uSigmaUv * 2.0;
  vec2 cornerUv = vec2(mix(uv0.x - ext.x, uv1.x + ext.x, qx), mix(uv0.y - ext.y, uv1.y + ext.y, qy));
  vSampleUv = cornerUv;
  vBlurAmount = blurAmount;
  vRectMin = uv0;
  vRectMax = uv1;

  vec2 posUv = cornerUv + offset;
  gl_Position = vec4(posUv * 2.0 - 1.0, 0.0, 1.0);
}
`;
