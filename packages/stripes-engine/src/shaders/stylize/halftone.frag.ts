import { STYLIZE_COMMON } from "./common";

export const HALFTONE_FRAG =
  STYLIZE_COMMON +
  `
void main(){
  vec3 here = texture(uTex, vUv).rgb;
  float cell = 10.0 * uDpr;
  vec2 cells = uResolution / cell;
  vec2 gp = vUv * cells;
  vec2 center = (floor(gp) + 0.5) / cells;
  vec3 src = texture(uTex, center).rgb;
  float ink = 1.0 - luma(src);
  float r = sqrt(ink) * 0.8;
  vec2 f = fract(gp) - 0.5;
  float d = length(f);
  float dotm = smoothstep(r + 0.06, r - 0.06, d);
  vec3 paper = vec3(0.97);
  vec3 outc = mix(paper, src, dotm);
  fragColor = vec4(mix(here, outc, uIntensity), 1.0);
}
`;
