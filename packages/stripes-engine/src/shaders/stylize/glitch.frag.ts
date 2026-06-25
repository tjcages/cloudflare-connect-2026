import { STYLIZE_COMMON } from "./common";

export const GLITCH_FRAG =
  STYLIZE_COMMON +
  `
void main(){
  float t = uTime;
  float row = floor(vUv.y * 24.0);
  float seed = hash21(vec2(row, floor(t * 8.0)));
  float active = step(0.6, hash21(vec2(row * 2.3, floor(t * 8.0) + 7.0)));
  float slip = (seed - 0.5) * 0.15 * active * uIntensity;
  vec2 uv = vUv + vec2(slip, 0.0);
  float sp = (6.0 + 10.0 * active) / uResolution.x * uIntensity;
  vec3 c;
  c.r = texture(uTex, uv + vec2(sp, 0.0)).r;
  c.g = texture(uTex, uv + vec2(slip * 0.3, 0.0)).g;
  c.b = texture(uTex, uv - vec2(sp, 0.0)).b;
  float tear = step(0.97, hash21(vec2(floor(vUv.y * 120.0), floor(t * 12.0))));
  c = mix(c, vec3(1.0) - c, tear * active);
  fragColor = vec4(c, 1.0);
}
`;
