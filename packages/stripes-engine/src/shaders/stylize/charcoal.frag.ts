import { STYLIZE_COMMON } from "./common";

export const CHARCOAL_FRAG =
  STYLIZE_COMMON +
  `
void main(){
  float t = uTime * 0.25;
  vec2 uv = warp(vUv, vec2(50.0, 70.0), 0.025 * uIntensity, t);
  vec3 c = texture(uTex, uv).rgb;
  float g1 = fbm(vUv * uResolution / 2.5);
  float g2 = hash21(floor(vUv * uResolution / 1.2));
  float grit = mix(g1, g2, 0.6);
  c *= mix(1.0, 0.45 + 0.7 * grit, 0.85 * uIntensity);
  float smear = fbm(vec2(vUv.x * 40.0, vUv.y * 8.0) + t);
  c *= mix(1.0, 0.7 + 0.4 * smear, 0.3 * uIntensity);
  fragColor = vec4(c, 1.0);
}
`;
