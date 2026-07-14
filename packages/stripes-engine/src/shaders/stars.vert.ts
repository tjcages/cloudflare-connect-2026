export const STARS_VERT = `#version 300 es
precision highp float;
in vec4 aRect;
in float aOpacity;
in float aTilt;
uniform vec2 uCanvas;
out vec2 vLocal;
out float vOpacity;
out float vTilt;
void main() {
  vec2 corner = vec2(float(gl_VertexID == 1 || gl_VertexID == 4 || gl_VertexID == 5), float(gl_VertexID == 2 || gl_VertexID == 3 || gl_VertexID == 5));
  vec2 worldPx = aRect.xy + corner * aRect.zw;
  vec2 uv = worldPx / uCanvas;
  gl_Position = vec4(uv.x * 2.0 - 1.0, 1.0 - uv.y * 2.0, 0.0, 1.0);
  vLocal = corner;
  vOpacity = aOpacity;
  vTilt = aTilt;
}
`;

export const STARS_COLOR_VERT = `#version 300 es
precision highp float;
in vec4 aRect;
in float aOpacity;
in float aTilt;
in vec3 aColor;
uniform vec2 uCanvas;
out vec2 vLocal;
out float vOpacity;
out float vTilt;
out vec3 vColor;
void main() {
  vec2 corner = vec2(float(gl_VertexID == 1 || gl_VertexID == 4 || gl_VertexID == 5), float(gl_VertexID == 2 || gl_VertexID == 3 || gl_VertexID == 5));
  vec2 worldPx = aRect.xy + corner * aRect.zw;
  vec2 uv = worldPx / uCanvas;
  gl_Position = vec4(uv.x * 2.0 - 1.0, 1.0 - uv.y * 2.0, 0.0, 1.0);
  vLocal = corner;
  vOpacity = aOpacity;
  vTilt = aTilt;
  vColor = aColor;
}
`;
