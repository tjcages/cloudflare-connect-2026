/** Flowing Lines — the reference's orange hairline ribbon as a fragment shader. */
export const FLOWING_LINES_SHADER_SOURCE = `// Flowing Lines
// A single variable-width ribbon of phase-shifted hairlines on white.

float bell(float x, float center, float width) {
  float d = (x - center) / width;
  return exp(-d * d);
}

float ribbonCenter(float x) {
  float center = 0.40 + 0.25 * sin(2.5 * pi * (x - 0.20));
  center += 0.035 * sin(5.0 * pi * x + 0.35);
  center -= 0.09 * smoothstep(0.84, 1.0, x);
  return center;
}

float ribbonWidth(float x) {
  float width = 0.155;
  width += 0.10 * bell(x, 0.25, 0.13);
  width += 0.12 * bell(x, 0.42, 0.11);
  width += 0.235 * bell(x, 0.80, 0.095);
  width += 0.055 * bell(x, 0.98, 0.12);
  width -= 0.105 * bell(x, 0.10, 0.075);
  width -= 0.095 * bell(x, 0.66, 0.075);
  return clamp(width, 0.045, 0.39);
}

float fiberY(float x, float across, float time) {
  float phase = across * 2.15;
  float finePhase = across * 1.35;
  float pinchWave = 0.050 * sin(tau * (2.15 * x + 0.04 * time) + phase);
  pinchWave += 0.024 * sin(tau * (4.05 * x - 0.025 * time) + finePhase + 0.8);
  float edgeLife = 0.45 + 0.55 * abs(across);
  float shear = across * 0.025 * sin(tau * (1.05 * x) + across * 2.8);
  return ribbonCenter(x) + across * ribbonWidth(x) + edgeLife * pinchWave + shear;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float ink = 0.0;
  vec3 weightedColor = vec3(0.0);

  const int LINE_COUNT = 64;
  const float HALF_WIDTH_PX = 0.42;
  const float LINE_OPACITY = 0.68;

  for (int line = 0; line < LINE_COUNT; line++) {
    float across = (float(line) + 0.5) / float(LINE_COUNT) * 2.0 - 1.0;
    float screenY = fiberY(uv.x, across, iTime);
    float lineY = (1.0 - screenY) * iResolution.y;

    float dx = 1.0 / iResolution.x;
    float leftY = (1.0 - fiberY(uv.x - dx, across, iTime)) * iResolution.y;
    float rightY = (1.0 - fiberY(uv.x + dx, across, iTime)) * iResolution.y;
    float slope = 0.5 * (rightY - leftY);
    float distancePx = abs(fragCoord.y - lineY) / sqrt(1.0 + slope * slope);
    float coverage = 1.0 - smoothstep(HALF_WIDTH_PX, HALF_WIDTH_PX + 0.85, distancePx);
    float contribution = coverage * LINE_OPACITY;

    float coralMix = smoothstep(0.04, 0.78, uv.x);
    vec3 apricot = vec3(1.0, 0.61, 0.30);
    vec3 coral = vec3(1.0, 0.36, 0.075);
    weightedColor += mix(apricot, coral, coralMix) * contribution;
    ink += contribution;
  }

  float alpha = 1.0 - exp(-ink);
  vec3 lineColor = ink > 0.0 ? weightedColor / ink : vec3(1.0);
  fragColor = vec4(mix(vec3(1.0), lineColor, alpha), 1.0);
}
`;
