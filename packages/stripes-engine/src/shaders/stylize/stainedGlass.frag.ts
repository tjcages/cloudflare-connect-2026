import { STYLIZE_COMMON } from "./common";

export const STAINED_GLASS_FRAG =
  STYLIZE_COMMON +
  `
void main(){
  float t = uTime * 0.12;
  vec2 uv = warp(vUv, vec2(22.0, 22.0), 0.02 * uIntensity, t);
  vec3 c = texture(uTex, uv).rgb;
  float l = luma(c);
  c = mix(vec3(l), c, 1.5);
  vec2 cells = uResolution / (28.0 * uDpr);
  vec2 gp = vUv * cells;
  vec2 jit = vec2(fbm(floor(gp) * 1.3), fbm(floor(gp) * 2.1)) * 0.3;
  vec2 f = abs(fract(gp + jit) - 0.5);
  float lead = smoothstep(0.5, 0.36, max(f.x, f.y));
  c = mix(vec3(0.02), c, lead);
  fragColor = vec4(mix(texture(uTex, vUv).rgb, c, uIntensity), 1.0);
}
`;
