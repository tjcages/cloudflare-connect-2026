import { STYLIZE_COMMON } from "./common";

export const HALFTONE_FRAG =
  STYLIZE_COMMON +
  `
void main(){
  float t = uTime * 0.1;
  vec3 src = texture(uTex, vUv).rgb;
  float l = luma(src);
  float cell = 9.0 * uDpr;
  vec2 gp = vUv * uResolution / cell;
  vec2 f = fract(gp) - 0.5;
  float d = length(f);
  float r = mix(0.05, 0.72, l) * (0.92 + 0.08 * sin(t * 6.2));
  float dotm = smoothstep(r, r - 0.12, d);
  vec3 outc = mix(vec3(0.04), src, dotm);
  fragColor = vec4(mix(src, outc, uIntensity), 1.0);
}
`;
