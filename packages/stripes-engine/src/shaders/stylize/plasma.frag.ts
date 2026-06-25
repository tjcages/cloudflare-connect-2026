import { STYLIZE_COMMON } from "./common";

export const PLASMA_FRAG =
  STYLIZE_COMMON +
  `
vec3 plasmaPal(float x){ return 0.5 + 0.5 * cos(6.2831 * (vec3(0.0, 0.33, 0.67) + x)); }
void main(){
  float t = uTime * 0.5;
  vec3 src = texture(uTex, vUv).rgb;
  float p = fbm(vUv * vec2(60.0, 60.0) + vec2(t, t * 0.7));
  vec3 pl = plasmaPal(p + t * 0.1);
  vec3 c = src * pl * 1.4;
  fragColor = vec4(mix(src, c, uIntensity), 1.0);
}
`;
