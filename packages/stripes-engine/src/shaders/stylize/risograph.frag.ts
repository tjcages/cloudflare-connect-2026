import { STYLIZE_COMMON } from "./common";

export const RISOGRAPH_FRAG =
  STYLIZE_COMMON +
  `
void main(){
  float t = uTime * 0.3;
  vec2 o = (vec2(5.0, 4.0) / uResolution) * (1.0 + sin(t * 2.0));
  vec3 a = texture(uTex, vUv - o).rgb;
  vec3 b = texture(uTex, vUv + o).rgb;
  vec3 ink1 = mix(vec3(1.0), vec3(1.0, 0.45, 0.1), 1.0 - luma(a));
  vec3 ink2 = mix(vec3(1.0), vec3(0.1, 0.5, 0.9), 1.0 - luma(b));
  vec3 c = ink1 * ink2;
  float gnoise = hash21(floor(vUv * uResolution / 1.5));
  c *= mix(1.0, 0.82 + 0.3 * gnoise, 0.5 * uIntensity);
  fragColor = vec4(mix(texture(uTex, vUv).rgb, c, uIntensity), 1.0);
}
`;
