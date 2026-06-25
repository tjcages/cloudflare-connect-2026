import { STYLIZE_COMMON } from "./common";

export const VHS_FRAG =
  STYLIZE_COMMON +
  `
void main(){
  float t = uTime;
  float track = mix(0.01, 0.06, uParams.x);
  float chroma = mix(2.0, 12.0, uParams.y);
  float wob = (fbm(vec2(vUv.y * 40.0, t * 1.5)) - 0.5) * track;
  float bandShift = 0.0;
  float bandBright = 0.0;
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    float by = fract(hash21(vec2(fi, 3.0)) + t * (0.02 + 0.025 * fi));
    float bh = mix(0.006, 0.05, hash21(vec2(fi, 7.0)));
    float b = smoothstep(bh, 0.0, abs(vUv.y - by));
    bandShift += b * (hash21(vec2(fi, 11.0)) - 0.5) * 0.05;
    bandBright += b;
  }
  vec2 uv = vUv + vec2(wob + bandShift, 0.0);
  float sp = chroma / uResolution.x;
  vec3 c;
  c.r = texture(uTex, uv + vec2(sp * 1.5, 0.0)).r;
  c.g = texture(uTex, uv).g;
  c.b = texture(uTex, uv - vec2(sp, 0.0)).b;
  float scan = 0.5 + 0.5 * sin(vUv.y * uResolution.y / 2.2 * 6.28318 - t * 8.0);
  c *= mix(1.0, 0.84 + 0.16 * scan, 0.5);
  c += clamp(bandBright, 0.0, 1.0) * 0.12;
  fragColor = vec4(mix(texture(uTex, vUv).rgb, c, uIntensity), 1.0);
}
`;
