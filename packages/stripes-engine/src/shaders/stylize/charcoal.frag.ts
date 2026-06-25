import { STYLIZE_COMMON } from "./common";

export const CHARCOAL_FRAG =
  STYLIZE_COMMON +
  `
void main(){
  float t = uTime * 0.25;
  float grainAmt = uParams.x;
  float smudgeAmt = uParams.y;
  float dark = mix(0.3, 0.9, uParams.z);
  vec2 uv = warp(vUv, vec2(50.0, 70.0), 0.025 * uIntensity, t);
  vec3 c = texture(uTex, uv).rgb;
  float grit = mix(fbm(vUv * uResolution / 2.5), hash21(floor(vUv * uResolution / 1.2)), 0.6);
  c *= mix(1.0, (1.0 - dark) + (dark + 0.2) * grit, grainAmt * uIntensity);
  float smear = fbm(vec2(vUv.x * 40.0, vUv.y * 8.0) + t);
  c *= mix(1.0, 0.7 + 0.4 * smear, smudgeAmt * 0.4 * uIntensity);
  fragColor = vec4(c, 1.0);
}
`;
