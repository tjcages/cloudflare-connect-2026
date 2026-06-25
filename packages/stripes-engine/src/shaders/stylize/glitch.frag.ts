import { STYLIZE_COMMON } from "./common";

export const GLITCH_FRAG =
  STYLIZE_COMMON +
  `
void main(){
  float t = uTime;
  float slipAmt = mix(0.02, 0.3, uParams.x);
  float splitAmt = mix(2.0, 30.0, uParams.y);
  float freq = mix(0.15, 0.7, uParams.z);
  float row = floor(vUv.y * 32.0);
  float rseed = hash21(vec2(row, floor(t * 10.0)));
  float active = step(1.0 - freq, rseed);
  float slip = (hash21(vec2(row * 1.7, floor(t * 10.0) + 3.0)) - 0.5) * slipAmt * active;
  vec2 uv = vUv + vec2(slip, 0.0);
  float sp = (splitAmt * (0.4 + 0.9 * active)) / uResolution.x;
  vec3 c;
  c.r = texture(uTex, uv + vec2(sp, 0.0)).r;
  c.g = texture(uTex, uv).g;
  c.b = texture(uTex, uv - vec2(sp, 0.0)).b;
  float tear = step(0.9, hash21(vec2(floor(vUv.y * 70.0), floor(t * 14.0)))) * active;
  c = mix(c, vec3(1.0) - c, tear);
  fragColor = vec4(mix(texture(uTex, vUv).rgb, c, uIntensity), 1.0);
}
`;
