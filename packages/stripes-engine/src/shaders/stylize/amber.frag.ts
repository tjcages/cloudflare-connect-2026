import { STYLIZE_COMMON } from "./common";

export const AMBER_FRAG =
  STYLIZE_COMMON +
  `
void main(){
  float t = uTime;
  vec3 src = texture(uTex, vUv).rgb;
  float l = luma(src);
  vec3 amber = vec3(1.25, 0.72, 0.08) * l;
  float bl = 0.0;
  vec2 o = 2.5 / uResolution;
  for (int i = -2; i <= 2; i++){ bl += luma(texture(uTex, vUv + vec2(float(i) * o.x, 0.0)).rgb); }
  amber += vec3(1.2, 0.7, 0.1) * (bl / 5.0) * 0.5;
  float scan = 0.5 + 0.5 * sin((vUv.y * uResolution.y + t * 20.0) * 3.14159);
  amber *= mix(1.0, 0.65 + 0.35 * scan, 0.5 * uIntensity);
  fragColor = vec4(mix(src, amber, uIntensity), 1.0);
}
`;
