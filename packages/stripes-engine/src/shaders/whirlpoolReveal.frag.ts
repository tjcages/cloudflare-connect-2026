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
  return uTurns * 6.2831853 * falloff * (1.0 + 0.6 * pp);
}

/* Organic, non-circular drain edge so it never reads as a hard ring. */
highp float drainWobble(highp float r, highp float ang) {
  return 0.5 * sin(ang * 3.0 + r * 9.0) + 0.32 * sin(ang * 7.0 - r * 15.0 + 1.3)
    + 0.18 * sin(ang * 13.0 + r * 24.0 + 2.7);
}

highp float cellHash(vec2 c) {
  vec3 p3 = fract(vec3(c.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

/* Per-cell drain timing driven by the whirlpool's own spiral coordinate, so the hole eats
   outward along the arms. Grain only textures the edge. */
highp float cellOffset(vec2 uv, vec2 asp) {
  vec2 c = floor(uv * vec2(150.0, 78.0));
  vec2 cellUv = (c + 0.5) / vec2(150.0, 78.0);
  vec2 cq = (cellUv - 0.5) * asp;
  highp float cr = length(cq);
  highp float cfall = uTightness / (cr + uTightness);
  highp float spiral = atan(cq.y, cq.x) + uTurns * 6.2831853 * cfall + cr * 5.0;
  highp float wave = 0.5 - 0.5 * cos(spiral);
  return (wave - 0.5) * 0.3 + (cellHash(c) - 0.5) * 0.05;
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

  highp float span = 0.13;
  highp float pDrain = clamp(
    mix(0.3, 0.7, rn) + cellOffset(vUv, asp) + drainWobble(r, ang) * 0.02,
    0.0,
    1.0 - span * 0.9
  );
  highp float drained = smoothstep(pDrain, pDrain + span, p);

  /* Cover keeps spinning the entire time — it is never asked to land on the image. */
  highp float rim = drained * (1.0 - drained) * 4.0;
  highp float spinNow = spinAngle(falloff, p);
  /* Right at the drain edge the cover accelerates and is sucked inward. */
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
