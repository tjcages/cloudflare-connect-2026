import { STYLIZE_COMMON } from "./common";

export const PENCIL_FRAG =
  STYLIZE_COMMON +
  `
void main(){
  float t = uTime * 0.15;
  vec2 uv = warp(vUv, vec2(80.0, 120.0), 0.01 * uIntensity, t);
  vec3 c = texture(uTex, uv).rgb;
  vec2 pp = vUv * uResolution;
  float hatch = 0.5 + 0.5 * sin((pp.x + pp.y) * 0.5 + fbm(vUv * 40.0 + t) * 3.0);
  hatch = smoothstep(0.3, 0.9, hatch);
  c *= mix(1.0, 0.55 + 0.5 * hatch, 0.6 * uIntensity);
  fragColor = vec4(c, 1.0);
}
`;
