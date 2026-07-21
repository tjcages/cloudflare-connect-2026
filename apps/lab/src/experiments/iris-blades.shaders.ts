export const IRIS_BLADES_FRAG = `#version 300 es
precision highp float;

in vec2 vUv;

uniform sampler2D uField;
uniform vec2 uCssSize;
uniform float uRot;
uniform float uAmp;
uniform float uBladeR[7];

out vec4 outColor;

const int N = 7;
const float TAU = 6.2831853;

float hash11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}

float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

void main() {
  float sc = clamp(min(uCssSize.x, uCssSize.y) / 300.0, 0.5, 2.5);
  vec2 pos = vec2(vUv.x, 1.0 - vUv.y) * uCssSize;
  vec2 c = uCssSize * 0.5;
  vec2 d = pos - c;

  float edge[7];
  vec2 normal[7];
  float maxE = -1e9;
  float secondE = -1e9;
  vec2 bestN = vec2(1.0, 0.0);
  float bestR = 0.0;
  float bestId = 0.0;

  for (int i = 0; i < N; i++) {
    float a = uRot + float(i) * TAU / float(N);
    vec2 n = vec2(cos(a), sin(a));
    float ei = dot(d, n) - uBladeR[i];
    normal[i] = n;
    edge[i] = ei;
    if (ei > maxE) {
      secondE = maxE;
      maxE = ei;
      bestN = n;
      bestR = uBladeR[i];
      bestId = float(i);
    } else if (ei > secondE) {
      secondE = ei;
    }
  }

  vec2 warp = vec2(0.0);
  if (uAmp > 0.001) {
    float th = 15.0 * sc;
    for (int i = 0; i < N; i++) {
      float band = edge[i] / th;
      float g = exp(-band * band);
      float dom = exp(-max(maxE - edge[i], 0.0) / (7.0 * sc));
      warp += normal[i] * clamp(band, -2.0, 2.0) * g * dom;
    }
    warp *= 26.0 * sc * uAmp;
  }

  vec2 uv = clamp(vUv + vec2(warp.x / uCssSize.x, -warp.y / uCssSize.y), 0.0, 1.0);
  float image = texture(uField, uv).r;

  vec2 pw = pos + warp;
  float s = dot(pw - c, bestN) - bestR;
  float L = mix(28.0, 44.0, hash11(bestId * 3.1 + 7.0)) * sc;
  float tri = abs(fract(s / L + 0.5) * 2.0 - 1.0);
  float grain = hash21(floor(pw / (3.0 * sc)) + vec2(bestId * 17.0, bestId * 9.0));
  float plate = clamp(0.07 + 0.86 * tri + (grain - 0.5) * 0.07, 0.0, 1.0);

  float seamX = (maxE - secondE) / (3.2 * sc);
  plate = mix(plate, 0.02, 0.88 * exp(-seamX * seamX));

  float lipX = (s - 2.6 * sc) / (2.1 * sc);
  plate = max(plate, exp(-lipX * lipX) * 0.96);

  float mask = smoothstep(0.7 * sc, -0.7 * sc, maxE);
  outColor = vec4(vec3(mix(plate, image, mask)), 1.0);
}
`;
