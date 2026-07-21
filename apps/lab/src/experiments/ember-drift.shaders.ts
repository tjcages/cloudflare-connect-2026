export const EMBER_DRIFT_COMPOSITE_FRAG = `#version 300 es
precision highp float;

in vec2 vUv;
uniform sampler2D uField;
uniform sampler2D uHeat;
uniform vec2 uCssSize;
uniform float uUpdraft;
out vec4 outColor;

float heatAt(vec2 p) {
  vec2 uv = vec2(p.x / uCssSize.x, 1.0 - p.y / uCssSize.y);
  return texture(uHeat, uv).r;
}

void main() {
  float sc = clamp(min(uCssSize.x, uCssSize.y) / 300.0, 0.5, 2.5);
  vec2 p = vec2(vUv.x, 1.0 - vUv.y) * uCssSize;

  float e = 2.0 * sc;
  float gx = heatAt(p + vec2(e, 0.0)) - heatAt(p - vec2(e, 0.0));
  float gy = heatAt(p + vec2(0.0, e)) - heatAt(p - vec2(0.0, e));
  vec2 push = vec2(gx, gy) / (2.0 * e) * 1180.0 * sc * (1.0 + uUpdraft * 0.22);
  float mag = length(push);
  float maxPush = 34.0 * sc;
  if (mag > maxPush) push *= maxPush / mag;

  vec2 uv = clamp(vUv + vec2(push.x / uCssSize.x, -push.y / uCssSize.y), 0.0, 1.0);
  float base = texture(uField, uv).r;

  vec2 heat = texture(uHeat, vUv).rg;
  float rim = clamp(heat.r * (1.0 - heat.r) * 4.0, 0.0, 1.0);
  float dim = clamp(rim * 0.44, 0.0, 0.62);
  float value = clamp(base * (1.0 - dim) + min(heat.g, 1.0) * 0.94, 0.0, 1.0);
  outColor = vec4(vec3(value), 1.0);
}
`;

export const EMBER_DRIFT_VERT = `#version 300 es
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

export const EMBER_DRIFT_FRAG = `#version 300 es
precision highp float;
in vec2 vLocal;
in float vT;
in float vSeed;
uniform float uTime;
uniform float uUpdraft;
out vec4 outColor;
void main() {
  float d2 = dot(vLocal, vLocal);
  float broad = exp(-d2 * 0.62);
  float core = exp(-d2 * 4.6);
  float t = clamp(vT, 0.0, 1.0);
  float cool = pow(1.0 - t, 0.9);
  float flick = 0.9 + 0.1 * sin(uTime * (1.5 + vSeed * 2.6) + vSeed * 61.7);
  float fadeIn = smoothstep(0.0, 0.16, t);
  float fadeOut = 1.0 - smoothstep(0.42, 1.0, t);
  float amp = cool * fadeIn * fadeOut;
  float shade = amp * flick * (1.0 + uUpdraft * 0.3);
  outColor = vec4(broad * amp * 0.8, core * shade * 1.08, 0.0, 1.0);
}
`;
