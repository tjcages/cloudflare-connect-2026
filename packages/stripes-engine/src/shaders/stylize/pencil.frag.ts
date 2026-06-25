import { STYLIZE_COMMON } from "./common";

export const PENCIL_FRAG =
  STYLIZE_COMMON +
  `
void main(){
  float t = uTime * 0.15;
  float density = mix(0.4, 1.0, uParams.x);
  float pressure = uParams.y;
  float paperAmt = uParams.z;
  vec2 pp = vUv * uResolution;
  vec3 tone = vec3(0.0);
  for (int i = -2; i <= 2; i++) {
    for (int j = -2; j <= 2; j++) {
      tone += texture(uTex, vUv + vec2(float(i), float(j)) * 2.6 / uResolution).rgb;
    }
  }
  tone /= 25.0;
  float ink = 1.0 - luma(tone);
  float sketch = (fbm(vUv * 70.0) - 0.5) * 5.0;
  float scale = 0.5 * density;
  float a1 = 0.5 + 0.5 * sin((pp.x * 0.7 + pp.y * 0.7) * scale + sketch);
  float a2 = 0.5 + 0.5 * sin((pp.x * 0.7 - pp.y * 0.7) * scale + sketch);
  float a3 = 0.5 + 0.5 * sin((pp.x * 0.15 + pp.y) * scale + sketch);
  float k = ink * (0.7 + 0.9 * pressure);
  float h1 = smoothstep(0.5, 0.3, a1) * step(0.1, k);
  float h2 = smoothstep(0.5, 0.3, a2) * step(0.4, k);
  float h3 = smoothstep(0.5, 0.3, a3) * step(0.65, k);
  float cover = clamp(h1 + h2 + h3, 0.0, 1.0) * smoothstep(0.03, 0.22, ink);
  float grain = hash21(floor(pp / 1.5));
  cover *= mix(1.0, 0.6 + 0.4 * grain, paperAmt);
  vec3 strokeCol = tone * 0.8;
  vec3 outc = mix(vec3(0.98), strokeCol, cover);
  fragColor = vec4(mix(texture(uTex, vUv).rgb, outc, uIntensity), 1.0);
}
`;
