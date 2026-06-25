import { STYLIZE_COMMON } from "./common";

export const ABSTRACT_FRAG =
  STYLIZE_COMMON +
  `
void main(){
  float t = uTime * 0.25;
  vec2 uv = warp(vUv, vec2(60.0, 140.0), 0.012 * uIntensity, t);
  vec3 c = blurTex(uv, 0.6 * uIntensity * uDpr);
  float g = grain(vUv, floor(t * 8.0));
  c *= mix(1.0, 0.82 + 0.36 * g, 0.5 * uIntensity);
  fragColor = vec4(c, 1.0);
}
`;
