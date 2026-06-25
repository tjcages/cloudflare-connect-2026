import { STYLIZE_COMMON } from "./common";

export const PAPER_CUTOUT_FRAG =
  STYLIZE_COMMON +
  `
void main(){
  float t = uTime * 0.2;
  float shadowAmt = uParams.x;
  float levels = mix(3.0, 8.0, uParams.y);
  float rough = uParams.z;
  vec2 uv = warp(vUv, vec2(40.0, 60.0), mix(0.004, 0.014, rough) * uIntensity, t);
  float cell = 4.0 * uDpr;
  vec2 cells = uResolution / cell;
  vec3 c = texture(uTex, (floor(uv * cells) + 0.5) / cells).rgb;
  vec2 sh = vec2(8.0, 8.0) / uResolution;
  float hereInk = 1.0 - luma(c);
  float overInk = 1.0 - luma(texture(uTex, (floor((uv - sh) * cells) + 0.5) / cells).rgb);
  float shadow = clamp(overInk - hereInk, 0.0, 1.0);
  c = mix(c, c * 0.4, shadow * shadowAmt * uIntensity);
  vec3 post = floor(c * levels + 0.5) / levels;
  c = mix(c, post, uIntensity);
  fragColor = vec4(c, 1.0);
}
`;
