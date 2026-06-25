import { STYLIZE_COMMON } from "./common";

export const PAPER_CUTOUT_FRAG =
  STYLIZE_COMMON +
  `
void main(){
  float t = uTime * 0.2;
  vec2 uv = warp(vUv, vec2(40.0, 60.0), 0.01 * uIntensity, t);
  vec3 c = texture(uTex, uv).rgb;
  vec2 sh = vec2(7.0, 7.0) / uResolution;
  float hereInk = 1.0 - luma(c);
  float overInk = 1.0 - luma(texture(uTex, uv - sh).rgb);
  float shadow = clamp(overInk - hereInk, 0.0, 1.0);
  c = mix(c, c * 0.4, shadow * uIntensity);
  vec3 post = floor(c * 5.0 + 0.5) / 5.0;
  c = mix(c, post, uIntensity);
  fragColor = vec4(c, 1.0);
}
`;
