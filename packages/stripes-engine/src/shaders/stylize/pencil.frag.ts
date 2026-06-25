import { STYLIZE_COMMON } from "./common";

export const PENCIL_FRAG =
  STYLIZE_COMMON +
  `
void main(){
  vec2 pp = vUv * uResolution;
  float density = mix(0.25, 0.7, uParams.x);
  float pressure = uParams.y;
  float paperAmt = uParams.z;
  vec3 tone = vec3(0.0);
  for (int i = -2; i <= 2; i++) {
    for (int j = -2; j <= 2; j++) {
      tone += texture(uTex, vUv + vec2(float(i), float(j)) * 3.0 / uResolution).rgb;
    }
  }
  tone /= 25.0;
  float ink = clamp((1.0 - luma(tone)) * (0.7 + 0.8 * pressure), 0.0, 1.0);
  float l = luma(texture(uTex, vUv).rgb);
  float lx = luma(texture(uTex, vUv + vec2(2.5, 0.0) / uResolution).rgb);
  float ly = luma(texture(uTex, vUv + vec2(0.0, 2.5) / uResolution).rgb);
  float wob = fbm(vUv * 40.0) - 0.5;
  float edge = abs(l - lx) + abs(l - ly);
  float outline = smoothstep(0.12, 0.3, edge + wob * 0.05);
  float freq = mix(0.1, 0.26, density);
  float hw = fbm(vUv * 24.0) * 1.4;
  float h1 = smoothstep(0.42, 0.3, abs(sin((pp.x * 0.7 + pp.y * 0.7) * freq + hw)));
  float h2 = smoothstep(0.42, 0.3, abs(sin((pp.x * 0.7 - pp.y * 0.7) * freq + hw)));
  float hatch = h1 * step(0.32, ink);
  hatch = max(hatch, h2 * step(0.6, ink));
  hatch *= smoothstep(0.05, 0.25, ink);
  float cover = max(outline, hatch * 0.75);
  float grain = hash21(floor(pp / 1.5));
  cover *= mix(1.0, 0.55 + 0.45 * grain, paperAmt);
  vec3 outc = mix(uColorB, uColorA, clamp(cover, 0.0, 1.0));
  fragColor = vec4(mix(texture(uTex, vUv).rgb, outc, uIntensity), 1.0);
}
`;
