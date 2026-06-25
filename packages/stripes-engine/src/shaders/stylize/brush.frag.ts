import { STYLIZE_COMMON } from "./common";

export const BRUSH_FRAG =
  STYLIZE_COMMON +
  `
void main(){
  float strokeAmt = uParams.x;
  float bristleAmt = uParams.y;
  float impasto = uParams.z;
  float strokeLen = mix(0.5, 16.0, strokeAmt) * uDpr;
  float ang = (fbm(vUv * 2.5) - 0.5) * 3.14159;
  vec2 dir = vec2(cos(ang), sin(ang));
  vec2 perp = vec2(-dir.y, dir.x);
  vec3 col = vec3(0.0);
  float wsum = 0.0;
  for (int i = -5; i <= 5; i++) {
    float w = 1.0 - abs(float(i)) / 6.0;
    col += texture(uTex, vUv + dir * float(i) * strokeLen / uResolution).rgb * w;
    wsum += w;
  }
  col /= wsum;
  vec2 sp = vUv * uResolution;
  float bristle = fbm(vec2(dot(sp, perp) * 0.5, dot(sp, dir) * 0.04));
  col *= mix(1.0, 0.72 + 0.45 * bristle, bristleAmt);
  col += smoothstep(0.72, 1.0, bristle) * impasto * 0.22;
  fragColor = vec4(mix(texture(uTex, vUv).rgb, col, uIntensity), 1.0);
}
`;
