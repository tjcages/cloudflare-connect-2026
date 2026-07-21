export const MAGNETIC_SIM_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uPrev;
uniform vec2 uTexel;
uniform vec2 uCssSize;
uniform vec4 uMagnet;
uniform float uStrength;
uniform float uRadius;
uniform float uDt;
out vec4 outColor;

void main() {
  vec4 state = texture(uPrev, vUv);
  vec2 align = state.rg;
  vec2 vel = state.ba;
  vec2 avg = 0.25 * (
    texture(uPrev, vUv + vec2(uTexel.x, 0.0)).rg +
    texture(uPrev, vUv - vec2(uTexel.x, 0.0)).rg +
    texture(uPrev, vUv + vec2(0.0, uTexel.y)).rg +
    texture(uPrev, vUv - vec2(0.0, uTexel.y)).rg);
  align = mix(align, avg, min(0.35, uDt * 7.0));
  vec2 acc = align * -42.0 - vel * 6.0;
  vel += acc * uDt;
  align += vel * uDt;
  if (uStrength > 0.001) {
    vec2 p = vUv * uCssSize;
    vec2 magnetPos = uMagnet.xy * uCssSize;
    vec2 dp = p - magnetPos;
    float falloff = exp(-dot(dp, dp) / (2.0 * uRadius * uRadius));
    float w = 1.0 - exp(-uDt * 24.0 * falloff * uStrength);
    align = mix(align, uMagnet.zw * uStrength, w);
    vel *= 1.0 - w;
  }
  outColor = vec4(align, vel);
}
`;

export const MAGNETIC_GRAIN_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uField;
uniform sampler2D uSim;
uniform vec2 uCssSize;
out vec4 outColor;

vec4 hash4(vec2 c) {
  return fract(sin(vec4(
    dot(c, vec2(127.1, 311.7)),
    dot(c, vec2(269.5, 183.3)),
    dot(c, vec2(419.2, 371.9)),
    dot(c, vec2(101.7, 279.3)))) * 43758.5453);
}

void main() {
  float base = texture(uField, vUv).r;
  vec2 p = vUv * uCssSize;
  float cellPx = 13.0;
  vec2 cellId = floor(p / cellPx);
  float g = 0.0;
  for (int oy = -1; oy <= 1; oy++) {
    for (int ox = -1; ox <= 1; ox++) {
      vec2 cell = cellId + vec2(float(ox), float(oy));
      vec4 h = hash4(cell);
      vec2 center = (cell + 0.5) * cellPx + (h.xy - 0.5) * cellPx * 0.8;
      vec2 simState = texture(uSim, center / uCssSize).rg;
      float len = length(simState);
      float m = min(len, 1.0);
      vec2 fieldDir = len > 1e-4 ? simState / len : vec2(1.0, 0.0);
      float baseAngle = h.z * 6.2831853;
      vec2 baseDir = vec2(cos(baseAngle), sin(baseAngle));
      vec2 nearestAxis = fieldDir * (dot(baseDir, fieldDir) < 0.0 ? -1.0 : 1.0);
      float w = smoothstep(0.03, 0.4, m);
      vec2 dir = normalize(mix(baseDir, nearestAxis, w) + vec2(1e-5, 0.0));
      float halfLen = min(cellPx * (0.32 + 0.24 * h.w) * (1.0 + 1.1 * w), cellPx * 0.82);
      float thick = cellPx * (0.085 + 0.045 * h.x);
      vec2 rel = p - center;
      float along = dot(rel, dir);
      float across = dot(rel, vec2(-dir.y, dir.x));
      float clamped = clamp(along, -halfLen, halfLen);
      vec2 dv = vec2(along - clamped, across);
      float core = exp(-dot(dv, dv) / (2.0 * thick * thick));
      float tip = abs(clamped) / halfLen;
      float taper = 1.0 - 0.45 * tip * tip;
      float brightness = (0.55 + 0.45 * fract(h.y * 7.31 + h.z * 3.17)) * (1.0 + 0.5 * w);
      g += core * taper * brightness;
    }
  }
  float grain = smoothstep(0.08, 0.72, g);
  float lum = max(base, 0.22);
  outColor = vec4(vec3(lum * grain), 1.0);
}
`;
