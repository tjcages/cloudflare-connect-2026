import { STYLIZE_COMMON } from "./common";

export const ABSTRACT_FRAG =
  STYLIZE_COMMON +
  `
void main(){
  float grainAmt = uParams.y;
  float soft = mix(0.0, 1.5, uParams.z);
  float rough = mix(0.4, 2.5, uParams.x);
  float barFrac = mix(0.4, 0.95, uParams.w);
  float colW = 7.0 * uDpr;
  float colId = floor(vUv.x * uResolution.x / colW);
  float dur = mix(0.4, 2.5, hash21(vec2(colId, 1.0)));
  float tick = floor(uTime / dur + hash21(vec2(colId, 2.0)) * 13.0);
  float seed = hash21(vec2(colId, tick)) * 30.0;
  float ph = fract(vUv.x * uResolution.x / colW);
  float jit = (fbm(vec2(vUv.y * 14.0 + seed, seed)) - 0.5) * rough * 0.05;
  float halfBar = barFrac * 0.5;
  float bar = smoothstep(halfBar + 0.06, halfBar - 0.06, abs(ph - 0.5) - jit);
  vec3 logo = soft > 0.01 ? blurTex(vUv, soft * uDpr) : texture(uTex, vUv).rgb;
  float paper = mix(fbm(vUv * uResolution / 3.0), hash21(floor(vUv * uResolution / 1.5)), 0.5);
  logo *= mix(1.0, 0.75 + 0.5 * paper, grainAmt * 0.6);
  vec3 outc = mix(vec3(1.0), logo, bar);
  fragColor = vec4(mix(texture(uTex, vUv).rgb, outc, uIntensity), 1.0);
}
`;
