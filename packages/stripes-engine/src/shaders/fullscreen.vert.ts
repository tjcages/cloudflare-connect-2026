export const FULLSCREEN_VERT = `#version 300 es
precision highp float;
out vec2 vUv;
void main() {
  // Fullscreen triangle from gl_VertexID (0,1,2)
  vec2 p = vec2((gl_VertexID == 2) ? 3.0 : -1.0, (gl_VertexID == 1) ? 3.0 : -1.0);
  vUv = (p + 1.0) * 0.5;
  gl_Position = vec4(p, 0.0, 1.0);
}
`;
