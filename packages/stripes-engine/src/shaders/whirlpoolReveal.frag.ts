export const WHIRLPOOL_REVEAL_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uField;
uniform float uProgress;
uniform float uTurns;
uniform float uTightness;
uniform float uStreak;
uniform float uGlow;
uniform float uAspect;
out vec4 finalColor;

highp float sampleWound(highp float r, highp float ang, highp float theta, highp float pull, vec2 asp) {
  highp float A = ang + theta;
  highp float rr = r * (1.0 - pull);
  vec2 uv = 0.5 + (vec2(cos(A), sin(A)) * rr) / asp;
  vec2 inb = step(vec2(0.0), uv) * step(uv, vec2(1.0));
  return texture(uField, uv).r * inb.x * inb.y;
}

highp float spinAngle(highp float falloff, highp float pp) {
  return uTurns * 6.2831853 * falloff * (1.0 + 0.6 * pp);
}

/* Organic, non-circular frontier so the settle boundary never reads as a hard ring. */
highp float frontierWobble(highp float r, highp float ang) {
  return 0.5 * sin(ang * 3.0 + r * 9.0) + 0.32 * sin(ang * 7.0 - r * 15.0 + 1.3)
    + 0.18 * sin(ang * 13.0 + r * 24.0 + 2.7);
}

/* Settling rotates ONWARD to the next whole turn (2pi multiple = identity), never backwards. */
highp float windAngle(highp float r, highp float ang, highp float falloff, highp float maxR, highp float band, highp float pp, out highp float settle) {
  highp float reach = maxR + band * 1.5;
  highp float span = (band / reach) * 2.4;
  highp float pArrive = mix(0.12, 1.0, clamp(r / reach, 0.0, 1.0)) + frontierWobble(r, ang) * 0.07;
  settle = smoothstep(pArrive, pArrive + span, pp);
  highp float spin = spinAngle(falloff, pp);
  highp float landed = ceil(spinAngle(falloff, pArrive + span) / 6.2831853) * 6.2831853;
  return mix(spin, landed, smoothstep(0.0, 1.0, settle));
}

void main() {
  highp float p = clamp(uProgress, 0.0, 1.0);
  if (p >= 1.0) {
    finalColor = vec4(vec3(texture(uField, vUv).r), 1.0);
    return;
  }
  vec2 asp = vec2(uAspect, 1.0);
  vec2 q = (vUv - 0.5) * asp;
  highp float r = length(q);
  highp float ang = atan(q.y, q.x);
  highp float maxR = length(asp) * 0.5;
  highp float band = 0.22 * maxR;
  highp float falloff = uTightness / (r + uTightness);

  highp float settle;
  highp float theta = windAngle(r, ang, falloff, maxR, band, p, settle);
  highp float pull = 0.3 * falloff * (1.0 - settle);

  highp float settle2;
  highp float theta2 = windAngle(r, ang, falloff, maxR, band, min(p + 0.016, 1.0), settle2);
  highp float arc = (theta2 - theta) * (0.5 + 3.5 * uStreak);

  highp float v = 0.0;
  for (int i = 0; i < 5; i++) {
    highp float t = (float(i) - 2.0) / 2.0;
    v += sampleWound(r, ang, theta + arc * t, pull, asp) * 0.2;
  }

  v *= smoothstep(0.0, 0.08, p);
  highp float edge = settle * (1.0 - settle) * 4.0;
  v *= 1.0 + uGlow * 0.22 * edge * edge;
  finalColor = vec4(vec3(v), 1.0);
}
`;
