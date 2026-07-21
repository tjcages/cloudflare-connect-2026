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

highp float sampleWound(vec2 q, highp float r, highp float ang, highp float theta, highp float pull, vec2 asp) {
  highp float A = ang + theta;
  highp float rr = r * (1.0 - pull);
  vec2 uv = 0.5 + (vec2(cos(A), sin(A)) * rr) / asp;
  vec2 inb = step(vec2(0.0), uv) * step(uv, vec2(1.0));
  return texture(uField, uv).r * inb.x * inb.y;
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

  highp float e = p * p * (3.0 - 2.0 * p);
  highp float wind = 1.0 - e;
  highp float falloff = uTightness / (r + uTightness);
  highp float theta = uTurns * 6.2831853 * wind * falloff;
  highp float pull = 0.3 * wind * falloff;

  highp float p2 = min(p + 0.016, 1.0);
  highp float e2 = p2 * p2 * (3.0 - 2.0 * p2);
  highp float dTheta = uTurns * 6.2831853 * (e2 - e) * falloff;
  highp float arc = dTheta * (0.5 + 3.5 * uStreak);

  highp float v = 0.0;
  for (int i = 0; i < 5; i++) {
    highp float t = (float(i) - 2.0) / 2.0;
    v += sampleWound(q, r, ang, theta + arc * t, pull, asp) * 0.2;
  }

  v *= smoothstep(0.0, 0.08, p);
  highp float spin = min(1.0, abs(dTheta) * 30.0);
  v *= 1.0 + uGlow * 0.5 * spin * (1.0 - e);
  finalColor = vec4(vec3(v), 1.0);
}
`;
