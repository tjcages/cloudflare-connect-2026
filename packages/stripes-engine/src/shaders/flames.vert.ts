export const FLAMES_VERT = `#version 300 es
precision highp float;
in vec4 aRect;
in float aOpacity;
uniform vec2 uCanvas;
uniform float uVertical;
out float vCross;
out float vOpacity;
void main() {
  vec2 corner = vec2(float(gl_VertexID == 1 || gl_VertexID == 4 || gl_VertexID == 5), float(gl_VertexID == 2 || gl_VertexID == 3 || gl_VertexID == 5));
  vec2 worldPx = aRect.xy + corner * aRect.zw;
  vec2 uv = worldPx / uCanvas;
  gl_Position = vec4(uv * 2.0 - 1.0, 0.0, 1.0);
  vCross = (uVertical > 0.5) ? corner.x : corner.y;
  vOpacity = aOpacity;
}
`;
