import { STYLIZE_COMMON } from "./common";

export const GUMMY_FRAG =
  STYLIZE_COMMON +
  `
void main(){
  float t = uTime * 0.2;
  vec2 uv = warp(vUv, vec2(60.0, 60.0), 0.008 * uIntensity, t);
  vec3 c = texture(uTex, uv).rgb;
  float l = luma(c);
  c = mix(vec3(l), c, 1.4);
  vec2 gp = vUv * uResolution / (26.0 * uDpr);
  vec2 f = fract(gp) - 0.5;
  float cell = smoothstep(0.5, 0.46, max(abs(f.x), abs(f.y)));
  float gloss = smoothstep(0.4, 0.0, length(f - vec2(-0.18, -0.18)));
  c = c * mix(1.0, cell, 0.5 * uIntensity) + gloss * 0.5 * uIntensity * cell;
  fragColor = vec4(c, 1.0);
}
`;
