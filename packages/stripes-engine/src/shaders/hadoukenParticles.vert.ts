export const HADOUKEN_PARTICLES_VERT = `#version 300 es
precision highp float;
uniform float uProgress;
uniform float uSpread;
uniform float uFlight;
uniform vec2 uGrid;
uniform float uGlow;
uniform float uIntensity;
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

void main() {
  highp uint id = uint(gl_InstanceID);
  highp float gx = uGrid.x;
  vec2 cell = vec2(mod(float(id), gx), floor(float(id) / gx));
  vec2 targetUv = (cell + 0.5) / uGrid;
  vec2 asp = vec2(uAspect, 1.0);
  highp float dn = length((targetUv - 0.5) * asp) / (length(asp) * 0.5);
  highp float o = dn;
  o = o < 0.5 ? sqrt(0.5 * o) : 1.0 - sqrt(0.5 * (1.0 - o));
  highp float p = max(uProgress, 0.0);
  highp float f = (p - uSpread * o) / max(uFlight, 1e-4);
  highp float blockV = texture(uField, targetUv).r;
  if (f <= 0.0 || f >= 1.0 || blockV < 0.02) {
    vQuad = vec2(0.0);
    vVal = 0.0;
    gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
    return;
  }
  highp float sang = hashLane(id, 2u) * 6.2831853;
  vec2 sdir = vec2(cos(sang), sin(sang));
  highp float sdist = 0.25 + 0.55 * hashLane(id, 3u);
  vec2 startUv = targetUv + (sdir * sdist) / asp;
  highp float ease = 1.0 - pow(1.0 - f, 3.0);
  vec2 posUv = mix(startUv, targetUv, ease);
  highp float f2 = min(f + 0.03, 1.0);
  highp float ease2 = 1.0 - pow(1.0 - f2, 3.0);
  vec2 vel = (mix(startUv, targetUv, ease2) - posUv) * asp;
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
  vVal = blockV * (1.0 + 0.25 * uGlow * (1.0 - f)) * fadeIn;
  gl_Position = vec4(uvPos * 2.0 - 1.0, 0.0, 1.0);
}
`;
