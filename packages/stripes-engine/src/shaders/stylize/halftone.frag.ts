import { STYLIZE_COMMON } from "./common";

export const HALFTONE_FRAG =
  STYLIZE_COMMON +
  `
void main(){
  vec3 here = texture(uTex, vUv).rgb;
  float cell = mix(5.0, 20.0, uParams.x) * uDpr;
  float contrast = mix(0.5, 1.1, uParams.y);
  float paperTone = mix(1.0, 0.9, uParams.z);
  vec2 cells = uResolution / cell;
  vec2 gp = vUv * cells;
  vec2 center = (floor(gp) + 0.5) / cells;
  vec3 src = texture(uTex, center).rgb;
  float ink = clamp((1.0 - luma(src)) * contrast * 1.3, 0.0, 1.0);
  float r = sqrt(ink) * 0.8;
  vec2 f = fract(gp) - 0.5;
  float d = length(f);
  float dotm = smoothstep(r + 0.06, r - 0.06, d);
  vec3 outc = mix(vec3(paperTone), src, dotm);
  fragColor = vec4(mix(here, outc, uIntensity), 1.0);
}
`;
