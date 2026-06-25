import { STYLIZE_COMMON } from "./common";

export const GLITCH_FRAG =
  STYLIZE_COMMON +
  `
void main(){
  float t = uTime;
  float slipAmt = mix(0.05, 0.35, uParams.x);
  float splitAmt = mix(4.0, 40.0, uParams.y);
  float freq = mix(0.3, 0.85, uParams.z);
  float tt = floor(t * 12.0);
  float band = floor(vUv.y * 20.0);
  float a = step(1.0 - freq, hash21(vec2(band, tt)));
  float slip = (hash21(vec2(band * 3.1, tt)) - 0.5) * slipAmt * a;
  float band2 = floor(vUv.y * 90.0);
  float a2 = step(0.85, hash21(vec2(band2, tt + 5.0)));
  slip += (hash21(vec2(band2, tt)) - 0.5) * 0.05 * a2;
  vec2 uv = vUv + vec2(slip, 0.0);
  float sp = (splitAmt * (0.5 + a)) / uResolution.x;
  vec3 c;
  c.r = texture(uTex, uv + vec2(sp, 0.0)).r;
  c.g = texture(uTex, uv - vec2(sp * 0.3, 0.0)).g;
  c.b = texture(uTex, uv - vec2(sp, 0.0)).b;
  if (a > 0.5 && hash21(vec2(band, tt + 9.0)) > 0.6) { c = c.gbr; }
  fragColor = vec4(mix(texture(uTex, vUv).rgb, c, uIntensity), 1.0);
}
`;
