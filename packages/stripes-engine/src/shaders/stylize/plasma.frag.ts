import { STYLIZE_COMMON } from "./common";

export const PLASMA_FRAG =
  STYLIZE_COMMON +
  `
vec3 plasmaPal(float x){ return 0.5 + 0.5 * cos(6.2831 * (vec3(0.0, 0.33, 0.67) + x)); }
void main(){
  float scl = mix(4.0, 14.0, uParams.x);
  float spd = mix(0.0, 1.2, uParams.y);
  float takeover = uParams.z;
  float scanAmt = uParams.w;
  float t = uTime * spd;
  vec3 src = texture(uTex, vUv).rgb;
  vec2 pp = vUv * vec2(uResolution.x / uResolution.y, 1.0);
  float p = sin(pp.x * scl + t) + sin(pp.y * scl + t * 1.3) + fbm(vUv * scl * 0.7 + t * 0.2) * 3.0;
  vec3 pl = plasmaPal(p * 0.25 + t * 0.1);
  float ink = 1.0 - luma(src);
  vec3 bg = mix(vec3(0.06), pl, takeover);
  vec3 c = mix(bg, src, smoothstep(0.12, 0.5, ink));
  float scan = 0.5 + 0.5 * sin(vUv.y * uResolution.y / 2.2 * 6.28318 - t * 8.0);
  c *= mix(1.0, 0.7 + 0.3 * scan, scanAmt);
  fragColor = vec4(mix(src, c, uIntensity), 1.0);
}
`;
