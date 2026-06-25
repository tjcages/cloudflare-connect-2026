import { STYLIZE_COMMON } from "./common";

export const PLASMA_FRAG =
  STYLIZE_COMMON +
  `
vec3 plasmaPal(float x){ return 0.5 + 0.5 * cos(6.2831 * (vec3(0.0, 0.33, 0.67) + x)); }
void main(){
  float scl = mix(4.0, 14.0, uParams.x);
  float spd = mix(0.2, 1.2, uParams.y);
  float blend = mix(0.5, 1.0, uParams.z);
  float t = uTime * spd;
  vec3 src = texture(uTex, vUv).rgb;
  vec2 pp = vUv * vec2(uResolution.x / uResolution.y, 1.0);
  float p = sin(pp.x * scl + t) + sin(pp.y * scl + t * 1.3) + fbm(vUv * scl * 0.7 + t * 0.2) * 3.0;
  vec3 pl = plasmaPal(p * 0.25 + t * 0.1);
  float l = luma(src);
  vec3 c = pl * (0.4 + 0.9 * l);
  c = mix(pl, c, blend);
  fragColor = vec4(mix(src, c, uIntensity), 1.0);
}
`;
