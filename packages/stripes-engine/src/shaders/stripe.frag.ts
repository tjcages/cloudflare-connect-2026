export const STRIPE_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uCell;     // cols×rows grayscale cell value
uniform sampler2D uLut;      // 256×1 RGBA: value → (color.rgb, width byte)
uniform vec2 uGridCount;     // cols, rows
uniform vec2 uCellPx;        // cellW, cellH (logical px)
uniform vec2 uGapPx;         // gapX, gapY
uniform float uCorner;       // corner radius (logical px)
uniform float uOrient;       // 0 vertical, 1 horizontal
uniform float uDpr;
uniform vec3 uBg;
out vec4 finalColor;

float sdRoundBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
}

void main() {
  vec2 cellF = vUv * uGridCount;
  vec2 cell = floor(cellF);
  vec2 local = fract(cellF);
  float v = texture(uCell, (cell + 0.5) / uGridCount).r;
  vec4 lut = texture(uLut, vec2((v * 255.0 + 0.5) / 256.0, 0.5));
  vec3 barColor = lut.rgb;
  float barWidthPx = lut.a * 255.0;

  vec2 p = (local - 0.5) * uCellPx;
  vec2 halfExt;
  if (uOrient < 0.5) {
    halfExt = vec2(min(barWidthPx, uCellPx.x - uGapPx.x) * 0.5, (uCellPx.y - uGapPx.y) * 0.5);
  } else {
    halfExt = vec2((uCellPx.x - uGapPx.x) * 0.5, min(barWidthPx, uCellPx.y - uGapPx.y) * 0.5);
  }
  halfExt = max(halfExt, vec2(0.0));
  float r = min(uCorner, min(halfExt.x, halfExt.y));
  float d = sdRoundBox(p, halfExt, r);
  float w = max(fwidth(d), 1e-4);
  float alpha = clamp(0.5 - d / w, 0.0, 1.0);
  finalColor = vec4(mix(uBg, barColor, alpha), 1.0);
}
`;
