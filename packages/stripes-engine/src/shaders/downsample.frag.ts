/**
 * Taps per cell axis taken by the two downsample shaders. The field chain is
 * read at exactly these `TAPS * TAPS` UVs per cell and nowhere else, so it is
 * also the only field resolution the stripe output can distinguish — see
 * `capFieldToTaps`.
 */
export const DOWNSAMPLE_TAPS = 4;

export const DOWNSAMPLE_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uField;
uniform vec2 uGridCount;   // cols, rows
out vec4 finalColor;
const int TAPS = ${DOWNSAMPLE_TAPS};
void main() {
  vec2 cell = floor(vUv * uGridCount);
  vec2 cellUv0 = cell / uGridCount;
  vec2 cellSpan = 1.0 / uGridCount;
  float sum = 0.0;
  for (int y = 0; y < TAPS; y++) {
    for (int x = 0; x < TAPS; x++) {
      vec2 t = (vec2(float(x), float(y)) + 0.5) / float(TAPS);
      sum += texture(uField, cellUv0 + t * cellSpan).r;
    }
  }
  finalColor = vec4(vec3(sum / float(TAPS * TAPS)), 1.0);
}
`;
