const COMET_POTENTIAL = `
uniform vec2 uCssSize;
uniform vec2 uHead;
uniform vec2 uDir;
uniform float uTail;
uniform float uPresence;
uniform float uTime;

float cometPotential(vec2 p, float sc) {
  vec2 d = p - uHead;
  vec2 side = vec2(-uDir.y, uDir.x);
  float ax = dot(d, uDir);
  float ay = dot(d, side);
  float front = clamp(ax / (30.0 * sc), 0.0, 1.0);
  float rx = mix(36.0, 17.0, front) * sc;
  float ry = 28.0 * sc;
  float bulb = exp(-(ax * ax) / (rx * rx) - (ay * ay) / (ry * ry));
  float t = clamp(-ax / max(uTail, 1.0), 0.0, 1.0);
  float behind = 1.0 - smoothstep(-12.0 * sc, 0.0, ax);
  float w = (13.0 + 36.0 * t) * sc;
  float wobble = sin(ax * 0.05 - uTime * 6.0) * 5.0 * sc * t;
  float lat = ay - wobble;
  float wake = exp(-(lat * lat) / (w * w)) * pow(1.0 - t, 1.15) * behind * 0.92;
  return (bulb + wake) * uPresence;
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

float totalPotential(vec2 p, float sc) {
  return cometPotential(p, sc) + heatAt(p) * 0.8;
}

void main() {
  float sc = clamp(min(uCssSize.x, uCssSize.y) / 300.0, 0.5, 2.5);
  vec2 p = vec2(vUv.x, 1.0 - vUv.y) * uCssSize;

  float e = 2.0 * sc;
  float gx = totalPotential(p + vec2(e, 0.0), sc) - totalPotential(p - vec2(e, 0.0), sc);
  float gy = totalPotential(p + vec2(0.0, e), sc) - totalPotential(p - vec2(0.0, e), sc);
  vec2 push = vec2(gx, gy) / (2.0 * e) * 1250.0 * sc;
  float mag = length(push);
  float maxPush = 54.0 * sc;
  if (mag > maxPush) push *= maxPush / mag;

  vec2 uv = clamp(vUv + vec2(push.x / uCssSize.x, -push.y / uCssSize.y), 0.0, 1.0);
  float base = texture(uField, uv).r;

  vec2 heat = texture(uHeat, vUv).rg;
  float pot = cometPotential(p, sc);
  vec2 d = p - uHead;
  float coreR = 12.0 * sc;
  float flick = 0.9 + 0.1 * sin(uTime * 11.3 + sin(uTime * 27.1) * 1.7);
  float core = exp(-dot(d, d) / (coreR * coreR)) * uPresence * flick;

  float rim = clamp(pot * (1.0 - pot) * 4.0, 0.0, 1.0);
  float emberRim = clamp(heat.r * (1.0 - heat.r) * 4.0, 0.0, 1.0);
  float dim = clamp(rim * 0.44 + emberRim * 0.34, 0.0, 0.72);

  float value = clamp(base * (1.0 - dim) + core * 0.95 + min(heat.g, 1.0) * 0.88, 0.0, 1.0);
  outColor = vec4(vec3(value), 1.0);
}
`;

export const COMET_POST_FRAG = `#version 300 es
precision highp float;

in vec2 vUv;
uniform sampler2D uSrc;
out vec4 outColor;
${COMET_POTENTIAL}
void main() {
  float sc = clamp(min(uCssSize.x, uCssSize.y) / 300.0, 0.5, 2.5);
  vec2 p = vec2(vUv.x, 1.0 - vUv.y) * uCssSize;
  float e = 2.0 * sc;
  float gx = cometPotential(p + vec2(e, 0.0), sc) - cometPotential(p - vec2(e, 0.0), sc);
  float gy = cometPotential(p + vec2(0.0, e), sc) - cometPotential(p - vec2(0.0, e), sc);
  vec2 push = vec2(gx, gy) / (2.0 * e) * 520.0 * sc;
  float mag = length(push);
  float maxPush = 22.0 * sc;
  if (mag > maxPush) push *= maxPush / mag;
  vec2 uv = clamp(vUv + vec2(push.x / uCssSize.x, -push.y / uCssSize.y), 0.0, 1.0);
  outColor = texture(uSrc, uv);
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
