import { STYLIZE_COMMON } from "./common";

export const VHS_FRAG =
  STYLIZE_COMMON +
  `
void main(){
  float t = uTime;
  float jitter = (fbm(vec2(vUv.y * 60.0, t * 2.0)) - 0.5) * 0.02 * uIntensity;
  vec2 uv = vUv + vec2(jitter, 0.0);
  float sp = (2.6 / uResolution.x) * uIntensity;
  vec3 c;
  c.r = texture(uTex, uv + vec2(sp, 0.0)).r;
  c.g = texture(uTex, uv).g;
  c.b = texture(uTex, uv - vec2(sp, 0.0)).b;
  float scan = 0.5 + 0.5 * sin(uv.y * uResolution.y * 0.5 - t * 20.0);
  c *= mix(1.0, 0.7 + 0.3 * scan, 0.4 * uIntensity);
  float n = grain(vUv, floor(t * 24.0));
  c += (n - 0.5) * 0.08 * uIntensity;
  fragColor = vec4(c, 1.0);
}
`;
