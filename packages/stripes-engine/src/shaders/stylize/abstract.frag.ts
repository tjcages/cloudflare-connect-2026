import { STYLIZE_COMMON } from "./common";

export const ABSTRACT_FRAG =
  STYLIZE_COMMON +
  `
void main(){
  float t = uTime * 0.3;
  float wob = mix(0.004, 0.03, uParams.x);
  float grainAmt = uParams.y;
  float soft = mix(0.0, 2.0, uParams.z);
  vec2 uv = warp(vUv, vec2(40.0, 90.0), wob * uIntensity, t);
  uv += (vec2(fbm(vUv * vec2(180.0, 400.0) + t), fbm(vUv * vec2(400.0, 180.0) - t)) - 0.5) * wob * 0.4 * uIntensity;
  vec3 c = soft > 0.01 ? blurTex(uv, soft * uDpr) : texture(uTex, uv).rgb;
  float paper = mix(fbm(vUv * uResolution / 3.0), hash21(floor(vUv * uResolution / 1.5)), 0.5);
  c *= mix(1.0, 0.7 + 0.6 * paper, grainAmt * 0.7 * uIntensity);
  fragColor = vec4(c, 1.0);
}
`;
