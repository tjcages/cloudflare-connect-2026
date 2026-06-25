import { STYLIZE_COMMON } from "./common";

export const CARAMEL_FRAG =
  STYLIZE_COMMON +
  `
void main(){
  float t = uTime * 0.3;
  vec2 uv = vUv;
  uv.y += fbm(vec2(vUv.x * 30.0, vUv.y * 4.0) + t) * 0.03 * uIntensity;
  uv = warp(uv, vec2(40.0, 12.0), 0.012 * uIntensity, t);
  vec3 c = texture(uTex, uv).rgb;
  float l = luma(c);
  c = mix(c, vec3(0.8, 0.4, 0.08) * (0.4 + l), 0.7 * uIntensity);
  vec3 hi = blurTex(uv - vec2(2.0, 3.0) / uResolution, 3.0 * uDpr);
  float sheen = smoothstep(0.45, 0.95, luma(hi));
  c += sheen * 0.6 * uIntensity;
  c *= mix(1.0, 0.7 + 0.3 * l, 0.3 * uIntensity);
  fragColor = vec4(c, 1.0);
}
`;
