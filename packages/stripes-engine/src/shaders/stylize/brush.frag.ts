import { STYLIZE_COMMON } from "./common";

export const BRUSH_FRAG =
  STYLIZE_COMMON +
  `
void main(){
  float t = uTime * 0.25;
  vec2 uv = warp(vUv, vec2(18.0, 260.0), 0.02 * uIntensity, t);
  vec3 c = texture(uTex, uv).rgb;
  float streak = fbm(vec2(vUv.x * 120.0, vUv.y * 30.0) + t * 0.5);
  float bristle = fbm(vec2(vUv.x * 400.0, vUv.y * 60.0));
  c *= mix(1.0, 0.65 + 0.5 * streak, 0.5 * uIntensity);
  c *= mix(1.0, 0.8 + 0.35 * bristle, 0.4 * uIntensity);
  c += smoothstep(0.7, 1.0, bristle) * 0.15 * uIntensity;
  fragColor = vec4(c, 1.0);
}
`;
