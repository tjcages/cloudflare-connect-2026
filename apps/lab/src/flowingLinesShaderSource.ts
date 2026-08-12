/**
 * Flowing Lines — the reference's phase-shifted sine-wave pack rendered
 * directly as anti-aliased WebGL fragment-shader isolines.
 */
export const FLOWING_LINES_SHADER_SOURCE = `// Flowing Lines
// Phase-shifted sine isolines on a white 5:1 canvas.

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  float pixel = 1.0 / iResolution.y;
  float ink = 0.0;

  const int LINE_COUNT = 40;
  const float HALF_WIDTH_PX = 0.46;
  const float LINE_OPACITY = 0.72;

  for (int line = 0; line < LINE_COUNT; line++) {
    float phase = 0.2 * iTime + tau * float(line) / float(LINE_COUNT);
    float wave = sin(phase + 11.0 * uv.x) - 4.0 * uv.x * cos(0.5 * phase);
    float lineY = 0.25 * wave;

    // Convert vertical separation to the curve's perpendicular distance.
    // This keeps steep sections the same visual weight as flatter sections.
    float slope = 0.25 * (11.0 * cos(phase + 11.0 * uv.x) - 4.0 * cos(0.5 * phase));
    float distanceToLine = abs(uv.y - lineY) / sqrt(1.0 + slope * slope);
    float coverage = 1.0 - smoothstep(
      HALF_WIDTH_PX * pixel,
      (HALF_WIDTH_PX + 0.8) * pixel,
      distanceToLine
    );
    ink += coverage * LINE_OPACITY;
  }

  // Optical accumulation preserves pale individual hairlines while naturally
  // deepening the orange where the pack converges and crosses.
  float alpha = 1.0 - exp(-ink);
  vec3 orange = vec3(1.0, 0.42, 0.105);
  fragColor = vec4(mix(vec3(1.0), orange, alpha), 1.0);
}
`;
