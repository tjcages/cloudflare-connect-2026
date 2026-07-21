import { LIQUID_NODES } from "./comet-embers.liquid";

const COMET_BODY = `
uniform vec2 uCssSize;
uniform vec2 uNode[${LIQUID_NODES}];
uniform float uNodeR[${LIQUID_NODES}];
uniform float uPresence;
uniform float uCore;
uniform float uTime;

float smoothUnion(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

float bodyDist(vec2 p, float sc) {
  float k = 5.4 * sc;
  float d = 1e5;
  for (int i = 0; i < ${LIQUID_NODES - 1}; i++) {
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

float headBulge(vec2 p, float sc) {
  float r = max(uNodeR[0] * 1.12, 1.0);
  return 1.0 - smoothstep(0.34, 1.0, length(p - uNode[0]) / r);
}
`;

export const COMET_COMPOSITE_FRAG = `#version 300 es
precision highp float;

in vec2 vUv;
uniform sampler2D uField;
uniform sampler2D uHeat;
out vec4 outColor;
${COMET_BODY}
float heatAt(vec2 p) {
  vec2 uv = vec2(p.x / uCssSize.x, 1.0 - p.y / uCssSize.y);
  return texture(uHeat, uv).r;
}

void main() {
  float sc = clamp(min(uCssSize.x, uCssSize.y) / 300.0, 0.5, 2.5);
  vec2 p = vec2(vUv.x, 1.0 - vUv.y) * uCssSize;

  float e = 2.0 * sc;
  float hx = heatAt(p + vec2(e, 0.0)) - heatAt(p - vec2(e, 0.0));
  float hy = heatAt(p + vec2(0.0, e)) - heatAt(p - vec2(0.0, e));
  vec2 emberPush = vec2(hx, hy) * 0.8 / (2.0 * e) * 1250.0 * sc;

  float cx = bodyPush(p + vec2(e, 0.0), sc) - bodyPush(p - vec2(e, 0.0), sc);
  float cy = bodyPush(p + vec2(0.0, e), sc) - bodyPush(p - vec2(0.0, e), sc);
  vec2 cometPush = vec2(cx, cy) / (2.0 * e) * 340.0 * sc * uPresence;
  float cometMag = length(cometPush);
  float cometMax = 12.0 * sc;
  if (cometMag > cometMax) cometPush *= cometMax / cometMag;

  vec2 push = emberPush + cometPush;
  float mag = length(push);
  float maxPush = 54.0 * sc;
  if (mag > maxPush) push *= maxPush / mag;

  vec2 uv = clamp(vUv + vec2(push.x / uCssSize.x, -push.y / uCssSize.y), 0.0, 1.0);
  float base = texture(uField, uv).r;

  vec2 heat = texture(uHeat, vUv).rg;
  float dc = bodyDist(p, sc);
  float core = bodyCore(dc, sc) * uPresence;
  float flick = 0.9 + 0.1 * sin(uTime * 11.3 + sin(uTime * 27.1) * 1.7);
  float head = clamp(headBulge(p, sc) * uCore * uPresence * flick, 0.0, 1.0);

  float aura = bodyRing(dc, sc) * uPresence;
  float emberRim = clamp(heat.r * (1.0 - heat.r) * 4.0, 0.0, 1.0);
  float dim = clamp(aura * 0.74 + emberRim * 0.32, 0.0, 0.84);

  float lit = base * (1.0 - dim);
  float lum = mix(0.93, 1.0, head);
  float value = clamp(mix(lit, lum, core) + min(heat.g, 1.0) * 0.88, 0.0, 1.0);
  outColor = vec4(vec3(value), 1.0);
}
`;

export const EMBER_VERT = `#version 300 es
precision highp float;
in vec4 aEmber;
in float aSeed;
uniform vec2 uCanvas;
out vec2 vLocal;
out float vT;
out float vSeed;
void main() {
  vec2 corner = vec2(float(gl_VertexID == 1 || gl_VertexID == 4 || gl_VertexID == 5), float(gl_VertexID == 2 || gl_VertexID == 3 || gl_VertexID == 5));
  vec2 local = (corner - 0.5) * 2.0;
  vec2 worldPx = aEmber.xy + local * aEmber.z * 3.2;
  vec2 uv = worldPx / uCanvas;
  gl_Position = vec4(uv.x * 2.0 - 1.0, 1.0 - uv.y * 2.0, 0.0, 1.0);
  vLocal = local * 3.2;
  vT = aEmber.w;
  vSeed = aSeed;
}
`;

export const EMBER_FRAG = `#version 300 es
precision highp float;
in vec2 vLocal;
in float vT;
in float vSeed;
uniform float uTime;
out vec4 outColor;
void main() {
  float d2 = dot(vLocal, vLocal);
  float broad = exp(-d2 * 0.62);
  float core = exp(-d2 * 4.6);
  float t = clamp(vT, 0.0, 1.0);
  float cool = pow(1.0 - t, 0.85);
  float flick = 0.82 + 0.18 * sin(uTime * (6.0 + vSeed * 13.0) + vSeed * 61.7);
  float fadeIn = smoothstep(0.0, 0.13, t);
  float fadeOut = 1.0 - smoothstep(0.45, 1.0, t);
  float amp = cool * fadeIn * fadeOut;
  float shade = amp * mix(1.0, flick, smoothstep(0.2, 0.6, t));
  outColor = vec4(broad * amp * 0.7, core * shade * 1.04, 0.0, 1.0);
}
`;
