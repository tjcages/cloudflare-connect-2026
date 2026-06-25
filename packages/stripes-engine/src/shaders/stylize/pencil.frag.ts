import { STYLIZE_COMMON } from "./common";

export const PENCIL_FRAG =
  STYLIZE_COMMON +
  `
void main(){
  float t = uTime * 0.15;
  vec2 uv = warp(vUv, vec2(60.0, 100.0), 0.012 * uIntensity, t);
  vec3 c = texture(uTex, uv).rgb;
  vec2 pp = vUv * uResolution;
  float h1 = 0.5 + 0.5 * sin((pp.x + pp.y) * 0.7 + fbm(vUv * 60.0 + t) * 4.0);
  float h2 = 0.5 + 0.5 * sin((pp.x - pp.y) * 0.7 + fbm(vUv * 60.0 - t) * 4.0);
  float hatch = min(smoothstep(0.4, 0.9, h1), smoothstep(0.4, 0.9, h2));
  c *= mix(1.0, 0.35 + 0.65 * hatch, 0.8 * uIntensity);
  c *= mix(1.0, 0.9 + 0.2 * hash21(floor(pp / 1.5)), 0.3 * uIntensity);
  fragColor = vec4(c, 1.0);
}
`;
