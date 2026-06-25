import { STYLIZE_COMMON } from "./common";

export const STAINED_GLASS_FRAG =
  STYLIZE_COMMON +
  `
void main(){
  float cellSize = mix(6.0, 60.0, uParams.x) * uDpr;
  float lead = mix(0.30, 0.46, uParams.y);
  float sat = mix(1.0, 2.2, uParams.z);
  float gridOp = uParams.w;
  vec2 cells = uResolution / cellSize;
  vec2 gp = vUv * cells;
  vec2 jit = vec2(fbm(floor(gp) * 1.3), fbm(floor(gp) * 2.1)) * 0.3;
  vec2 center = (floor(gp + jit) + 0.5) / cells;
  vec3 col = texture(uTex, center).rgb;
  float l = luma(col);
  col = mix(vec3(l), col, sat);
  vec2 f = abs(fract(gp + jit) - 0.5);
  float pane = smoothstep(0.5, 0.5 - lead * 0.3, max(f.x, f.y));
  vec3 leaded = mix(vec3(0.02), col, pane);
  vec3 outc = mix(col, leaded, gridOp);
  fragColor = vec4(mix(texture(uTex, vUv).rgb, outc, uIntensity), 1.0);
}
`;
