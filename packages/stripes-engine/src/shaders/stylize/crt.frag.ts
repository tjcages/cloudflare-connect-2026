import { STYLIZE_COMMON } from "./common";

export const CRT_FRAG =
  STYLIZE_COMMON +
  `
void main(){
  float t = uTime;
  vec2 uv = vUv;
  float sp = (1.4 / uResolution.x) * uIntensity;
  vec3 c;
  c.r = texture(uTex, uv + vec2(sp, 0.0)).r;
  c.g = texture(uTex, uv).g;
  c.b = texture(uTex, uv - vec2(sp, 0.0)).b;
  float scan = 0.5 + 0.5 * sin((uv.y * uResolution.y + t * 30.0) * 3.14159);
  c *= mix(1.0, 0.6 + 0.4 * scan, 0.5 * uIntensity);
  fragColor = vec4(c, 1.0);
}
`;
