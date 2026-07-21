export const METEOR_SHOWER_MAX_METEORS = 36;

export const METEOR_SHOWER_FRAG = `#version 300 es
precision highp float;

const int MAX_METEORS = ${METEOR_SHOWER_MAX_METEORS};
const float TAU = 6.2831853;
const float STAR_CELL = 30.0;

uniform sampler2D uField;
uniform vec2 uCanvasSize;
uniform vec2 uRadiantDirection;
uniform float uTime;
uniform int uMeteorCount;
uniform vec4 uMeteorOrigin[MAX_METEORS];
uniform vec4 uMeteorShape[MAX_METEORS];

in vec2 vUv;
out vec4 outColor;

float hash21(vec2 value) {
  return fract(sin(dot(value, vec2(127.1, 311.7))) * 43758.5453123);
}

vec2 rotateVector(vec2 value, float angle) {
  float cosine = cos(angle);
  float sine = sin(angle);
  return vec2(cosine * value.x - sine * value.y, sine * value.x + cosine * value.y);
}

float pushProfile(float radius, float width) {
  float normalized = radius / max(width, 0.001);
  return normalized * exp(1.0 - normalized * normalized);
}

void starfield(vec2 point, float scale, out float light, out vec2 warp) {
  light = 0.0;
  warp = vec2(0.0);
  float cell = STAR_CELL * scale;
  vec2 baseId = floor(point / cell);
  for (int row = -1; row <= 1; row++) {
    for (int column = -1; column <= 1; column++) {
      vec2 cellId = baseId + vec2(float(column), float(row));
      if (hash21(cellId + 17.0) < 0.48) continue;
      vec2 jitter = vec2(hash21(cellId + vec2(31.7, 11.3)), hash21(cellId + vec2(7.1, 53.9)));
      vec2 center = (cellId + 0.16 + jitter * 0.68) * cell;
      vec2 relative = point - center;
      float starDistance = length(relative);
      float radius = mix(1.7, 4.4, hash21(cellId + 91.7)) * scale;
      float phase = hash21(cellId + 127.3) * TAU;
      float speed = mix(0.5, 1.3, hash21(cellId + 203.5));
      float twinkle = 0.78 + 0.22 * sin(uTime * speed + phase);
      float core = 1.0 - smoothstep(radius * 0.5, radius + 1.1, starDistance);
      float halo = exp(-(starDistance * starDistance) / max(0.001, radius * radius * 5.0)) * 0.28;
      light = max(light, (core + halo) * twinkle);
      float width = radius * 2.4;
      float amount = pushProfile(starDistance, width) * width * 0.5 * twinkle;
      vec2 direction = starDistance > 0.0001 ? relative / starDistance : vec2(0.0);
      warp -= direction * amount;
    }
  }
}

void meteorContribution(
  vec2 point,
  vec4 origin,
  vec4 shape,
  float diagonal,
  float scale,
  inout vec2 warp,
  inout float light,
  inout float carve
) {
  float age = origin.z;
  float lifetime = origin.w;
  if (age < 0.0 || age > lifetime) return;

  float fadeStart = lifetime * 0.66;
  float envelope = smoothstep(0.0, 0.08, age) * (1.0 - smoothstep(fadeStart, lifetime, age));
  vec2 direction = rotateVector(normalize(uRadiantDirection), shape.x);
  float speed = diagonal * 0.78 * shape.y;
  float tailLength = diagonal * 0.4 * shape.z;
  float bulk = shape.w * scale;

  vec2 head = origin.xy * uCanvasSize + direction * speed * age;
  vec2 relative = point - head;
  float visibleTail = min(tailLength, speed * age);
  float behind = clamp(-dot(relative, direction), 0.0, visibleTail);
  vec2 closest = head - direction * behind;
  vec2 offset = point - closest;
  float axisDistance = length(offset);
  float progress = behind / max(1.0, tailLength);
  float taper = pow(1.0 - clamp(progress, 0.0, 1.0), 0.6);

  float channelWidth = (4.5 + 8.0 * taper) * bulk;
  float amount = pushProfile(axisDistance, channelWidth) * channelWidth * 0.34 * envelope * taper;
  vec2 pushDirection = axisDistance > 0.0001 ? offset / axisDistance : vec2(-direction.y, direction.x);
  warp -= pushDirection * amount;

  float drag = exp(-axisDistance / max(1.0, channelWidth * 1.1)) * envelope * taper * 5.5 * bulk;
  warp -= direction * drag;

  float coreWidth = (1.5 + 3.6 * taper) * bulk;
  carve = max(carve, exp(-(axisDistance * axisDistance) / (coreWidth * coreWidth * 4.0)) * envelope * taper);

  float streak = 1.0 - smoothstep(coreWidth * 0.35, coreWidth * 1.5, axisDistance);
  light = max(light, streak * envelope * (0.55 + 0.45 * taper));

  float headDistance = length(relative);
  float headRadius = 9.5 * bulk;
  light = max(light, (1.0 - smoothstep(headRadius * 0.2, headRadius, headDistance)) * envelope);

  float bow = pushProfile(headDistance, headRadius * 1.2) * headRadius * 0.4 * envelope;
  vec2 bowDirection = headDistance > 0.0001 ? relative / headDistance : direction;
  warp -= bowDirection * bow;
}

void main() {
  vec2 point = vUv * uCanvasSize;
  float diagonal = length(uCanvasSize);
  float scale = clamp(min(uCanvasSize.x, uCanvasSize.y) / 300.0, 0.55, 2.4);

  float starLight;
  vec2 warp;
  starfield(point, scale, starLight, warp);

  float meteorLight = 0.0;
  float carve = 0.0;
  for (int index = 0; index < MAX_METEORS; index++) {
    if (index >= uMeteorCount) break;
    meteorContribution(point, uMeteorOrigin[index], uMeteorShape[index], diagonal, scale, warp, meteorLight, carve);
  }

  vec2 uv = clamp(vUv + warp / uCanvasSize, 0.0, 1.0);
  float base = texture(uField, uv).r;
  float value = base * (1.0 - carve * 0.85);
  value = max(value, starLight * 0.85);
  value = clamp(value + meteorLight, 0.0, 1.0);
  outColor = vec4(vec3(value), 1.0);
}
`;
