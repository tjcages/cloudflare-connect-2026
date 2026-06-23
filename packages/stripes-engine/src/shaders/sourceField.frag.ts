export const SOURCE_FIELD_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uSource;
uniform vec4 uSrcRect;        // u0,v0,u1,v1
uniform vec2 uTexel;          // 1/sourceW, 1/sourceH
uniform vec3 uBg;             // background rgb 0..1
uniform float uBlur, uSharpen;
uniform float uBlack, uWhite, uGamma, uExposure, uContrast, uBrightThresh;
uniform float uInvert, uPosterize, uNoise;
out vec4 finalColor;

vec3 sampleBox(vec2 uv, float radius) {
  int r = int(radius + 0.5);
  if (r <= 0) return texture(uSource, uv).rgb;
  vec3 sum = vec3(0.0); float n = 0.0;
  for (int y = -4; y <= 4; y++) {
    if (y < -r || y > r) continue;
    for (int x = -4; x <= 4; x++) {
      if (x < -r || x > r) continue;
      sum += texture(uSource, uv + vec2(float(x), float(y)) * uTexel).rgb; n += 1.0;
    }
  }
  return sum / max(1.0, n);
}
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

void main() {
  vec2 uv = mix(uSrcRect.xy, uSrcRect.zw, vUv);
  vec3 col;
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
    col = uBg;
  } else {
    col = sampleBox(uv, uBlur);
    if (uSharpen > 0.0) col = col + (col - sampleBox(uv, max(1.0, uBlur))) * uSharpen;
  }
  // levels
  col = clamp((col - uBlack) / max(1e-4, uWhite - uBlack), 0.0, 1.0);
  col = pow(col, vec3(uGamma));
  col *= exp2(uExposure);
  col = (col - 0.5) * uContrast + 0.5;
  col += vec3(uBrightThresh);
  if (uInvert > 0.5) col = 1.0 - col;
  if (uPosterize >= 2.0) col = floor(col * uPosterize) / max(1.0, uPosterize - 1.0);
  if (uNoise > 0.0) col += vec3((hash(vUv * 4096.0) - 0.5) * uNoise);
  col = clamp(col, 0.0, 1.0);
  float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
  finalColor = vec4(vec3(luma), 1.0);
}
`;
