export const FLAMES_VERT = `#version 300 es
precision highp float;
in vec4 aRect;
in float aOpacity;
in float aRot;
uniform vec2 uCanvas;
uniform float uVertical;
out float vCross;
out float vOpacity;
void main() {
  vec2 corner = vec2(float(gl_VertexID == 1 || gl_VertexID == 4 || gl_VertexID == 5), float(gl_VertexID == 2 || gl_VertexID == 3 || gl_VertexID == 5));
  vec2 halfSize = aRect.zw * 0.5;
  vec2 local = (corner - 0.5) * aRect.zw;
  float cs = cos(aRot);
  float sn = sin(aRot);
  vec2 rotated = vec2(local.x * cs - local.y * sn, local.x * sn + local.y * cs);
  vec2 worldPx = aRect.xy + halfSize + rotated;
  vec2 uv = worldPx / uCanvas;
  gl_Position = vec4(uv.x * 2.0 - 1.0, 1.0 - uv.y * 2.0, 0.0, 1.0);
  vCross = (uVertical > 0.5) ? corner.x : corner.y;
  vOpacity = aOpacity;
}
`;

export const FLAMES_COLOR_VERT = `#version 300 es
precision highp float;
in vec4 aRect;
in float aOpacity;
in float aRot;
in vec3 aColor;
uniform vec2 uCanvas;
uniform float uVertical;
out float vCross;
out float vOpacity;
out vec3 vColor;
void main() {
  vec2 corner = vec2(float(gl_VertexID == 1 || gl_VertexID == 4 || gl_VertexID == 5), float(gl_VertexID == 2 || gl_VertexID == 3 || gl_VertexID == 5));
  vec2 halfSize = aRect.zw * 0.5;
  vec2 local = (corner - 0.5) * aRect.zw;
  float cs = cos(aRot);
  float sn = sin(aRot);
  vec2 rotated = vec2(local.x * cs - local.y * sn, local.x * sn + local.y * cs);
  vec2 worldPx = aRect.xy + halfSize + rotated;
  vec2 uv = worldPx / uCanvas;
  gl_Position = vec4(uv.x * 2.0 - 1.0, 1.0 - uv.y * 2.0, 0.0, 1.0);
  vCross = (uVertical > 0.5) ? corner.x : corner.y;
  vOpacity = aOpacity;
  vColor = aColor;
}
`;
