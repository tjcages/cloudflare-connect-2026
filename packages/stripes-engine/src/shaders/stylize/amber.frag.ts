import { STYLIZE_COMMON } from "./common";

export const AMBER_FRAG =
  STYLIZE_COMMON +
  `
void main(){
  float t = uTime;
  float glowAmt = uParams.x;
  float scanAmt = uParams.y;
  float bright = mix(0.7, 1.4, uParams.z);
  float cell = mix(2.0, 16.0, uParams.w) * uDpr;
  vec2 cells = uResolution / cell;
  vec3 src = texture(uTex, (floor(vUv * cells) + 0.5) / cells).rgb;
  float l = luma(src);
  float lit = 1.0 - l;
  vec3 amber = vec3(1.3, 0.6, 0.05) * lit;
  float bl = 0.0;
  vec2 o = 3.0 / uResolution;
  for (int i = -3; i <= 3; i++){ bl += (1.0 - luma(texture(uTex, vUv + vec2(float(i) * o.x, 0.0)).rgb)); }
  amber += vec3(1.2, 0.55, 0.05) * (bl / 7.0) * glowAmt;
  float scan = 0.5 + 0.5 * sin(vUv.y * uResolution.y / 1.8 * 6.28318 - t * 4.0);
  vec3 screen = vec3(0.03, 0.015, 0.0) + amber * bright * mix(1.0 - scanAmt * 0.5, 1.0, scan);
  fragColor = vec4(mix(src, screen, uIntensity), 1.0);
}
`;
