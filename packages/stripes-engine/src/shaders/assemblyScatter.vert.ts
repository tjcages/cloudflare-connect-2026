export const ASSEMBLY_SCATTER_VERT = `#version 300 es
precision highp float;
uniform vec2 uBlockGrid;
uniform float uProgress;
uniform float uSpread;
uniform float uFlight;
uniform float uSpawnDist;
uniform float uOrder;
out vec2 vSampleUv;

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

highp float orderNorm(highp float col, highp float row, highp float cols, highp float rows) {
  if (uOrder < 0.5) {
    highp float cx = cols <= 1.0 ? 0.5 : (col + 0.5) / cols;
    highp float cy = rows <= 1.0 ? 0.5 : (row + 0.5) / rows;
    return length(vec2(cx - 0.5, cy - 0.5)) / 0.70710678;
  }
  if (uOrder < 1.5) {
    highp float cx = cols <= 1.0 ? 0.5 : (col + 0.5) / cols;
    highp float cy = rows <= 1.0 ? 0.5 : (row + 0.5) / rows;
    return 1.0 - length(vec2(cx - 0.5, cy - 0.5)) / 0.70710678;
  }
  if (uOrder < 2.5) {
    return cols <= 1.0 ? 0.0 : col / (cols - 1.0);
  }
  return cellNoise(col, row, 1.0);
}

void main() {
  highp float bCols = uBlockGrid.x;
  highp float instance = float(gl_InstanceID);
  highp float bx = mod(instance, bCols);
  highp float by = floor(instance / bCols);

  vec2 uv0 = vec2(bx / uBlockGrid.x, by / uBlockGrid.y);
  vec2 uv1 = vec2(min(1.0, (bx + 1.0) / uBlockGrid.x), min(1.0, (by + 1.0) / uBlockGrid.y));
  vec2 blockCenterUv = 0.5 * (uv0 + uv1);

  highp float orderKey = orderNorm(bx, by, uBlockGrid.x, uBlockGrid.y);
  highp float f = clamp((uProgress - uSpread * orderKey) / max(uFlight, 1e-4), 0.0, 1.0);

  if (f <= 0.0) {
    vSampleUv = blockCenterUv;
    gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
    return;
  }

  vec2 toCenter = blockCenterUv - vec2(0.5);
  highp float len = length(toCenter);
  vec2 outwardDir = len < 1e-4 ? vec2(0.0, 1.0) : toCenter / len;

  highp float inv = 1.0 - f;
  highp float ease = 1.0 - inv * inv * inv;
  vec2 offset = (1.0 - ease) * outwardDir * uSpawnDist;

  int vid = gl_VertexID;
  highp float qx = (vid == 1 || vid == 2 || vid == 4) ? 1.0 : 0.0;
  highp float qy = (vid == 2 || vid == 4 || vid == 5) ? 1.0 : 0.0;

  vec2 homeUv = vec2(mix(uv0.x, uv1.x, qx), mix(uv0.y, uv1.y, qy));
  vSampleUv = homeUv;

  vec2 posUv = homeUv + offset;
  gl_Position = vec4(posUv * 2.0 - 1.0, 0.0, 1.0);
}
`;
