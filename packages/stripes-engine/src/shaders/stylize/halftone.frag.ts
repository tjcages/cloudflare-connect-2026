import { STYLIZE_COMMON } from "./common";

export const HALFTONE_FRAG =
  STYLIZE_COMMON +
  `
void main(){
  vec3 here = texture(uTex, vUv).rgb;
  float cell = mix(2.0, 22.0, uParams.x) * uDpr;
  float square = uParams.y;
  vec2 cells = uResolution / cell;
  vec2 gp = vUv * cells;
  vec2 cellOrigin = floor(gp);
  vec3 src = vec3(0.0);
  for (int sx = 0; sx < 4; sx++) {
    for (int sy = 0; sy < 4; sy++) {
      vec2 s = (cellOrigin + (vec2(float(sx), float(sy)) + 0.5) / 4.0) / cells;
      src += texture(uTex, s).rgb;
    }
  }
  src /= 16.0;
  float ink = clamp((1.0 - luma(src)) * 1.3, 0.0, 1.0);
  float rad = sqrt(ink) * 0.85;
  vec2 f = abs(fract(gp) - 0.5);
  float d = mix(length(f), max(f.x, f.y), square);
  float dotm = smoothstep(rad + 0.06, rad - 0.06, d);
  vec3 outc = mix(vec3(0.97), src, dotm);
  fragColor = vec4(mix(here, outc, uIntensity), 1.0);
}
`;
