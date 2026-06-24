export const MAX_REDUCE_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uTex;
uniform vec2 uSrcSize;
out vec4 finalColor;
void main() {
  vec2 srcStart = floor(gl_FragCoord.xy) * 4.0;
  float m = 0.0;
  for (int y = 0; y < 4; y++) {
    for (int x = 0; x < 4; x++) {
      vec2 p = (srcStart + vec2(float(x), float(y)) + 0.5) / uSrcSize;
      m = max(m, texture(uTex, p).r);
    }
  }
  finalColor = vec4(m, 0.0, 0.0, 1.0);
}
`;
