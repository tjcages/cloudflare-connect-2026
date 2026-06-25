import { STYLIZE_COMMON } from "./common";

export const AMBER_FRAG =
  STYLIZE_COMMON +
  `
void main(){
  float t = uTime;
  vec3 src = texture(uTex, vUv).rgb;
  float l = luma(src);
  float lit = 1.0 - l;
  vec3 amber = vec3(1.3, 0.6, 0.05) * lit;
  float bl = 0.0;
  vec2 o = 3.0 / uResolution;
  for (int i = -3; i <= 3; i++){ bl += (1.0 - luma(texture(uTex, vUv + vec2(float(i) * o.x, 0.0)).rgb)); }
  amber += vec3(1.2, 0.55, 0.05) * (bl / 7.0) * 0.6;
  float scan = 0.5 + 0.5 * sin(vUv.y * uResolution.y / 1.8 * 6.28318 - t * 4.0);
  vec3 screen = vec3(0.03, 0.015, 0.0) + amber * mix(0.5, 1.0, scan);
  fragColor = vec4(mix(src, screen, uIntensity), 1.0);
}
`;
