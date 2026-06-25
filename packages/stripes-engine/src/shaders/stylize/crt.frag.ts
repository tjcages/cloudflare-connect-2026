import { STYLIZE_COMMON } from "./common";

export const CRT_FRAG =
  STYLIZE_COMMON +
  `
void main(){
  float t = uTime;
  vec2 px = vUv * uResolution;
  float sp = (1.5 + 3.0 * uIntensity) / uResolution.x;
  vec3 c;
  c.r = texture(uTex, vUv + vec2(sp, 0.0)).r;
  c.g = texture(uTex, vUv).g;
  c.b = texture(uTex, vUv - vec2(sp, 0.0)).b;
  float scan = 0.5 + 0.5 * sin((px.y / 1.6 - t * 3.0) * 6.28318);
  c *= mix(1.0, 0.35 + 0.65 * scan, uIntensity);
  float col = mod(floor(px.x / (1.5 * uDpr)), 3.0);
  vec3 mask = vec3(0.7);
  if (col < 0.5) mask.r = 1.0; else if (col < 1.5) mask.g = 1.0; else mask.b = 1.0;
  c *= mix(vec3(1.0), mask, 0.5 * uIntensity);
  vec3 bloom = blurTex(vUv, 2.5 * uDpr);
  c += bloom * 0.22 * uIntensity;
  vec2 q = vUv - 0.5;
  c *= 1.0 - dot(q, q) * (0.6 * uIntensity);
  fragColor = vec4(c, 1.0);
}
`;
