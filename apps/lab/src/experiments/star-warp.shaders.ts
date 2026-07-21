export const STAR_WARP_FRAG = `#version 300 es
precision highp float;

uniform sampler2D uField;
uniform vec2 uCssSize;
uniform vec2 uVanish;
uniform float uTime;
uniform float uWarp;
uniform float uWarpDist;

in vec2 vUv;
out vec4 outColor;

const int STAR_COUNT = 56;
const float TAU = 6.2831853;

float hash11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}

void main() {
  float sc = clamp(min(uCssSize.x, uCssSize.y) / 300.0, 0.5, 2.5);
  vec2 pos = vec2(vUv.x, 1.0 - vUv.y) * uCssSize;
  float diag = length(uCssSize) * 0.5;
  float r0 = diag * 0.045;
  float k = log((diag * 1.45) / r0);

  vec2 d = pos - uVanish;
  float r = max(length(d), 1e-3);
  vec2 dir = d / r;
  float ang = atan(d.y, d.x);

  vec2 pull = vec2(0.0);
  float add = 0.0;
  float dim = 0.0;

  for (int i = 0; i < STAR_COUNT; i++) {
    float fi = float(i);
    float h1 = hash11(fi * 1.37 + 3.11);
    float h2 = hash11(fi * 2.71 + 9.43);
    float h3 = hash11(fi * 4.13 + 17.77);
    float h4 = hash11(fi * 5.91 + 29.31);

    float starAng = h1 * TAU + 0.055 * sin(uTime * 0.27 + fi * 1.7);
    float speedMul = 0.55 + 0.95 * h3;
    float z = fract(h2 + uWarpDist * speedMul);

    float dAng = ang - starAng;
    dAng -= TAU * floor(dAng / TAU + 0.5);
    float perp = dAng * r;

    float sizeMul = 0.75 + 0.85 * h4;
    float width = (1.9 + 2.6 * sizeMul) * sc * (0.7 + 0.9 * z);
    float reach = width * 6.5 + 5.0 * sc;
    if (abs(perp) > reach) continue;

    float rHead = r0 * exp(z * k);
    float dz = (0.018 + 0.30 * uWarp) * speedMul;
    float rTail = max(rHead * exp(-dz * k), r0 * 0.3);
    float along = r < rTail ? rTail - r : max(r - rHead, 0.0);
    if (along > reach) continue;

    float dist = length(vec2(perp, along));
    float t = clamp((r - rTail) / max(rHead - rTail, 1e-3), 0.0, 1.0);
    float taper = mix(0.16, 1.0, t * t);
    float life = smoothstep(0.0, 0.07, z) * (1.0 - smoothstep(0.86, 1.0, z));
    float twinkle = 0.82 + 0.18 * sin(uTime * 2.3 + fi * 5.1);

    add += smoothstep(width, width * 0.12, dist) * taper * life * twinkle * (0.85 + 0.5 * uWarp);
    pull -= dir * smoothstep(width * 5.5, 0.0, dist) * life * (3.2 + 34.0 * uWarp) * sc * (0.55 + 0.6 * sizeMul);
    dim += smoothstep(width * 3.2, width * 0.7, dist) * life * (1.0 - t) * 0.1;
  }

  vec2 stretch = -dir * r * uWarp * 0.085 * (0.62 + 0.48 * sin(ang * 3.0 - uTime * 0.4));
  vec2 offset = pull + stretch;
  float offsetLen = length(offset);
  float maxOffset = 96.0 * sc;
  if (offsetLen > maxOffset) offset *= maxOffset / offsetLen;

  vec2 uv = clamp(vUv + vec2(offset.x / uCssSize.x, -offset.y / uCssSize.y), 0.0, 1.0);
  float base = texture(uField, uv).r;
  float value = clamp(base * (1.0 - min(dim, 0.5)) + add, 0.0, 1.0);
  outColor = vec4(vec3(value), 1.0);
}
`;
