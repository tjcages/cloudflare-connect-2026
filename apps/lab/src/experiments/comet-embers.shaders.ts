import { COMET_PATH_POINTS } from "./comet-embers.path";

const COMET_POTENTIAL = `
uniform vec2 uCssSize;
uniform vec2 uHead;
uniform vec2 uDir;
uniform float uHeadR;
uniform float uPresence;
uniform float uCore;
uniform float uTime;
uniform float uPathCount;
uniform vec2 uPath[${COMET_PATH_POINTS}];

float nucleusShape(vec2 p, float sc) {
  vec2 d = p - uHead;
  vec2 side = vec2(-uDir.y, uDir.x);
  float r = max(uHeadR * sc, 1.0);
  float ax = dot(d, uDir);
  float ay = dot(d, side);
  float f = ax >= 0.0 ? ax / (r * 1.02) : ax / (r * 1.62);
  float taper = 1.0 - 0.4 * clamp(-f, 0.0, 1.0);
  float lat = ay / max(r * 0.84 * taper, 0.35);
  float q = sqrt(f * f + lat * lat + 1e-5);
  return 1.0 - smoothstep(0.68, 1.0, q);
}

float tailShape(vec2 p, float sc) {
  int n = int(uPathCount + 0.5);
  if (n < 2) return 0.0;
  float last = float(n - 1);
  float w0 = max(uHeadR * sc * 0.86, 1.0);
  float best = 0.0;
  for (int i = 0; i < ${COMET_PATH_POINTS - 1}; i++) {
    if (i >= n - 1) break;
    vec2 a = uPath[i];
    vec2 b = uPath[i + 1];
    vec2 ab = b - a;
    float t = clamp(dot(p - a, ab) / max(dot(ab, ab), 1e-3), 0.0, 1.0);
    vec2 c = a + ab * t;
    vec2 e = p - c;
    float u = (float(i) + t) / last;
    float w = w0 * mix(1.0, 0.14, u);
    float amp = pow(max(1.0 - u, 0.0), 1.15);
    float q = length(e) / max(w, 0.6);
    best = max(best, (1.0 - smoothstep(0.46, 1.0, q)) * amp);
  }
  return best;
}

float cometShape(vec2 p, float sc) {
  return max(nucleusShape(p, sc) * uCore, tailShape(p, sc) * uPresence * 0.86);
}

float cometPotential(vec2 p, float sc) {
  return cometShape(p, sc) * 0.52;
}
`;

export const COMET_COMPOSITE_FRAG = `#version 300 es
precision highp float;

in vec2 vUv;
uniform sampler2D uField;
uniform sampler2D uHeat;
out vec4 outColor;
${COMET_POTENTIAL}
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

  float cx = cometPotential(p + vec2(e, 0.0), sc) - cometPotential(p - vec2(e, 0.0), sc);
  float cy = cometPotential(p + vec2(0.0, e), sc) - cometPotential(p - vec2(0.0, e), sc);
  vec2 cometPush = vec2(cx, cy) / (2.0 * e) * 300.0 * sc;
  float cometMag = length(cometPush);
  float cometMax = 10.0 * sc;
  if (cometMag > cometMax) cometPush *= cometMax / cometMag;

  vec2 push = emberPush + cometPush;
  float mag = length(push);
  float maxPush = 54.0 * sc;
  if (mag > maxPush) push *= maxPush / mag;

  vec2 uv = clamp(vUv + vec2(push.x / uCssSize.x, -push.y / uCssSize.y), 0.0, 1.0);
  float base = texture(uField, uv).r;

  vec2 heat = texture(uHeat, vUv).rg;
  float nuc = nucleusShape(p, sc) * uCore;
  float tail = tailShape(p, sc) * uPresence;
  float shape = max(nuc, tail * 0.86);
  float flick = 0.9 + 0.1 * sin(uTime * 11.3 + sin(uTime * 27.1) * 1.7);
  float core = pow(nuc, 1.5) * flick;

  float rim = clamp(shape * (1.0 - shape) * 4.0, 0.0, 1.0);
  float emberRim = clamp(heat.r * (1.0 - heat.r) * 4.0, 0.0, 1.0);
  float dim = clamp(rim * 0.44 + emberRim * 0.34, 0.0, 0.72);

  float value = clamp(
    base * (1.0 - dim) + core * 0.95 + pow(tail, 1.4) * 0.3 + min(heat.g, 1.0) * 0.88,
    0.0,
    1.0
  );
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
