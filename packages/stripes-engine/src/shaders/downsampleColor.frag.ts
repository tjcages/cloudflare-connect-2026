export const DOWNSAMPLE_COLOR_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uField;
uniform vec2 uGridCount;   // cols, rows
out vec4 finalColor;
const int TAPS = 4;
void main() {
  vec2 cell = floor(vUv * uGridCount);
  vec2 cellUv0 = cell / uGridCount;
  vec2 cellSpan = 1.0 / uGridCount;
  vec4 sum = vec4(0.0);
  for (int y = 0; y < TAPS; y++) {
    for (int x = 0; x < TAPS; x++) {
      vec2 t = (vec2(float(x), float(y)) + 0.5) / float(TAPS);
      sum += texture(uField, cellUv0 + t * cellSpan);
    }
  }
  finalColor = sum / float(TAPS * TAPS);
}
`;
