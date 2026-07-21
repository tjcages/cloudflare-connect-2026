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

const highp float TAU = 6.2831853;
const highp float ARMS = 4.0;
/* Angular speed never drops to nothing at the rim, or the outer ring could not complete a
   turn inside the animation and would have no moment to lock on. */
const highp float SPEED = 37.7;

vec2 mirrorUv(vec2 uv) {
  vec2 m = mod(uv, 2.0);
  return mix(m, 2.0 - m, step(1.0, m));
}

highp float sampleSwirl(highp float r, highp float ang, highp float theta, vec2 asp) {
  highp float A = ang + theta;
  return texture(uField, mirrorUv(0.5 + (vec2(cos(A), sin(A)) * r) / asp)).r;
}

highp float envelopeWobble(highp float r, highp float ang) {
  return 0.5 * sin(ang * 4.0 + r * 9.0) + 0.3 * sin(ang * 8.0 - r * 15.0 + 1.3);
}

void main() {
  highp float p = clamp(uProgress, 0.0, 1.0);
  highp float sharp = texture(uField, vUv).r;
  if (p >= 1.0) {
    finalColor = vec4(vec3(sharp), 1.0);
    return;
  }
  vec2 asp = vec2(uAspect, 1.0);
  vec2 q = (vUv - 0.5) * asp;
  highp float r = length(q);
  highp float ang = atan(q.y, q.x);
  highp float maxR = length(asp) * 0.5;
  highp float rn = clamp(r / max(maxR, 1e-4), 0.0, 1.0);
  highp float falloff = uTightness / (r + uTightness);

  /* Pure differential rotation: wound at the start, spinning faster toward the centre. */
  highp float wound = uTurns * TAU * falloff;
  highp float omega = SPEED * (0.35 + 0.65 * falloff);
  highp float theta = wound + omega * p;

  /* Eligibility spreads outward and along the arms; the lock still happens only on a whole
     turn, so arms differ by exactly one revolution. */
  highp float eligible = mix(0.22, 0.6, rn)
    + (0.5 - 0.5 * cos(ang * ARMS + wound)) * 0.05
    + envelopeWobble(r, ang) * 0.012;

  /* A whole turn means the rotated sample lands back on this very texel: cover == image, so
     locking it in is seamless. The reveal IS the rotation completing. */
  highp float thetaAtEligible = wound + omega * eligible;
  highp float arrival = eligible + mod(-thetaAtEligible, TAU) / omega;
  highp float locked = smoothstep(arrival, arrival + 0.02, p);

  /* Motion blur has to vanish as the lock approaches, otherwise the cover is smeared at the
     exact moment it is supposed to match the image. */
  highp float toLock = clamp((arrival - p) / 0.25, 0.0, 1.0);
  highp float arc = omega * 0.016 * (0.5 + 3.5 * uStreak) * toLock;

  highp float cover = 0.0;
  for (int i = 0; i < 5; i++) {
    cover += sampleSwirl(r, ang, theta + arc * ((float(i) - 2.0) / 2.0), asp) * 0.2;
  }
  cover *= smoothstep(0.0, 0.06, p);

  highp float v = mix(cover, sharp, locked);
  highp float rim = locked * (1.0 - locked) * 4.0;
  v *= 1.0 + uGlow * 0.25 * rim * rim;
  finalColor = vec4(vec3(v), 1.0);
}
`;
