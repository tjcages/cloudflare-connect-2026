import { STYLIZE_COMMON } from "./common";

export const ABSTRACT_FRAG =
  STYLIZE_COMMON +
  `
void main(){
  float grainAmt = uParams.y;
  float soft = mix(0.0, 1.5, uParams.z);
  float amp = mix(0.4, 2.5, uParams.x) * uDpr;
  float colW = 6.0 * uDpr;
  float colId = floor(vUv.x * uResolution.x / colW);
  float dur = mix(0.4, 2.5, hash21(vec2(colId, 1.0)));
  float tick = floor(uTime / dur + hash21(vec2(colId, 2.0)) * 13.0);
  float seed = hash21(vec2(colId, tick)) * 30.0;
  vec2 jit;
  jit.x = (fbm(vUv * vec2(24.0, 110.0) + seed) - 0.5) + (fbm(vUv * vec2(80.0, 260.0) + seed * 1.3) - 0.5) * 0.5;
  jit.y = (fbm(vUv * vec2(110.0, 24.0) + seed) - 0.5) + (fbm(vUv * vec2(260.0, 80.0) + seed * 0.7) - 0.5) * 0.5;
  vec2 uv = vUv + jit * (amp / uResolution) * uIntensity;
  vec3 c = soft > 0.01 ? blurTex(uv, soft * uDpr) : texture(uTex, uv).rgb;
  float paper = mix(fbm(vUv * uResolution / 3.0), hash21(floor(vUv * uResolution / 1.5)), 0.5);
  c *= mix(1.0, 0.75 + 0.5 * paper, grainAmt * 0.6 * uIntensity);
  fragColor = vec4(c, 1.0);
}
`;
