import { STYLIZE_COMMON } from "./common";

export const GUMMY_FRAG =
  STYLIZE_COMMON +
  `
void main(){
  float t = uTime * 0.3;
  vec2 uv = warp(vUv, vec2(40.0, 40.0), 0.012 * uIntensity, t);
  vec3 c = texture(uTex, uv).rgb;
  float l = luma(c);
  c = mix(vec3(l), c, 1.6);
  float cell = 22.0 * uDpr;
  vec2 gp = vUv * uResolution / cell;
  vec2 f = fract(gp) - 0.5;
  float dist = length(f);
  float rc = smoothstep(0.5, 0.4, dist);
  float gloss = smoothstep(0.32, 0.0, length(f - vec2(-0.15, -0.18)));
  float rim = smoothstep(0.5, 0.46, dist) - smoothstep(0.46, 0.4, dist);
  c = c * mix(1.0, 0.6 + 0.5 * rc, 0.6 * uIntensity);
  c += gloss * 0.7 * uIntensity;
  c += rim * 0.2 * uIntensity;
  fragColor = vec4(c, 1.0);
}
`;
