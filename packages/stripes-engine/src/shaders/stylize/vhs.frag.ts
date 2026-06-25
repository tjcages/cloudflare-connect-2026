import { STYLIZE_COMMON } from "./common";

export const VHS_FRAG =
  STYLIZE_COMMON +
  `
void main(){
  float t = uTime;
  float track = mix(0.01, 0.06, uParams.x);
  float chroma = mix(2.0, 9.0, uParams.y);
  float noiseAmt = uParams.z;
  float wob = (fbm(vec2(vUv.y * 40.0, t * 1.5)) - 0.5) * track * uIntensity;
  float band = smoothstep(0.0, 0.1, fract(vUv.y * 3.0 - t * 0.3));
  vec2 uv = vUv + vec2(wob + (1.0 - band) * track * 0.5 * uIntensity, 0.0);
  float sp = chroma / uResolution.x * uIntensity;
  vec3 c;
  c.r = texture(uTex, uv + vec2(sp * 1.5, 0.0)).r;
  c.g = texture(uTex, uv).g;
  c.b = texture(uTex, uv - vec2(sp, 0.0)).b;
  float scan = 0.5 + 0.5 * sin(vUv.y * uResolution.y / 1.5 * 6.28318 - t * 10.0);
  c *= mix(1.0, 0.7 + 0.3 * scan, 0.5 * uIntensity);
  float n = hash21(floor(vUv * uResolution / 2.0) + floor(t * 30.0));
  c += (n - 0.5) * noiseAmt * 0.2 * uIntensity;
  c = mix(c, vec3(n), smoothstep(0.05, 0.0, vUv.y) * 0.8 * uIntensity);
  fragColor = vec4(c, 1.0);
}
`;
