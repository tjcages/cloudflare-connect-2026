import { STYLIZE_COMMON } from "./common";

export const STAINED_GLASS_FRAG =
  STYLIZE_COMMON +
  `
void main(){
  float t = uTime * 0.15;
  vec2 uv = warp(vUv, vec2(40.0, 40.0), 0.012 * uIntensity, t);
  vec3 c = texture(uTex, uv).rgb;
  vec2 gp = vUv * uResolution / (15.0 * uDpr);
  vec2 f = abs(fract(gp) - 0.5);
  float grout = smoothstep(0.5, 0.42, max(f.x, f.y));
  c *= mix(1.0, grout, 0.7 * uIntensity);
  fragColor = vec4(c, 1.0);
}
`;
