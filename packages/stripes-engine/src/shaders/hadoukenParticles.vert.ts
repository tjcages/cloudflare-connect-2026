export const HADOUKEN_PARTICLES_VERT = `#version 300 es
precision highp float;
uniform float uProgress;
uniform float uSpread;
uniform float uFlight;
uniform vec2 uSizeUv;
uniform float uAspect;
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
  highp float o = hashLane(id, 1u);
  highp float p = max(uProgress, 0.0);
  highp float f = clamp((p - uSpread * o) / max(uFlight, 1e-4), 0.0, 1.0);
  if (f <= 0.0 || f >= 1.0) {
    vQuad = vec2(0.0);
    vVal = 0.0;
    gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
    return;
  }
  vec2 startUv = vec2(hashLane(id, 2u), hashLane(id, 3u)) * 1.3 - 0.15;
  vec2 targetUv = vec2(0.5) + (vec2(hashLane(id, 4u), hashLane(id, 5u)) - 0.5) * 0.05;
  vec2 asp = vec2(uAspect, 1.0);
  vec2 rel = (startUv - targetUv) * asp;
  highp float rad = length(rel);
  highp float baseAng = rad > 1e-5 ? atan(rel.y, rel.x) : 0.0;
  highp float orb = step(hashLane(id, 8u), 0.12);
  highp float spin = (hashLane(id, 6u) - 0.5) * 2.0 * mix(1.2, 2.6, hashLane(id, 9u)) * (1.0 - 0.5 * orb);
  highp float wob = sin(f * (7.0 + 6.0 * hashLane(id, 10u)) + hashLane(id, 11u) * 6.2831853) * 0.015 * (1.0 - (1.0 - pow(1.0 - f, 3.0)));
  highp float ease = 1.0 - pow(1.0 - f, 3.0);
  highp float ang = baseAng + spin * ease;
  highp float rr = max(rad * (1.0 - ease) + wob, 0.0);
  vec2 posA = vec2(cos(ang), sin(ang)) * rr;
  highp float f2 = min(f + 0.03, 1.0);
  highp float ease2 = 1.0 - pow(1.0 - f2, 3.0);
  highp float ang2 = baseAng + spin * ease2;
  highp float rr2 = max(rad * (1.0 - ease2) + wob, 0.0);
  vec2 posB = vec2(cos(ang2), sin(ang2)) * rr2;
  vec2 vel = posB - posA;
  highp float vlen = length(vel);
  vec2 dirN = vlen > 1e-5 ? vel / vlen : vec2(1.0, 0.0);
  highp float stretch = mix(1.0 + min(6.0, vlen * 55.0), 1.0, orb);
  highp float sizeScale = (0.6 + 0.8 * hashLane(id, 7u)) * (1.0 - 0.55 * ease) * (1.0 + 1.6 * orb);
  highp float sizeA = 0.5 * uSizeUv.y * sizeScale;
  int vid = gl_VertexID;
  highp float qx = (vid == 1 || vid == 2 || vid == 4) ? 1.0 : 0.0;
  highp float qy = (vid == 2 || vid == 4 || vid == 5) ? 1.0 : 0.0;
  vec2 corner0 = (vec2(qx, qy) - 0.5) * 2.0 * sizeA * vec2(stretch, 1.0);
  vec2 rot = vec2(corner0.x * dirN.x - corner0.y * dirN.y, corner0.x * dirN.y + corner0.y * dirN.x);
  vec2 uvPos = targetUv + (posA + rot) / asp;
  vQuad = vec2(qx, qy);
  highp float fadeIn = smoothstep(0.0, 0.15, f);
  highp float fadeOut = 1.0 - smoothstep(0.85, 1.0, f);
  vVal = (0.55 + 0.45 * hashLane(id, 12u)) * fadeIn * fadeOut * (1.0 + 0.3 * orb);
  gl_Position = vec4(uvPos * 2.0 - 1.0, 0.0, 1.0);
}
`;
