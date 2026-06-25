import { STYLIZE_COMMON } from "./common";

export const GUMMY_FRAG =
  STYLIZE_COMMON +
  `
void main(){
  float cell = mix(6.0, 48.0, uParams.x) * uDpr;
  float glossAmt = uParams.y;
  float sat = mix(1.0, 2.0, uParams.z);
  vec2 cells = uResolution / cell;
  vec2 gp = vUv * cells;
  vec2 center = (floor(gp) + 0.5) / cells;
  vec3 c = texture(uTex, center).rgb;
  float l = luma(c);
  c = mix(vec3(l), c, sat);
  vec2 f = fract(gp) - 0.5;
  float dist = length(f);
  float rc = smoothstep(0.5, 0.4, dist);
  float gloss = smoothstep(0.32, 0.0, length(f - vec2(-0.15, -0.18)));
  float rim = smoothstep(0.5, 0.46, dist) - smoothstep(0.46, 0.4, dist);
  float present = smoothstep(0.05, 0.3, 1.0 - l);
  vec3 outc = mix(vec3(0.97), c, rc * present);
  outc += gloss * glossAmt * 0.7 * present;
  outc += rim * 0.2 * present;
  fragColor = vec4(mix(texture(uTex, vUv).rgb, outc, uIntensity), 1.0);
}
`;
