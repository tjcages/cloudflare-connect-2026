import { STYLIZE_COMMON } from "./common";

export const GLITCH_FRAG =
  STYLIZE_COMMON +
  `
void main(){
  float t = uTime;
  float band = floor(vUv.y * 18.0);
  float slip = (hash21(vec2(band, floor(t * 6.0))) - 0.5);
  slip *= step(0.7, hash21(vec2(band * 1.7, floor(t * 6.0) + 3.0)));
  vec2 uv = vUv + vec2(slip * 0.06 * uIntensity, 0.0);
  float sp = (3.5 / uResolution.x) * uIntensity;
  vec3 c;
  c.r = texture(uTex, uv + vec2(sp, 0.0)).r;
  c.g = texture(uTex, uv).g;
  c.b = texture(uTex, uv - vec2(sp, 0.0)).b;
  fragColor = vec4(c, 1.0);
}
`;
