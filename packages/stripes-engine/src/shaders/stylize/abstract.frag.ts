import { STYLIZE_COMMON } from "./common";

export const ABSTRACT_FRAG =
  STYLIZE_COMMON +
  `
void main(){
  float amp = mix(1.5, 10.0, uParams.x) * uDpr;
  float grainAmt = uParams.y;
  float freq = mix(3.0, 14.0, uParams.z);
  float colW = 7.0 * uDpr;
  float colId = floor(vUv.x * uResolution.x / colW);
  float dur = mix(0.6, 3.0, hash21(vec2(colId, 1.0)));
  float tick = floor(uTime / dur + hash21(vec2(colId, 2.0)) * 13.0);
  float seed = hash21(vec2(colId, tick)) * 30.0;
  float dx = (fbm(vec2(vUv.y * freq + seed, seed * 0.7)) - 0.5) * amp;
  float dy = (fbm(vec2(vUv.x * 10.0, vUv.y * freq * 0.5 + seed)) - 0.5) * amp * 0.4;
  vec2 uv = vUv + vec2(dx, dy) / uResolution;
  vec3 c = texture(uStripes, uv).rgb;
  float paper = mix(fbm(vUv * uResolution / 3.0), hash21(floor(vUv * uResolution / 1.5)), 0.5);
  c *= mix(1.0, 0.8 + 0.4 * paper, grainAmt * 0.5);
  fragColor = vec4(mix(texture(uStripes, vUv).rgb, c, uIntensity), 1.0);
}
`;
