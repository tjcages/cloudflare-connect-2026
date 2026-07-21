export const COMET_PASSAGE_MAX_COMETS = 4;
export const COMET_PASSAGE_PATH_POINTS = 12;

export const COMET_PASSAGE_FRAG = `#version 300 es
precision highp float;

const int MAX_COMETS = ${COMET_PASSAGE_MAX_COMETS};
const int PATH_POINTS = ${COMET_PASSAGE_PATH_POINTS};
const float TAU = 6.2831853;
const float STAR_CELL = 46.0;

uniform sampler2D uField;
uniform vec2 uCssSize;
uniform float uTime;
uniform int uCometCount;
uniform vec4 uCometHead[MAX_COMETS];
uniform vec4 uCometShape[MAX_COMETS];
uniform vec3 uCometBound[MAX_COMETS];
uniform vec2 uPath[MAX_COMETS * PATH_POINTS];

in vec2 vUv;
out vec4 outColor;

float hash21(vec2 value) {
  return fract(sin(dot(value, vec2(127.1, 311.7))) * 43758.5453123);
}

float nucleusShape(vec2 point, vec2 head, vec2 direction, float radius) {
  vec2 relative = point - head;
  vec2 side = vec2(-direction.y, direction.x);
  float along = dot(relative, direction);
  float lateral = dot(relative, side);
  float forward = along >= 0.0 ? along / max(radius, 0.35) : along / max(radius * 1.9, 0.35);
  float across = lateral / max(radius * 0.74, 0.35);
  return exp(-pow(forward * forward + across * across + 1e-4, 1.3));
}

float tailShape(vec2 point, int comet, float width) {
  int base = comet * PATH_POINTS;
  float last = float(PATH_POINTS - 1);
  float best = 0.0;
  for (int index = 0; index < PATH_POINTS - 1; index++) {
    vec2 a = uPath[base + index];
    vec2 b = uPath[base + index + 1];
    vec2 span = b - a;
    float t = clamp(dot(point - a, span) / max(dot(span, span), 1e-3), 0.0, 1.0);
    vec2 offset = point - (a + span * t);
    float u = (float(index) + t) / last;
    float w = width * mix(1.0, 0.24, u);
    float amp = pow(max(1.0 - u, 0.0), 0.6);
    best = max(best, exp(-dot(offset, offset) / max(w * w, 0.5)) * amp);
  }
  return best;
}

vec2 cometShape(vec2 point, float scale) {
  vec2 accumulated = vec2(0.0);
  for (int comet = 0; comet < MAX_COMETS; comet++) {
    if (comet >= uCometCount) break;
    vec3 bound = uCometBound[comet];
    if (distance(point, bound.xy) > bound.z) continue;
    vec4 head = uCometHead[comet];
    vec4 shape = uCometShape[comet];
    float radius = shape.z * scale;
    float nucleus = nucleusShape(point, head.xy, shape.xy, radius) * head.z;
    float tail = tailShape(point, comet, max(radius * 0.9 * shape.w, 1.0)) * head.z;
    accumulated = max(accumulated, vec2(nucleus, tail));
  }
  return accumulated;
}

float cometPotential(vec2 point, float scale) {
  vec2 shape = cometShape(point, scale);
  return max(shape.x, shape.y * 0.9) * 0.42;
}

float starLight(vec2 point, float scale) {
  float light = 0.0;
  float cell = STAR_CELL * scale;
  vec2 baseId = floor(point / cell);
  for (int row = -1; row <= 1; row++) {
    for (int column = -1; column <= 1; column++) {
      vec2 cellId = baseId + vec2(float(column), float(row));
      if (hash21(cellId + 23.0) < 0.58) continue;
      vec2 jitter = vec2(hash21(cellId + vec2(41.3, 9.7)), hash21(cellId + vec2(3.9, 67.1)));
      vec2 center = (cellId + 0.18 + jitter * 0.64) * cell;
      float starDistance = length(point - center);
      float radius = mix(1.15, 2.9, hash21(cellId + 83.1)) * scale;
      float phase = hash21(cellId + 149.7) * TAU;
      float speed = mix(0.16, 0.42, hash21(cellId + 211.3));
      float twinkle = 0.72 + 0.28 * sin(uTime * speed + phase);
      float core = 1.0 - smoothstep(radius * 0.45, radius + 0.9, starDistance);
      float halo = exp(-(starDistance * starDistance) / max(0.001, radius * radius * 4.5)) * 0.2;
      light = max(light, (core + halo) * twinkle);
    }
  }
  return light;
}

void main() {
  vec2 point = vUv * uCssSize;
  float scale = clamp(min(uCssSize.x, uCssSize.y) / 300.0, 0.55, 2.4);

  vec2 shape = cometShape(point, scale);
  float bodyValue = max(shape.x, shape.y * 0.92);
  float glow = smoothstep(0.22, 0.6, bodyValue);
  float halo = smoothstep(0.015, 0.11, bodyValue) * (1.0 - smoothstep(0.11, 0.32, bodyValue));

  float epsilon = 2.0 * scale;
  float gradientX = cometPotential(point + vec2(epsilon, 0.0), scale) - cometPotential(point - vec2(epsilon, 0.0), scale);
  float gradientY = cometPotential(point + vec2(0.0, epsilon), scale) - cometPotential(point - vec2(0.0, epsilon), scale);
  vec2 push = vec2(gradientX, gradientY) / (2.0 * epsilon) * 760.0 * scale;
  float magnitude = length(push);
  float maxPush = 26.0 * scale;
  if (magnitude > maxPush) push *= maxPush / magnitude;

  vec2 uv = clamp(vUv + push / uCssSize, 0.0, 1.0);
  float base = texture(uField, uv).r;

  float value = base * (1.0 - halo * 0.58);
  value = max(value, starLight(point, scale) * 0.7);
  value = clamp(mix(value, 1.0, glow), 0.0, 1.0);
  outColor = vec4(vec3(value), 1.0);
}
`;
