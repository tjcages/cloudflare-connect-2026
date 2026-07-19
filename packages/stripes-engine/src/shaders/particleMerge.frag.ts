export const PARTICLE_MERGE_FRAG = `#version 300 es
precision highp float;
in vec2 vQuad;
flat in highp float vVal;
flat in highp float vAlpha;
out vec4 finalColor;
void main() {
  highp float d = length(vQuad - 0.5) * 2.0;
  highp float a = smoothstep(1.0, 0.15, d);
  finalColor = vec4(vec3(vVal * a * vAlpha), 1.0);
}
`;
