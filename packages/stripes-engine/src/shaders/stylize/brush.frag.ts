import { STYLIZE_COMMON } from "./common";

export const BRUSH_FRAG =
  STYLIZE_COMMON +
  `
void main(){
  float t = uTime * 0.2;
  vec2 uv = warp(vUv, vec2(25.0, 200.0), 0.012 * uIntensity, t);
  vec3 c = texture(uTex, uv).rgb;
  float streak = fbm(vec2(vUv.x * 30.0, vUv.y * 180.0) + t);
  c *= mix(1.0, 0.78 + 0.34 * streak, 0.45 * uIntensity);
  fragColor = vec4(c, 1.0);
}
`;
