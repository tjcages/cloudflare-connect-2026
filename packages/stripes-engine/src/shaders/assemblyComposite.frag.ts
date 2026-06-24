export const ASSEMBLY_COMPOSITE_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uCrisp;
uniform sampler2D uBlurred;
uniform vec2 uBlockGrid;
uniform float uProgress;
uniform float uSpread;
uniform float uFlight;
out vec4 finalColor;

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
  highp float cx = cols <= 1.0 ? 0.5 : (col + 0.5) / cols;
  highp float cy = rows <= 1.0 ? 0.5 : (row + 0.5) / rows;
  return length(vec2(cx - 0.5, cy - 0.5)) / 0.70710678;
}

void main() {
  highp float cols = uBlockGrid.x;
  highp float rows = uBlockGrid.y;
  highp float cx = clamp(floor(vUv.x * cols), 0.0, cols - 1.0);
  highp float cy = clamp(floor(vUv.y * rows), 0.0, rows - 1.0);

  highp float orderKey = orderNorm(cx, cy, cols, rows);
  highp float f = clamp((uProgress - uSpread * orderKey) / max(uFlight, 1e-4), 0.0, 1.0);

  // Each cell sharpens over the last 30% of ITS OWN flight, crisp exactly at landing (f=1).
  highp float sharpness = smoothstep(0.7, 1.0, f);

  vec3 crisp = texture(uCrisp, vUv).rgb;
  vec3 blurred = texture(uBlurred, vUv).rgb;
  vec3 c = mix(blurred, crisp, sharpness);
  finalColor = vec4(c, 1.0);
}
`;
