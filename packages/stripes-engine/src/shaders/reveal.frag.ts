export const REVEAL_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uCell;
uniform vec2 uGridCount;
uniform float uRevealMode;
uniform vec2 uOrigin;
uniform float uMaxDist;
uniform float uProgress;
uniform float uSoftness;
uniform float uWaviness;
uniform float uNoiseScale;
uniform float uBandRamp;
uniform float uOrder;
uniform float uAvgTotal;
uniform float uSpread;
out vec4 finalColor;

highp float cellNoise(highp float col, highp float row, highp float scale) {
  highp float s = max(0.1, scale);
  highp float px = floor(col / s);
  highp float py = floor(row / s);
  highp float p3x = fract(px * 0.1031);
  highp float p3y = fract(py * 0.103);
  highp float p3z = fract(px * 0.0973);
  highp float d = p3x * (p3y + 33.33) + p3y * (p3z + 33.33) + p3z * (p3x + 33.33);
  p3x += d;
  p3y += d;
  p3z += d;
  return fract((p3x + p3y) * p3z);
}

highp float assemblyOrderNorm(highp float col, highp float row, highp float cols, highp float rows) {
  if (uOrder < 0.5) {
    highp float cx = cols <= 1.0 ? 0.5 : (col + 0.5) / cols;
    highp float cy = rows <= 1.0 ? 0.5 : (row + 0.5) / rows;
    highp float center = length(vec2(cx - 0.5, cy - 0.5)) / 0.70710678;
    return center;
  }
  if (uOrder < 1.5) {
    highp float cx = cols <= 1.0 ? 0.5 : (col + 0.5) / cols;
    highp float cy = rows <= 1.0 ? 0.5 : (row + 0.5) / rows;
    highp float center = length(vec2(cx - 0.5, cy - 0.5)) / 0.70710678;
    return 1.0 - center;
  }
  if (uOrder < 2.5) {
    return cols <= 1.0 ? 0.0 : col / (cols - 1.0);
  }
  return cellNoise(col, row, 1.0);
}

void main() {
  float v = texture(uCell, vUv).r;
  float mask = 1.0;
  if (uRevealMode > 1.5) {
    vec2 cell = floor(vUv * uGridCount);
    highp float o = assemblyOrderNorm(cell.x, cell.y, uGridCount.x, uGridCount.y);
    highp float start = uSpread * o;
    highp float arrival = start + uAvgTotal;
    mask = smoothstep(arrival, arrival + uBandRamp, max(uProgress, 0.0));
  } else if (uRevealMode > 0.5) {
    vec2 cellUv = vUv;
    float dist = length(cellUv - uOrigin) / max(uMaxDist, 1e-4);
    vec2 cell = floor(vUv * uGridCount);
    float n = (cellNoise(cell.x, cell.y, uNoiseScale) - 0.5) * uWaviness;
    mask = smoothstep(dist - max(uSoftness, 0.0), dist + max(uSoftness, 0.0) + uBandRamp, max(uProgress, 0.0) + n);
  }
  finalColor = vec4(vec3(v * mask), 1.0);
}
`;
