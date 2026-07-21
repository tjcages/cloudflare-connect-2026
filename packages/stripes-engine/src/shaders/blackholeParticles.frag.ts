export const BLACKHOLE_PARTICLES_FRAG = `#version 300 es
precision highp float;
in vec2 vQuad;
flat in highp float vVal;
flat in highp float vSoft;
out vec4 finalColor;
void main() {
  highp float sx = smoothstep(0.0, 0.3, vQuad.x) * smoothstep(1.0, 0.7, vQuad.x);
  highp float sy = smoothstep(0.0, 0.3, vQuad.y) * smoothstep(1.0, 0.7, vQuad.y);
  finalColor = vec4(vec3(vVal * mix(1.0, sx * sy, vSoft)), 1.0);
}
`;
