export const MURMURATION_DECAY_FRAG = `#version 300 es
precision highp float;
uniform sampler2D uTrail;
uniform float uDecay;
uniform float uFloor;
in vec2 vUv;
out vec4 outColor;
void main() {
  float v = texture(uTrail, vUv).r;
  outColor = vec4(vec3(max(v * uDecay - uFloor, 0.0)), 1.0);
}
`;

export const MURMURATION_STREAK_VERT = `#version 300 es
precision highp float;
in vec4 aPose;
in vec2 aSize;
uniform vec2 uCanvas;
out vec2 vLocal;
out float vAlpha;
void main() {
  vec2 corner = vec2(float(gl_VertexID == 1 || gl_VertexID == 4 || gl_VertexID == 5), float(gl_VertexID == 2 || gl_VertexID == 3 || gl_VertexID == 5));
  vec2 local = (corner - 0.5) * aSize;
  float cs = cos(aPose.z);
  float sn = sin(aPose.z);
  vec2 rotated = vec2(local.x * cs - local.y * sn, local.x * sn + local.y * cs);
  vec2 world = aPose.xy + rotated;
  vec2 uv = world / uCanvas;
  gl_Position = vec4(uv.x * 2.0 - 1.0, 1.0 - uv.y * 2.0, 0.0, 1.0);
  vLocal = corner - 0.5;
  vAlpha = aPose.w;
}
`;

export const MURMURATION_STREAK_FRAG = `#version 300 es
precision highp float;
in vec2 vLocal;
in float vAlpha;
out vec4 outColor;
void main() {
  float axial = 1.0 - smoothstep(0.12, 0.5, abs(vLocal.x));
  float head = smoothstep(-0.5, 0.35, vLocal.x);
  float lateral = exp(-vLocal.y * vLocal.y * 14.0);
  float v = vAlpha * lateral * axial * (0.45 + 0.55 * head);
  outColor = vec4(vec3(v), 1.0);
}
`;

export const MURMURATION_COMPOSITE_FRAG = `#version 300 es
precision highp float;
uniform sampler2D uField;
uniform sampler2D uTrail;
uniform float uGhost;
in vec2 vUv;
out vec4 outColor;
void main() {
  float base = texture(uField, vUv).r;
  float trail = texture(uTrail, vUv).r;
  float v = min(1.0, base * uGhost + trail);
  outColor = vec4(vec3(v), 1.0);
}
`;
