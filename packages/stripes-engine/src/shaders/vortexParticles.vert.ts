export const VORTEX_PARTICLES_VERT = `#version 300 es
precision highp float;
uniform float uProgress;
uniform float uSpread;
uniform float uFlight;
uniform vec2 uGrid;
uniform float uGlow;
uniform float uIntensity;
uniform float uSwirl;
uniform float uAspect;
uniform sampler2D uField;
out vec2 vQuad;
flat out highp float vVal;

highp uint pcg(highp uint v) {
  v = v * 747796405u + 2891336453u;
  highp uint s = ((v >> ((v >> 28) + 4u)) ^ v) * 277803737u;
  return (s >> 22) ^ s;
}

highp float hashLane(highp uint i, highp uint salt) {
  return float(pcg(i * 747796405u + salt)) * (1.0 / 4294967296.0);
}

vec2 vortexPos(vec2 sUv, vec2 tUv, vec2 asp, highp float total, highp float blend, highp float e) {
  vec2 straight = mix(sUv, tUv, e);
  if (blend <= 0.001) {
    return straight;
  }
  vec2 sv = (sUv - 0.5) * asp;
  vec2 tv = (tUv - 0.5) * asp;
  highp float rt = length(tv);
  highp float aT = rt > 1e-5 ? atan(tv.y, tv.x) : 0.0;
  highp float rMax = length(asp) * 0.5;
  highp float rStart = max(length(sv), rMax * 1.02);
  highp float ang = aT - total * (1.0 - e);
  highp float rr = mix(rStart, rt, e);
  vec2 spiral = 0.5 + (vec2(cos(ang), sin(ang)) * rr) / asp;
  return mix(straight, spiral, blend);
}

void main() {
  highp uint id = uint(gl_InstanceID);
  highp uint cellIndex = id / 3u;
  highp uint k = id - cellIndex * 3u;
  highp float gx = uGrid.x;
  vec2 cell = vec2(mod(float(cellIndex), gx), floor(float(cellIndex) / gx));
  vec2 targetUv = (cell + 0.5) / uGrid;
  vec2 asp = vec2(uAspect, 1.0);
  highp float dn = length((targetUv - 0.5) * asp) / (length(asp) * 0.5);
  highp float o = (dn * 0.7 + (hashLane(cellIndex, 1u) - 0.5) * 0.5 + 0.25) / 1.2;
  o = o < 0.5 ? sqrt(0.5 * o) : 1.0 - sqrt(0.5 * (1.0 - o));
  o = o + float(k) * 0.04 + hashLane(id, 4u) * 0.02;
  highp float p = max(uProgress, 0.0);
  highp float f = (p - uSpread * o) / max(uFlight, 1e-4);
  highp float blockV = texture(uField, targetUv).r;
  if (f <= 0.0 || f >= 1.0 || blockV < 0.02) {
    vQuad = vec2(0.0);
    vVal = 0.0;
    gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
    return;
  }
  highp float dL = targetUv.x;
  highp float dR = 1.0 - targetUv.x;
  highp float dT = targetUv.y;
  highp float dB = 1.0 - targetUv.y;
  highp float jit = (hashLane(id, 2u) - 0.5) * 0.3;
  highp float depth = 0.04 + 0.18 * hashLane(id, 3u);
  vec2 startUv;
  if (dL <= dR && dL <= dT && dL <= dB) {
    startUv = vec2(-depth, targetUv.y + jit);
  } else if (dR <= dT && dR <= dB) {
    startUv = vec2(1.0 + depth, targetUv.y + jit);
  } else if (dT <= dB) {
    startUv = vec2(targetUv.x + jit, -depth);
  } else {
    startUv = vec2(targetUv.x + jit, 1.0 + depth);
  }
  highp float ease = 1.0 - pow(1.0 - f, 3.0);
  highp float swirlTotal = uSwirl * 2.0 * (0.8 + 0.4 * hashLane(id, 5u));
  highp float swirlBlend = min(uSwirl, 1.0);
  vec2 posUv = vortexPos(startUv, targetUv, asp, swirlTotal, swirlBlend, ease);
  highp float f2 = min(f + 0.03, 1.0);
  highp float ease2 = 1.0 - pow(1.0 - f2, 3.0);
  vec2 vel = (vortexPos(startUv, targetUv, asp, swirlTotal, swirlBlend, ease2) - posUv) * asp;
  highp float vlen = length(vel);
  vec2 dirN = vlen > 1e-5 ? vel / vlen : vec2(1.0, 0.0);
  highp float stretch = 1.0 + min(3.5, vlen * 40.0) * uIntensity;
  highp float halfA = 0.5 * (1.0 / uGrid.y) * mix(1.2, 1.0, ease);
  int vid = gl_VertexID;
  highp float qx = (vid == 1 || vid == 2 || vid == 4) ? 1.0 : 0.0;
  highp float qy = (vid == 2 || vid == 4 || vid == 5) ? 1.0 : 0.0;
  vec2 corner0 = (vec2(qx, qy) - 0.5) * 2.0 * halfA * vec2(stretch, 1.0);
  vec2 rot = vec2(corner0.x * dirN.x - corner0.y * dirN.y, corner0.x * dirN.y + corner0.y * dirN.x);
  vec2 uvPos = posUv + rot / asp;
  vQuad = vec2(qx, qy);
  highp float fadeIn = smoothstep(0.0, 0.08, f);
  vVal = blockV * (float(k) + 1.0) / 3.0 * (1.0 + 0.25 * uGlow * (1.0 - f)) * fadeIn;
  gl_Position = vec4(uvPos * 2.0 - 1.0, 0.0, 1.0);
}
`;
