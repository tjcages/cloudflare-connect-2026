/**
 * Plane terrain lines — a single full-bleed sheet of evenly spaced L→R fibers
 * that follow scattered hills and valleys across the plane.
 *
 * Left edge of the plane = left edge of the view; right edge = right edge.
 * Authored for the lab ShaderToy-style `mainImage` interface.
 */
export const PLANE_TERRAIN_SHADER_SOURCE = `// Plane terrain lines
// Evenly gapped left→right fibers over a heightfield of hills + valleys.

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise21(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 m = mat2(0.80, -0.60, 0.60, 0.80);
  for (int i = 0; i < 5; i++) {
    v += a * noise21(p);
    p = m * p * 2.02;
    a *= 0.5;
  }
  return v;
}

// Soft radial pocket — positive = hill, negative = valley.
float pocket(vec2 p, vec2 c, float r, float amp) {
  float d = length((p - c) / max(r, 1e-4));
  float w = exp(-d * d * 2.4);
  return amp * w;
}

// Heightfield in plane UV [0,1]². Pockets scatter hills/valleys; fbm adds grain.
float terrainHeight(vec2 p, float t) {
  vec2 q = p + 0.035 * vec2(
    fbm(p * 2.5 + vec2(t * 0.03, 0.0)),
    fbm(p * 2.5 + vec2(4.1, t * 0.03))
  );

  float h = 0.0;
  h += pocket(q, vec2(0.18, 0.32), 0.20, 1.00);
  h += pocket(q, vec2(0.42, 0.58), 0.16, 0.72);
  h += pocket(q, vec2(0.72, 0.28), 0.18, 0.90);
  h += pocket(q, vec2(0.84, 0.68), 0.15, 0.65);
  h += pocket(q, vec2(0.55, 0.82), 0.14, 0.55);
  h -= pocket(q, vec2(0.32, 0.22), 0.14, 0.70);
  h -= pocket(q, vec2(0.58, 0.45), 0.17, 0.85);
  h -= pocket(q, vec2(0.78, 0.55), 0.13, 0.60);
  h -= pocket(q, vec2(0.22, 0.72), 0.15, 0.75);
  h -= pocket(q, vec2(0.48, 0.12), 0.12, 0.50);

  h += 0.28 * (fbm(q * vec2(3.2, 2.6) + t * 0.05) * 2.0 - 1.0);
  h += 0.12 * (fbm(q * vec2(7.5, 6.0) - t * 0.04) * 2.0 - 1.0);
  return h;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  // Plane UV: x spans the full view left→right; y fills the view top→bottom.
  vec2 uv = fragCoord / iResolution.xy;
  float t = iTime;

  // Dense sheet; amplitude kept modest so gaps stay visually even while fibers
  // still ride the hills and valleys.
  const float LINE_COUNT = 128.0;
  const float AMP = 0.028;
  const float LINE_PX = 1.35;

  float px = 1.0 / max(iResolution.y, 1.0);
  float row = floor(uv.y * LINE_COUNT);
  float lineMask = 0.0;
  float nearestH = 0.0;
  float nearestD = 1e5;

  for (int k = -2; k <= 2; k++) {
    float i = row + float(k);
    if (i < 0.0 || i >= LINE_COUNT) continue;
    float baseY = (i + 0.5) / LINE_COUNT;
    float h = terrainHeight(vec2(uv.x, baseY), t);
    float y = baseY - h * AMP;
    float d = abs(uv.y - y);
    float aa = fwidth(y) + px;
    float m = 1.0 - smoothstep(LINE_PX * aa, LINE_PX * aa + aa, d);
    lineMask = max(lineMask, m);
    if (d < nearestD) {
      nearestD = d;
      nearestH = h;
    }
  }

  // Cool light ground + Connect coral fibers.
  vec3 bg = vec3(0.940, 0.945, 0.952);
  vec3 valley = vec3(0.86, 0.88, 0.92);
  vec3 hill = vec3(0.97, 0.94, 0.90);
  float h01 = clamp(nearestH * 0.5 + 0.5, 0.0, 1.0);
  vec3 wash = mix(valley, hill, smoothstep(0.25, 0.75, h01));
  vec3 base = mix(bg, wash, 0.22);

  vec3 lineA = vec3(0.91, 0.29, 0.11); // #e8481c
  vec3 lineB = vec3(1.00, 0.48, 0.12); // #ff7a1f
  vec3 lineCol = mix(lineA, lineB, clamp(nearestH * 0.35 + 0.5, 0.0, 1.0));

  float vig = smoothstep(1.2, 0.4, length((uv - 0.5) * vec2(1.05, 1.15)));
  base *= mix(0.96, 1.0, vig);

  vec3 col = mix(base, lineCol, lineMask);

  float grain = (hash21(fragCoord.xy + t * 60.0) - 0.5) * 0.015;
  col += grain;

  fragColor = vec4(col, 1.0);
}
`;
