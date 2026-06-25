import { STYLIZE_COMMON } from "./common";

export const CARAMEL_FRAG =
  STYLIZE_COMMON +
  `
void main(){
  float t = uTime * 0.25;
  vec2 uv = warp(vUv, vec2(50.0, 10.0), 0.012 * uIntensity, t);
  vec3 c = texture(uTex, uv).rgb;
  float l = luma(c);
  c = mix(c, vec3(1.0, 0.55, 0.12) * l * 1.4, 0.5 * uIntensity);
  vec3 hi = blurTex(uv - vec2(1.5, 2.5) / uResolution, 2.4 * uDpr);
  float sheen = smoothstep(0.4, 0.9, luma(hi));
  c += sheen * 0.4 * uIntensity;
  fragColor = vec4(c, 1.0);
}
`;
