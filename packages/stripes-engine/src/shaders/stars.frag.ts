const STAR_SHAPE_GLSL = `float starShape(vec2 local) {
  vec2 p = local * 2.0 - 1.0;
  float shear = tan(clamp(vTilt, -1.35, 1.35));
  p.x -= p.y * shear;
  float dist = length(p);
  float core = smoothstep(0.24, 0.0, dist);
  float hRay = exp(-abs(p.y) * 34.0) * smoothstep(1.0, 0.0, abs(p.x));
  float vRay = exp(-abs(p.x) * 34.0) * smoothstep(1.0, 0.0, abs(p.y));
  float diamond = smoothstep(0.58, 0.0, abs(p.x) + abs(p.y));
  return clamp(max(core, max(hRay, vRay) * 0.88 + diamond * 0.42), 0.0, 1.0);
}`;

export const STARS_FRAG = `#version 300 es
precision highp float;
in vec2 vLocal;
in float vOpacity;
in float vTilt;
out vec4 finalColor;

${STAR_SHAPE_GLSL}

void main() {
  float a = clamp(starShape(vLocal) * vOpacity, 0.0, 1.0);
  finalColor = vec4(vec3(a), 1.0);
}
`;

export const STARS_COLOR_FRAG = `#version 300 es
precision highp float;
in vec2 vLocal;
in float vOpacity;
in float vTilt;
in vec3 vColor;
out vec4 finalColor;

${STAR_SHAPE_GLSL}

void main() {
  float a = clamp(starShape(vLocal) * vOpacity, 0.0, 1.0);
  finalColor = vec4(vColor * a, a);
}
`;
