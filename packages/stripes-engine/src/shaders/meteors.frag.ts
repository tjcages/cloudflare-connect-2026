export function buildMeteorsFrag(maxActive: number): string {
  return `#version 300 es
precision highp float;

const int MAX_METEORS = ${maxActive};
const float PUSH_PEAK = 1.1658;

uniform sampler2D uField;
uniform vec2 uCssSize;
uniform vec2 uRadiant;
uniform vec4 uStyle;
uniform int uMeteorCount;
uniform vec4 uMeteorOrigin[MAX_METEORS];
uniform vec4 uMeteorShape[MAX_METEORS];

in vec2 vUv;
out vec4 outColor;

vec2 rotateVector(vec2 value, float angle) {
  float cosine = cos(angle);
  float sine = sin(angle);
  return vec2(cosine * value.x - sine * value.y, sine * value.x + cosine * value.y);
}

float pushProfile(float radius, float width) {
  float normalized = radius / max(width, 0.001);
  return normalized * exp(1.0 - normalized * normalized);
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
  float envelope = origin.w;
  if (envelope <= 0.0) return;

  vec2 direction = rotateVector(normalize(uRadiant), shape.x);
  float speed = diagonal * 0.807 * shape.y;
  float tailLength = diagonal * 0.38 * shape.z;
  float bulk = max(0.05, shape.w) * scale;

  vec2 head = origin.xy * uCssSize + direction * speed * age;
  vec2 relative = point - head;
  float visibleTail = min(tailLength, speed * age);
  float behind = clamp(-dot(relative, direction), 0.0, visibleTail);
  vec2 closest = head - direction * behind;
  vec2 offset = point - closest;
  float axisDistance = length(offset);
  float progress = behind / max(1.0, tailLength);
  float taper = pow(1.0 - clamp(progress, 0.0, 1.0), 0.6);

  float channelWidth = (5.5125 + 9.8 * taper) * bulk;
  float pushWidth = max(0.5, channelWidth * uStyle.w);
  float amount = (pushProfile(axisDistance, pushWidth) / PUSH_PEAK) * uStyle.z * envelope * taper;
  vec2 pushDirection = axisDistance > 0.0001 ? offset / axisDistance : vec2(-direction.y, direction.x);
  warp -= pushDirection * amount;

  float drag = exp(-axisDistance / max(1.0, pushWidth * 1.1)) * envelope * taper * uStyle.z * 1.12;
  warp -= direction * drag;

  float coreWidth = (1.8375 + 4.41 * taper) * bulk;
  carve = max(carve, exp(-(axisDistance * axisDistance) / (coreWidth * coreWidth * 4.0)) * envelope * taper);

  float streak = 1.0 - smoothstep(coreWidth * 0.35, coreWidth * 1.5, axisDistance);
  light = max(light, streak * envelope * (0.55 + 0.45 * taper) * uStyle.x);

  float headDistance = length(relative);
  float headRadius = 11.6375 * bulk;
  light = max(light, (1.0 - smoothstep(headRadius * 0.2, headRadius, headDistance)) * envelope * uStyle.y);

  float bow = (pushProfile(headDistance, max(0.5, headRadius * 1.2 * uStyle.w)) / PUSH_PEAK) * uStyle.z * 0.9 * envelope;
  vec2 bowDirection = headDistance > 0.0001 ? relative / headDistance : direction;
  warp -= bowDirection * bow;
}

void main() {
  vec2 point = vec2(vUv.x, 1.0 - vUv.y) * uCssSize;
  float diagonal = length(uCssSize);
  float scale = clamp(min(uCssSize.x, uCssSize.y) / 300.0, 0.55, 2.4);

  vec2 warp = vec2(0.0);
  float light = 0.0;
  float carve = 0.0;
  for (int index = 0; index < MAX_METEORS; index++) {
    if (index >= uMeteorCount) break;
    meteorContribution(point, uMeteorOrigin[index], uMeteorShape[index], diagonal, scale, warp, light, carve);
  }

  vec2 uv = clamp(vUv + vec2(warp.x, -warp.y) / uCssSize, 0.0, 1.0);
  float base = texture(uField, uv).r;
  float value = base * (1.0 - carve * 0.85);
  value = clamp(value + light, 0.0, 1.0);
  outColor = vec4(vec3(value), 1.0);
}
`;
}
