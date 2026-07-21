export function buildCometFrag(nodeCount: number): string {
  const links = Math.max(1, nodeCount - 1);
  return `#version 300 es
precision highp float;

uniform sampler2D uField;
uniform sampler2D uHeat;
uniform vec2 uCssSize;
uniform vec2 uNode[${nodeCount}];
uniform float uNodeR[${nodeCount}];
uniform float uPresence;
uniform float uCore;
uniform float uTime;
uniform float uSmoothUnionPx;
uniform vec4 uStyle;

in vec2 vUv;
out vec4 outColor;

float smoothUnion(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

float bodyDist(vec2 p, float sc) {
  float k = max(uSmoothUnionPx * sc, 1e-3);
  float d = 1e5;
  for (int i = 0; i < ${links}; i++) {
    vec2 a = uNode[i];
    vec2 b = uNode[i + 1];
    vec2 ab = b - a;
    float t = clamp(dot(p - a, ab) / max(dot(ab, ab), 1e-4), 0.0, 1.0);
    float r = mix(uNodeR[i], uNodeR[i + 1], t);
    float seg = length(p - (a + ab * t)) - r;
    d = i == 0 ? seg : smoothUnion(d, seg, k);
  }
  return d;
}

float bodyCore(float d, float sc) {
  return 1.0 - smoothstep(-1.15 * sc, 0.15 * sc, d);
}

float bodyRing(float d, float sc) {
  return smoothstep(-0.25 * sc, 1.15 * sc, d) * (1.0 - smoothstep(0.35 * sc, 4.4 * sc, d));
}

float bodyPush(vec2 p, float sc) {
  return (1.0 - smoothstep(-1.5 * sc, 5.0 * sc, bodyDist(p, sc))) * 0.52;
}

float headBulge(vec2 p) {
  float r = max(uNodeR[0] * 1.12, 1.0);
  return 1.0 - smoothstep(0.34, 1.0, length(p - uNode[0]) / r);
}

void main() {
  float sc = clamp(min(uCssSize.x, uCssSize.y) / 300.0, 0.5, 2.5);
  vec2 p = vec2(vUv.x, 1.0 - vUv.y) * uCssSize;

  float e = 2.0 * sc;
  float gx = bodyPush(p + vec2(e, 0.0), sc) - bodyPush(p - vec2(e, 0.0), sc);
  float gy = bodyPush(p + vec2(0.0, e), sc) - bodyPush(p - vec2(0.0, e), sc);
  vec2 push = vec2(gx, gy) / (2.0 * e) * 340.0 * sc * uPresence;
  float mag = length(push);
  float maxPush = uStyle.z * sc;
  if (mag > maxPush) push *= maxPush / max(mag, 1e-5);

  vec2 uv = clamp(vUv + vec2(push.x / uCssSize.x, -push.y / uCssSize.y), 0.0, 1.0);
  float base = texture(uField, uv).r;

  float ember = clamp(texture(uHeat, vUv).g * uStyle.w, 0.0, 1.0);
  float dc = bodyDist(p, sc);
  float core = bodyCore(dc, sc) * uPresence;
  float flick = 0.9 + 0.1 * sin(uTime * 11.3 + sin(uTime * 27.1) * 1.7);
  float head = clamp(headBulge(p) * uCore * uPresence * flick, 0.0, 1.0);

  float aura = bodyRing(dc, sc) * uPresence;
  float dim = clamp(aura * 0.74 * uStyle.y, 0.0, 0.84);

  float lit = base * (1.0 - dim);
  float lum = clamp(mix(0.93, 1.0, head) * uStyle.x, 0.0, 1.0);
  float value = clamp(mix(mix(lit, lum, core), 1.0, ember), 0.0, 1.0);
  outColor = vec4(vec3(value), 1.0);
}
`;
}
