import { STYLIZE_COMMON } from "./common";

export const WATERCOLOR_FRAG =
  STYLIZE_COMMON +
  `
void main(){
  float t = uTime * 0.2;
  vec2 uv = warp(vUv, vec2(18.0, 24.0), 0.045 * uIntensity, t);
  vec3 c = blurTex(uv, 4.0 * uIntensity * uDpr);
  c = mix(c, blurTex(uv, 9.0 * uIntensity * uDpr), 0.4);
  float edge = clamp(length(blurTex(uv, 1.0 * uDpr) - c) * 4.0, 0.0, 1.0);
  c *= 1.0 - edge * 0.5 * uIntensity;
  float paper = fbm(vUv * uResolution / 4.0);
  c *= mix(1.0, 0.85 + 0.3 * paper, 0.4 * uIntensity);
  fragColor = vec4(c, 1.0);
}
`;
