export const BLACKHOLE_PARTICLES_VERT = `#version 300 es
precision highp float;
uniform sampler2D uField;
uniform float uProgress;
uniform float uForm;
uniform float uSpread;
uniform float uFlightMin;
uniform float uFlightMax;
uniform float uCollapse;
uniform vec2 uGrid;
uniform float uGlow;
uniform float uSwirl;
uniform float uArms;
uniform float uHorizon;
uniform float uIntensity;
uniform float uAspect;
uniform float uDiskCount;
out vec2 vQuad;
flat out highp float vVal;
flat out highp float vSoft;

highp uint pcg(highp uint v) {
  v = v * 747796405u + 2891336453u;
  highp uint s = ((v >> ((v >> 28) + 4u)) ^ v) * 277803737u;
  return (s >> 22) ^ s;
}

highp float hashLane(highp uint i, highp uint salt) {
  return float(pcg(i * 747796405u + salt)) * (1.0 / 4294967296.0);
}

void cull(out vec2 q, out highp float val, out highp float soft) {
  q = vec2(0.0);
  val = 0.0;
  soft = 0.0;
  gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
}

void emitQuad(vec2 posUv, vec2 dirN, highp float halfA, highp float stretch, vec2 asp) {
  int vid = gl_VertexID;
  highp float qx = (vid == 1 || vid == 2 || vid == 4) ? 1.0 : 0.0;
  highp float qy = (vid == 2 || vid == 4 || vid == 5) ? 1.0 : 0.0;
  vec2 corner0 = (vec2(qx, qy) - 0.5) * 2.0 * halfA * vec2(stretch, 1.0);
  vec2 rot = vec2(corner0.x * dirN.x - corner0.y * dirN.y, corner0.x * dirN.y + corner0.y * dirN.x);
  vQuad = vec2(qx, qy);
  gl_Position = vec4((posUv + rot / asp) * 2.0 - 1.0, 0.0, 1.0);
}

void main() {
  highp uint id = uint(gl_InstanceID);
  highp float p = max(uProgress, 0.0);
  vec2 asp = vec2(uAspect, 1.0);
  highp float cornerR = length(asp) * 0.5;

  highp float formT = uForm > 1e-4 ? clamp(p / uForm, 0.0, 1.0) : 1.0;
  highp float collapseT = uCollapse > 1e-4 ? clamp((p - (1.0 - uCollapse)) / uCollapse, 0.0, 1.0) : 0.0;
  highp float s1 = formT - 1.0;
  highp float grow = 1.0 + 2.70158 * s1 * s1 * s1 + 1.70158 * s1 * s1;
  highp float shrink = pow(1.0 - collapseT, 1.7);
  highp float paintT = clamp((p - uForm) / max(1.0 - uForm - uCollapse, 1e-4), 0.0, 1.0);
  highp float decay = 1.0 - 0.92 * smoothstep(0.15, 0.62, paintT);
  highp float R = max(uHorizon * grow * shrink * decay, 0.0);

  if (float(id) < uDiskCount) {
    highp float h1 = hashLane(id, 11u);
    highp float h2 = hashLane(id, 12u);
    highp float h3 = hashLane(id, 13u);
    highp float h5 = hashLane(id, 15u);
    highp float rBase = R * (1.12 + 2.1 * h1 * h1);
    highp float gap = 0.55 + 0.45 * sin(rBase / max(uHorizon, 1e-4) * 11.0);
    highp float infall = smoothstep(0.0, 1.0, formT * formT);
    highp float spiralIn = 1.0 - 0.12 * fract(h3 * 3.7 + p * 0.5);
    highp float rOrb = mix(rBase * 3.2, rBase * spiralIn, infall);
    highp float w = 76.0 / pow(max(rBase / max(uHorizon, 1e-4), 0.5), 1.5);
    highp float angD = h2 * 6.2831853 + w * p;
    highp float env = smoothstep(0.0, 0.6, formT) * pow(1.0 - collapseT, 1.5);
    highp float bright = uGlow * (0.25 + 0.75 * h3) * env * gap;
    if (bright < 0.01 || R < 1e-4) {
      cull(vQuad, vVal, vSoft);
      return;
    }
    vec2 dirN = vec2(-sin(angD), cos(angD));
    vec2 posUv = 0.5 + (vec2(cos(angD), sin(angD)) * rOrb) / asp;
    highp float halfA = (0.5 / uGrid.y) * (0.5 + 0.8 * h5) * (0.6 + 0.7 * h1);
    emitQuad(posUv, dirN, halfA, 2.5 + 6.0 * h1 * (1.0 - h1 * 0.5), asp);
    vVal = bright;
    vSoft = 1.0;
    return;
  }

  highp uint eid = id - uint(uDiskCount);
  highp uint cellIndex = eid / 3u;
  highp uint k = eid - cellIndex * 3u;
  highp float gx = uGrid.x;
  vec2 cell = vec2(mod(float(cellIndex), gx), floor(float(cellIndex) / gx));
  vec2 targetUv = (cell + 0.5) / uGrid;
  vec2 tq = (targetUv - 0.5) * asp;
  highp float dn = length(tq) / cornerR;
  highp float tang = atan(tq.y, tq.x);
  highp float armW = 0.5 + 0.5 * sin(tang * uArms - dn * (5.0 + 3.0 * uSwirl));
  highp float o = clamp(dn * 0.58 + armW * 0.34 + (hashLane(cellIndex, 1u) - 0.5) * 0.08 + 0.02, 0.0, 1.0);
  highp float ok = o + float(k) * 0.04 + hashLane(eid, 4u) * 0.02;
  highp float fl = max(mix(uFlightMin, uFlightMax, hashLane(eid, 6u)), 1e-4);
  highp float f = (p - uForm - uSpread * ok) / fl;
  highp float blockV = texture(uField, targetUv).r;
  if (f <= 0.0 || f >= 1.0 || blockV < 0.02) {
    cull(vQuad, vVal, vSoft);
    return;
  }
  highp float rT = length(tq);
  highp float rS = R * 1.05;
  highp float swirlTotal = uSwirl * (5.8 + 2.6 * hashLane(eid, 5u));
  highp float e = 1.0 - pow(1.0 - f, 3.0);
  highp float A1 = tang + swirlTotal * (1.0 - e);
  highp float r1 = mix(rS, rT, e);
  vec2 posUv = 0.5 + (vec2(cos(A1), sin(A1)) * r1) / asp;
  highp float f2 = min(f + 0.03, 1.0);
  highp float e2 = 1.0 - pow(1.0 - f2, 3.0);
  highp float A2 = tang + swirlTotal * (1.0 - e2);
  highp float r2 = mix(rS, rT, e2);
  vec2 vel = (0.5 + (vec2(cos(A2), sin(A2)) * r2) / asp - posUv) * asp;
  highp float vlen = length(vel);
  vec2 dirN = vlen > 1e-5 ? vel / vlen : vec2(1.0, 0.0);
  highp float stretch = 1.0 + min(3.5, vlen * 40.0) * uIntensity;
  highp float halfA = 0.5 * (1.0 / uGrid.y) * mix(1.2, 1.0, e);
  emitQuad(posUv, dirN, halfA, stretch, asp);
  highp float fadeIn = smoothstep(0.0, 0.08, f);
  vVal = blockV * (float(k) + 1.0) / 3.0 * (1.0 + 0.25 * uGlow * (1.0 - f)) * fadeIn;
  vSoft = 0.0;
}
`;
