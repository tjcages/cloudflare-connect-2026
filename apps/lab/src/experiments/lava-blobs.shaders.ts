import { MAX_BLOBS } from "./lava-blobs.sim";

export const LAVA_BLOBS_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uField;
uniform vec4 uBlobs[${MAX_BLOBS}];
uniform int uCount;
uniform float uAspect;
uniform float uTime;
uniform float uGhost;
out vec4 outColor;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

void main() {
  float base = texture(uField, vUv).r;
  vec2 p = vec2(vUv.x * uAspect, vUv.y);
  float pool = 0.042
    + 0.02 * vnoise(vec2(p.x * 3.5, uTime * 0.09))
    + 0.009 * vnoise(vec2(p.x * 9.0 + 7.3, uTime * 0.14));
  float d = p.y - pool;
  for (int i = 0; i < ${MAX_BLOBS}; i++) {
    if (i >= uCount) break;
    vec4 blob = uBlobs[i];
    float di = length(p - vec2(blob.x * uAspect, blob.y)) - blob.z;
    d = smin(d, di, 0.085);
  }
  d += (vnoise(p * 9.0 + vec2(0.0, -uTime * 0.05)) - 0.5) * 0.012;
  float soft = mix(0.011, 0.05, smoothstep(0.5, 0.95, vUv.y));
  float shape = 1.0 - smoothstep(-soft, soft, d);
  float shade = 1.0 - 0.2 * smoothstep(0.015, 0.11, -d);
  float v = max(base * uGhost, shape * shade);
  outColor = vec4(vec3(v), 1.0);
}
`;
