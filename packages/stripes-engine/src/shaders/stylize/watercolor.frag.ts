import { STYLIZE_COMMON } from "./common";

export const WATERCOLOR_FRAG =
  STYLIZE_COMMON +
  `
void main(){
  float t = uTime * 0.18;
  vec2 uv = warp(vUv, vec2(30.0, 40.0), 0.03 * uIntensity, t);
  vec3 c = blurTex(uv, 2.2 * uIntensity * uDpr);
  float g = grain(vUv, floor(t * 6.0));
  c *= mix(1.0, 0.9 + 0.2 * g, 0.35 * uIntensity);
  fragColor = vec4(c, 1.0);
}
`;
