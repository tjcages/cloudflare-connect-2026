import { STYLIZE_COMMON } from "./common";

export const ABSTRACT_FRAG =
  STYLIZE_COMMON +
  `
void main(){
  float t = uTime * 0.3;
  vec2 uv = warp(vUv, vec2(40.0, 90.0), 0.02 * uIntensity, t);
  uv += (vec2(fbm(vUv * vec2(180.0, 400.0) + t), fbm(vUv * vec2(400.0, 180.0) - t)) - 0.5) * 0.006 * uIntensity;
  vec3 c = texture(uTex, uv).rgb;
  float coarse = fbm(vUv * uResolution / 3.0);
  float fine = hash21(floor(vUv * uResolution / 1.5));
  float paper = mix(coarse, fine, 0.5);
  c *= mix(1.0, 0.7 + 0.6 * paper, 0.7 * uIntensity);
  fragColor = vec4(c, 1.0);
}
`;
