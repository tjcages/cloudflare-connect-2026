export const BLACKHOLE_CORE_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
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
uniform float uLens;
uniform float uHorizon;
uniform float uAspect;
out vec4 finalColor;

highp uint pcg(highp uint v) {
  v = v * 747796405u + 2891336453u;
  highp uint s = ((v >> ((v >> 28) + 4u)) ^ v) * 277803737u;
  return (s >> 22) ^ s;
}

highp float hashLane(highp uint i, highp uint salt) {
  return float(pcg(i * 747796405u + salt)) * (1.0 / 4294967296.0);
}

void main() {
  highp float p = max(uProgress, 0.0);
  if (p >= 1.0) {
    finalColor = vec4(vec3(texture(uField, vUv).r), 1.0);
    return;
  }
  vec2 asp = vec2(uAspect, 1.0);
  highp float cornerR = length(asp) * 0.5;
  vec2 q = (vUv - 0.5) * asp;
  highp float r = length(q);
  highp float ang = atan(q.y, q.x);

  highp float formT = uForm > 1e-4 ? clamp(p / uForm, 0.0, 1.0) : 1.0;
  highp float collapseT = uCollapse > 1e-4 ? clamp((p - (1.0 - uCollapse)) / uCollapse, 0.0, 1.0) : 0.0;

  highp float s1 = formT - 1.0;
  highp float grow = 1.0 + 2.70158 * s1 * s1 * s1 + 1.70158 * s1 * s1;
  highp float shrink = pow(1.0 - collapseT, 1.7);
  highp float R = max(uHorizon * grow * shrink * (1.0 + 0.02 * sin(p * 90.0)), 0.0);

  vec2 cid = floor(vUv * uGrid);
  highp uint cellIndex = uint(cid.y * uGrid.x + cid.x);
  vec2 cellCenter = (cid + 0.5) / uGrid;
  vec2 cq = (cellCenter - 0.5) * asp;
  highp float dn = length(cq) / cornerR;
  highp float cang = atan(cq.y, cq.x);
  highp float armW = 0.5 + 0.5 * sin(cang * uArms - dn * (4.0 + 2.0 * uSwirl));
  highp float o = clamp(dn * 0.72 + armW * 0.14 + (hashLane(cellIndex, 1u) - 0.5) * 0.18 + 0.07, 0.0, 1.0);

  highp float blockV = texture(uField, cellCenter).r;
  highp float accFrac = 0.0;
  highp float lastRaw = 0.0;
  for (uint k = 0u; k < 3u; k++) {
    highp float ok = o + float(k) * 0.04 + hashLane(cellIndex * 3u + k, 4u) * 0.02;
    highp float fl = mix(uFlightMin, uFlightMax, hashLane(cellIndex * 3u + k, 6u));
    highp float fr = (p - uForm - uSpread * ok) / max(fl, 1e-4);
    accFrac += step(1.0, fr) / 3.0;
    if (k == 2u) {
      lastRaw = fr;
    }
  }
  highp float refine = smoothstep(1.0, 1.18, lastRaw);
  highp float flash = step(1.0, lastRaw) * (1.0 - smoothstep(1.0, 1.12, lastRaw));

  highp float lensEnv = formT * formT;
  highp float bendBase = pow(R / (r + R + 1e-5), 2.0);
  highp float angLens = uLens * lensEnv * bendBase * 1.5;
  highp float rPull = uLens * lensEnv * bendBase * r * 0.45;
  highp float R2 = uHorizon * 2.5;
  highp float twistEnv = (1.0 - smoothstep(1.0, 1.35, lastRaw)) * (1.0 - collapseT);
  highp float angTwist = uSwirl * 1.4 * twistEnv * (R2 / (r + R2));
  highp float A = ang + angLens + angTwist;
  highp float rr = max(r - rPull, R * 0.9);
  vec2 warpedUv = 0.5 + (vec2(cos(A), sin(A)) * rr) / asp;
  highp float fullV = texture(uField, warpedUv).r;

  highp float v = mix(blockV * accFrac, fullV, refine) * (1.0 + 0.35 * uGlow * flash);
  v *= smoothstep(R * 0.98, R * 1.03, r);

  highp float ringEnv = formT * formT * (1.0 - collapseT * collapseT);
  highp float ring = exp(-pow((r - R * 1.1) / max(R * 0.1, 1e-4), 2.0));
  highp float ringV = ring * uGlow * ringEnv * (0.85 + 0.15 * sin(ang * uArms * 2.0 + p * 50.0));
  highp float hazeBand = exp(-pow((r - R * 1.6) / max(R * 0.85, 1e-4), 2.0));
  highp float haze = uGlow * 0.18 * formT * (1.0 - collapseT) * hazeBand * (0.7 + 0.3 * sin(ang * uArms - dn * 9.0 + p * 40.0));

  highp float ft = smoothstep(0.55, 1.0, collapseT);
  highp float dieOff = 1.0 - smoothstep(0.82, 1.0, collapseT);
  highp float finalFlash = uGlow * 0.75 * step(0.001, ft) * exp(-pow((r - ft * 0.65) / 0.06, 2.0)) * dieOff;

  v = max(v, max(ringV + haze, finalFlash));
  finalColor = vec4(vec3(v), 1.0);
}
`;
