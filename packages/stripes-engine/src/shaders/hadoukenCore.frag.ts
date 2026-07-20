export const HADOUKEN_CORE_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uField;
uniform float uProgress;
uniform float uSpread;
uniform float uFlight;
uniform vec2 uGrid;
uniform float uGlow;
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
  if (p >= uSpread + uFlight * 1.25) {
    finalColor = vec4(vec3(texture(uField, vUv).r), 1.0);
    return;
  }
  vec2 cid = floor(vUv * uGrid);
  highp uint id = uint(cid.y * uGrid.x + cid.x);
  highp float o = hashLane(id, 1u);
  highp float fraw = (p - uSpread * o) / max(uFlight, 1e-4);
  vec2 cellCenter = (cid + 0.5) / uGrid;
  highp float blockV = texture(uField, cellCenter).r;
  highp float on = step(1.0, fraw);
  highp float refine = smoothstep(1.0, 1.2, fraw);
  highp float fullV = texture(uField, vUv).r;
  highp float v = mix(blockV, fullV, refine) * on;
  highp float flash = on * (1.0 - smoothstep(1.0, 1.1, fraw));
  finalColor = vec4(vec3(v * (1.0 + 0.3 * uGlow * flash)), 1.0);
}
`;
