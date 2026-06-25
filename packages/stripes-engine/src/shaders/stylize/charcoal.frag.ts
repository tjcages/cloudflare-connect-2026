import { STYLIZE_COMMON } from "./common";

export const CHARCOAL_FRAG =
  STYLIZE_COMMON +
  `
void main(){
  float t = uTime * 0.2;
  vec2 uv = warp(vUv, vec2(70.0, 90.0), 0.018 * uIntensity, t);
  vec3 c = texture(uTex, uv).rgb;
  float g = grain(vUv, floor(t * 10.0));
  c *= mix(1.0, 0.6 + 0.5 * g, 0.75 * uIntensity);
  fragColor = vec4(c, 1.0);
}
`;
