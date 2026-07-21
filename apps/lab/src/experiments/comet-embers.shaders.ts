export const COMET_COMPOSITE_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uField;
uniform vec2 uCssSize;
uniform vec2 uHead;
uniform vec2 uVel;
uniform float uGlow;
uniform float uTime;
out vec4 outColor;
void main() {
  float base = texture(uField, vUv).r;
  vec2 p = vec2(vUv.x, 1.0 - vUv.y) * uCssSize;
  float speed = length(uVel);
  vec2 dir = speed > 1.0 ? uVel / speed : vec2(1.0, 0.0);
  float tail = clamp(speed * 0.055, 0.0, 95.0);
  vec2 d = p - uHead;
  float along = clamp(dot(d, dir), -tail, 0.0);
  float tt = tail > 1.0 ? -along / tail : 0.0;
  vec2 nearest = uHead + dir * along;
  vec2 rel = p - nearest;
  float dist2 = dot(rel, rel);
  float coreR = mix(9.5, 3.5, tt);
  float haloR = mix(26.0, 9.0, tt);
  float core = exp(-dist2 / (coreR * coreR)) * (1.0 - tt * 0.8);
  float halo = exp(-dist2 / (haloR * haloR)) * 0.32 * (1.0 - tt * 0.9);
  float flick = 0.93 + 0.07 * sin(uTime * 9.3 + sin(uTime * 23.7) * 1.9);
  float glow = (core + halo) * uGlow * flick;
  outColor = vec4(vec3(clamp(base + glow, 0.0, 1.0)), 1.0);
}
`;

export const EMBER_VERT = `#version 300 es
precision highp float;
in vec4 aEmber;
in float aSeed;
uniform vec2 uCanvas;
out vec2 vLocal;
out float vT;
out float vSeed;
void main() {
  vec2 corner = vec2(float(gl_VertexID == 1 || gl_VertexID == 4 || gl_VertexID == 5), float(gl_VertexID == 2 || gl_VertexID == 3 || gl_VertexID == 5));
  vec2 local = (corner - 0.5) * 2.0;
  vec2 worldPx = aEmber.xy + local * aEmber.z * 2.4;
  vec2 uv = worldPx / uCanvas;
  gl_Position = vec4(uv.x * 2.0 - 1.0, 1.0 - uv.y * 2.0, 0.0, 1.0);
  vLocal = local * 2.4;
  vT = aEmber.w;
  vSeed = aSeed;
}
`;

export const EMBER_FRAG = `#version 300 es
precision highp float;
in vec2 vLocal;
in float vT;
in float vSeed;
uniform float uTime;
out vec4 outColor;
void main() {
  float d2 = dot(vLocal, vLocal);
  float fall = exp(-d2 * 1.4);
  float heat = clamp(1.0 - vT, 0.0, 1.0);
  float shade = pow(heat, 1.6);
  float flick = 0.84 + 0.16 * sin(uTime * (5.0 + vSeed * 12.0) + vSeed * 61.7);
  shade *= mix(1.0, flick, smoothstep(0.15, 0.5, vT));
  float fadeIn = smoothstep(0.0, 0.06, vT);
  float fadeOut = 1.0 - smoothstep(0.78, 1.0, vT);
  float alpha = fall * fadeIn * fadeOut * 0.95;
  outColor = vec4(vec3(shade), alpha);
}
`;
