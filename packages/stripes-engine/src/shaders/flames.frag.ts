export const FLAMES_FRAG = `#version 300 es
precision highp float;
in float vCross;
in float vOpacity;
uniform float uInner;
uniform float uOuter;
out vec4 finalColor;
void main() {
  float ramp = min(vCross / uInner, (1.0 - vCross) / (1.0 - uOuter));
  float a = vOpacity * clamp(ramp, 0.0, 1.0);
  finalColor = vec4(vec3(a), 1.0);
}
`;

export const FLAMES_COLOR_OVER_FRAG = `#version 300 es
precision highp float;
in float vCross;
in float vOpacity;
in vec3 vColor;
uniform float uInner;
uniform float uOuter;
out vec4 finalColor;
void main() {
  float ramp = min(vCross / uInner, (1.0 - vCross) / (1.0 - uOuter));
  float a = vOpacity * clamp(ramp, 0.0, 1.0);
  finalColor = vec4(vColor * a, a);
}
`;
