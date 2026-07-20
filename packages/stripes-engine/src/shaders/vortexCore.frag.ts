export const VORTEX_CORE_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uField;
uniform float uProgress;
uniform float uSpread;
uniform float uFlight;
uniform vec2 uGrid;
uniform float uGlow;
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
  if (p >= uSpread * 1.12 + uFlight * 1.25) {
    finalColor = vec4(vec3(texture(uField, vUv).r), 1.0);
    return;
  }
  vec2 cid = floor(vUv * uGrid);
  highp uint cellIndex = uint(cid.y * uGrid.x + cid.x);
  vec2 cellCenter = (cid + 0.5) / uGrid;
  vec2 asp = vec2(uAspect, 1.0);
  highp float dn = length((cellCenter - 0.5) * asp) / (length(asp) * 0.5);
  highp float o = (dn * 0.7 + (hashLane(cellIndex, 1u) - 0.5) * 0.5 + 0.25) / 1.2;
  o = o < 0.5 ? sqrt(0.5 * o) : 1.0 - sqrt(0.5 * (1.0 - o));
  highp float blockV = texture(uField, cellCenter).r;
  highp float fullV = texture(uField, vUv).r;
  highp float accFrac = 0.0;
  highp float lastRaw = 0.0;
  for (uint k = 0u; k < 3u; k++) {
    highp float ok = o + float(k) * 0.04 + hashLane(cellIndex * 3u + k, 4u) * 0.02;
    highp float fr = (p - uSpread * ok) / max(uFlight, 1e-4);
    accFrac += step(1.0, fr) / 3.0;
    if (k == 2u) {
      lastRaw = fr;
    }
  }
  highp float refine = smoothstep(1.0, 1.2, lastRaw);
  highp float flash = step(1.0, lastRaw) * (1.0 - smoothstep(1.0, 1.1, lastRaw));
  highp float v = mix(blockV * accFrac, fullV, refine);
  finalColor = vec4(vec3(v * (1.0 + 0.3 * uGlow * flash)), 1.0);
}
`;
