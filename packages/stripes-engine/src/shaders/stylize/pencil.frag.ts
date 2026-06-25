import { STYLIZE_COMMON } from "./common";

export const PENCIL_FRAG =
  STYLIZE_COMMON +
  `
void main(){
  vec2 pp = vUv * uResolution;
  float density = mix(0.4, 1.0, uParams.x);
  float pressure = uParams.y;
  float paperAmt = uParams.z;
  vec3 tone = vec3(0.0);
  for (int i = -2; i <= 2; i++) {
    for (int j = -2; j <= 2; j++) {
      tone += texture(uTex, vUv + vec2(float(i), float(j)) * 3.0 / uResolution).rgb;
    }
  }
  tone /= 25.0;
  float ink = clamp((1.0 - luma(tone)) * (0.8 + 0.9 * pressure), 0.0, 1.0);
  float wob = (fbm(vUv * 26.0) - 0.5) * 1.6;
  float freq = mix(0.16, 0.36, density);
  float l1 = smoothstep(0.5, 0.36, abs(sin((pp.x * 0.7 + pp.y * 0.7) * freq + wob)));
  float l2 = smoothstep(0.5, 0.36, abs(sin((pp.x * 0.7 - pp.y * 0.7) * freq + wob)));
  float l3 = smoothstep(0.5, 0.36, abs(sin(pp.y * freq * 1.15 + wob)));
  float hatch = l1 * step(0.12, ink);
  hatch = max(hatch, l2 * step(0.42, ink));
  hatch = max(hatch, l3 * step(0.68, ink));
  float cover = hatch * smoothstep(0.05, 0.22, ink);
  float grain = hash21(floor(pp / 1.5));
  cover *= mix(1.0, 0.55 + 0.45 * grain, paperAmt);
  vec3 outc = mix(vec3(0.96), vec3(0.16), cover);
  fragColor = vec4(mix(texture(uTex, vUv).rgb, outc, uIntensity), 1.0);
}
`;
