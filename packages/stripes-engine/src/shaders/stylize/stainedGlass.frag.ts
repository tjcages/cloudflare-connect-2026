import { STYLIZE_COMMON } from "./common";

export const STAINED_GLASS_FRAG =
  STYLIZE_COMMON +
  `
void main(){
  float cellSize = mix(16.0, 48.0, uParams.x) * uDpr;
  float lead = mix(0.30, 0.45, uParams.y);
  float sat = mix(1.0, 2.2, uParams.z);
  vec2 cells = uResolution / cellSize;
  vec2 gp = vUv * cells;
  vec2 jit = vec2(fbm(floor(gp) * 1.3), fbm(floor(gp) * 2.1)) * 0.3;
  vec2 center = (floor(gp + jit) + 0.5) / cells;
  vec3 c = texture(uTex, center).rgb;
  float l = luma(c);
  c = mix(vec3(l), c, sat);
  vec2 f = abs(fract(gp + jit) - 0.5);
  float pane = smoothstep(0.5, 0.5 - lead * 0.3, max(f.x, f.y));
  c = mix(vec3(0.02), c, pane);
  fragColor = vec4(mix(texture(uTex, vUv).rgb, c, uIntensity), 1.0);
}
`;
