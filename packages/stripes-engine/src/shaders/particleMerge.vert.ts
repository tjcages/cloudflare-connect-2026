export const PARTICLE_MERGE_VERT = `#version 300 es
precision highp float;
uniform sampler2D uField;
uniform float uProgress;
uniform float uSpread;
uniform float uFlight;
uniform vec2 uSizeUv;
uniform float uSwirl;
out vec2 vQuad;
flat out highp float vVal;
flat out highp float vAlpha;

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
  vec2 target = vec2(hashLane(id, 1u), hashLane(id, 2u));
  highp float v = texture(uField, target).r;
  highp float o = hashLane(id, 3u);
  highp float p = max(uProgress, 0.0);
  highp float f = clamp((p - uSpread * o) / max(uFlight, 1e-4), 0.0, 1.0);
  if (v < 0.02 || f <= 0.0) {
    vQuad = vec2(0.0);
    vVal = 0.0;
    vAlpha = 0.0;
    gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
    return;
  }
  vec2 start = vec2(hashLane(id, 4u), hashLane(id, 5u)) * 1.3 - 0.15;
  highp float ease = 1.0 - pow(1.0 - f, 3.0);
  vec2 delta = target - start;
  highp float dist = length(delta);
  vec2 perp = dist > 1e-5 ? vec2(-delta.y, delta.x) / dist : vec2(0.0, 1.0);
  highp float amp = uSwirl * dist * 0.35 * (hashLane(id, 6u) - 0.5) * 2.0;
  vec2 pos = mix(start, target, ease) + perp * sin(ease * 3.14159265) * amp;
  highp float sizeScale = mix(1.6, 1.0, ease) * (0.6 + 0.8 * hashLane(id, 7u));
  vec2 halfExt = 0.5 * uSizeUv * sizeScale;
  int vid = gl_VertexID;
  highp float qx = (vid == 1 || vid == 2 || vid == 4) ? 1.0 : 0.0;
  highp float qy = (vid == 2 || vid == 4 || vid == 5) ? 1.0 : 0.0;
  vec2 corner = pos + (vec2(qx, qy) - 0.5) * 2.0 * halfExt;
  vQuad = vec2(qx, qy);
  vVal = v;
  vAlpha = smoothstep(0.0, 0.2, f);
  gl_Position = vec4(corner * 2.0 - 1.0, 0.0, 1.0);
}
`;
