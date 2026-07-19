export const HADOUKEN_PARTICLES_VERT = `#version 300 es
precision highp float;
uniform float uProgress;
uniform float uSpread;
uniform float uFlight;
uniform vec2 uSizeUv;
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
  vec2 start = vec2(hashLane(id, 2u), hashLane(id, 3u)) * 1.3 - 0.15;
  vec2 target = vec2(0.5) + (vec2(hashLane(id, 4u), hashLane(id, 5u)) - 0.5) * 0.05;
  highp float ease = 1.0 - pow(1.0 - f, 3.0);
  vec2 pos = mix(start, target, ease);
  vec2 delta = target - start;
  highp float len = max(length(delta), 1e-4);
  vec2 dirN = delta / len;
  highp float speed = 3.0 * (1.0 - f) * (1.0 - f) * len;
  highp float stretch = 1.0 + min(6.0, speed * 10.0);
  highp float sizeScale = (0.6 + 0.8 * hashLane(id, 6u)) * (1.0 - 0.6 * ease);
  vec2 halfExt = 0.5 * uSizeUv * sizeScale;
  int vid = gl_VertexID;
  highp float qx = (vid == 1 || vid == 2 || vid == 4) ? 1.0 : 0.0;
  highp float qy = (vid == 2 || vid == 4 || vid == 5) ? 1.0 : 0.0;
  vec2 corner0 = (vec2(qx, qy) - 0.5) * 2.0 * halfExt * vec2(stretch, 1.0);
  vec2 rot = vec2(corner0.x * dirN.x - corner0.y * dirN.y, corner0.x * dirN.y + corner0.y * dirN.x);
  vQuad = vec2(qx, qy);
  highp float fadeIn = smoothstep(0.0, 0.15, f);
  highp float fadeOut = 1.0 - smoothstep(0.85, 1.0, f);
  vVal = (0.55 + 0.45 * hashLane(id, 7u)) * fadeIn * fadeOut;
  gl_Position = vec4((pos + rot) * 2.0 - 1.0, 0.0, 1.0);
}
`;
