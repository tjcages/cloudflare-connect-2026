import { STYLIZE_COMMON } from "./common";

export const RISOGRAPH_FRAG =
  STYLIZE_COMMON +
  `
void main(){
  float t = uTime * 0.2;
  vec2 o = (vec2(2.5, 2.0) / uResolution) * (1.0 + 0.4 * sin(t * 3.0));
  vec2 uv1 = warp(vUv - o, vec2(60.0, 120.0), 0.01 * uIntensity, t);
  vec2 uv2 = warp(vUv + o, vec2(60.0, 120.0), 0.01 * uIntensity, t + 3.0);
  vec3 a = texture(uTex, uv1).rgb;
  vec3 b = texture(uTex, uv2).rgb;
  vec3 c = mix(a, a * b, 0.85);
  float g = grain(vUv, floor(t * 8.0));
  c *= mix(1.0, 0.85 + 0.3 * g, 0.3 * uIntensity);
  fragColor = vec4(mix(texture(uTex, vUv).rgb, c, uIntensity), 1.0);
}
`;
