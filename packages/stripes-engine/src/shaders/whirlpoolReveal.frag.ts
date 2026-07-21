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

const highp float ARMS = 4.0;
const highp float WAVE_RATE = 34.0;
const highp float TAU = 6.2831853;

/* The swirl is a COVER, not the image: it spins forever and gets drained away, and the
   sharp field is simply underneath it. */
highp float sampleSwirl(highp float r, highp float ang, highp float theta, highp float pull, vec2 asp) {
  highp float A = ang + theta;
  highp float rr = r * (1.0 - pull);
  vec2 uv = 0.5 + (vec2(cos(A), sin(A)) * rr) / asp;
  vec2 inb = step(vec2(0.0), uv) * step(uv, vec2(1.0));
  return texture(uField, uv).r * inb.x * inb.y;
}

highp float spinAngle(highp float falloff, highp float pp) {
  return uTurns * TAU * falloff * (1.0 + 0.6 * pp);
}

/* Organic, non-circular envelope so the opening never reads as a hard ring. */
highp float envelopeWobble(highp float r, highp float ang) {
  return 0.5 * sin(ang * 4.0 + r * 9.0) + 0.32 * sin(ang * 8.0 - r * 15.0 + 1.3)
    + 0.18 * sin(ang * 12.0 + r * 24.0 + 2.7);
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

  /* Radial envelope = when this radius becomes eligible; the wave decides the exact moment. */
  highp float eligible = mix(0.28, 0.68, rn) + envelopeWobble(r, ang) * 0.015;

  /* Spiral wave fronts, riding the same winding as the cover and sweeping with its rotation.
     A point switches on when the next crest sweeps over it, so the waves carry the reveal. */
  highp float wound = uTurns * TAU * falloff;
  highp float phase = ang * ARMS + wound + WAVE_RATE * eligible;
  highp float wait = mod(-phase, TAU) / WAVE_RATE;
  highp float arrival = eligible + wait;
  highp float drained = smoothstep(arrival, arrival + 0.05, p);

  highp float rim = drained * (1.0 - drained) * 4.0;
  highp float spinNow = spinAngle(falloff, p);
  /* Right at the wave front the cover accelerates and is sucked inward. */
  highp float theta = spinNow + rim * 0.7;
  highp float arc = (spinAngle(falloff, min(p + 0.016, 1.0)) - spinNow) * (0.5 + 3.5 * uStreak);
  highp float pull = falloff * (0.3 + 0.45 * rim);

  highp float cover = 0.0;
  for (int i = 0; i < 5; i++) {
    highp float t = (float(i) - 2.0) / 2.0;
    cover += sampleSwirl(r, ang, theta + arc * t, pull, asp) * 0.2;
  }
  cover *= smoothstep(0.0, 0.08, p);

  highp float v = mix(cover, sharp, drained);
  v *= 1.0 + uGlow * 0.3 * rim * rim;
  finalColor = vec4(vec3(v), 1.0);
}
`;
