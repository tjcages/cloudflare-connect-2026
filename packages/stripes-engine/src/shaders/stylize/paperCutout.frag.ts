import { STYLIZE_COMMON } from "./common";

export const PAPER_CUTOUT_FRAG =
  STYLIZE_COMMON +
  `
void main(){
  float t = uTime * 0.2;
  vec2 uv = warp(vUv, vec2(50.0, 80.0), 0.006 * uIntensity, t);
  vec3 c = texture(uTex, uv).rgb;
  vec2 so = vec2(-4.0, -4.0) / uResolution;
  vec3 over = texture(uTex, uv - so).rgb;
  float here = luma(c), there = luma(over);
  float shadow = smoothstep(0.15, 0.0, here) * smoothstep(0.2, 0.5, there);
  c = mix(c, c * 0.45, shadow * uIntensity);
  fragColor = vec4(c, 1.0);
}
`;
