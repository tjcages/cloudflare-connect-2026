import { STYLIZE_COMMON } from "./common";

export const HALFTONE_FRAG =
  STYLIZE_COMMON +
  `
void main(){
  vec3 src = texture(uTex, vUv).rgb;
  float l = luma(src);
  float cell = 7.0 * uDpr;
  vec2 gp = vUv * uResolution / cell;
  vec2 f = fract(gp) - 0.5;
  float d = length(f);
  float ink = 1.0 - l;
  float r = sqrt(ink) * 0.72;
  float dotm = smoothstep(r + 0.08, r - 0.08, d);
  vec3 paper = vec3(0.96);
  vec3 outc = mix(paper, src, dotm);
  fragColor = vec4(mix(src, outc, uIntensity), 1.0);
}
`;
