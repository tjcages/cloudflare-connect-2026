import {
  COMET_LOGO_CAPTURE_END,
  COMET_LOGO_CAPTURE_FALL_START,
  COMET_LOGO_CAPTURE_RISE_END,
  COMET_LOGO_CYCLE_DURATION_SEC,
  COMET_LOGO_EMERGENCE_END,
  COMET_LOGO_LAYER_COUNT,
  COMET_LOGO_RELEASE_START,
} from "./animation";
import { COMET_LOGO_CONTOUR_SPLIT_INDEX, COMET_LOGO_POINTS, COMET_LOGO_TRAIL_SEGMENT_COUNT } from "./points";

const logoPoints = COMET_LOGO_POINTS.map(([x, y]) => `vec2(${x.toFixed(5)}, ${y.toFixed(5)})`).join(",\n  ");
const logoParticleCount = COMET_LOGO_POINTS.length * COMET_LOGO_LAYER_COUNT;

export const COMET_LOGO_VERTEX_SHADER = `#version 300 es
precision highp float;

uniform vec2 uResolution;
uniform float uTime;

out vec2 vLocalPx;
flat out float vLengthPx;
flat out float vRadiusPx;
flat out float vOpacity;
flat out float vTrailProgressStart;
flat out float vIsHead;

const float DEPTH = 6.51;
const float SPEED = 1.62;
const float SPREAD = 2.18;
const float SEED = 57383.0;
const float CYCLE_DURATION = ${COMET_LOGO_CYCLE_DURATION_SEC.toFixed(1)};
const float EMERGENCE_END = ${COMET_LOGO_EMERGENCE_END.toFixed(2)};
const float RELEASE_START = ${COMET_LOGO_RELEASE_START.toFixed(2)};
const float CAPTURE_RISE_END = ${COMET_LOGO_CAPTURE_RISE_END.toFixed(3)};
const float CAPTURE_FALL_START = ${COMET_LOGO_CAPTURE_FALL_START.toFixed(3)};
const float CAPTURE_END = ${COMET_LOGO_CAPTURE_END.toFixed(2)};
const float FIELD_TRAIL_SAMPLE_TIME = 0.14;
const float LOGO_TRAIL_SAMPLE_TIME = 0.11;
const float RELEASE_TRAIL_SAMPLE_TIME = 0.34;
const float LOGO_ORBIT_POINTS_PER_SECOND = 7.5;
const float LOGO_SCALE_START = 0.08;
const float LOGO_SCALE_END = 1.52;
const float TAU = 6.28318530718;
const int LOGO_LAYER_COUNT = ${COMET_LOGO_LAYER_COUNT};
const int LOGO_POINT_COUNT = ${COMET_LOGO_POINTS.length};
const int LOGO_CONTOUR_SPLIT_INDEX = ${COMET_LOGO_CONTOUR_SPLIT_INDEX};
const int LOGO_PARTICLE_COUNT = ${logoParticleCount};
const int TRAIL_SEGMENT_COUNT = ${COMET_LOGO_TRAIL_SEGMENT_COUNT};
const vec2 FIELD_SPAWN_REGION = vec2(0.72, 0.42);
const vec2 LOGO_POINTS[${COMET_LOGO_POINTS.length}] = vec2[${COMET_LOGO_POINTS.length}](
  ${logoPoints}
);
const vec2 QUAD[6] = vec2[6](
  vec2(0.0, -1.0),
  vec2(1.0, -1.0),
  vec2(1.0, 1.0),
  vec2(0.0, -1.0),
  vec2(1.0, 1.0),
  vec2(0.0, 1.0)
);

float hash11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}

vec2 hashDirection(float id, float salt) {
  float angle = hash11(id * salt) * TAU;
  return vec2(cos(angle), sin(angle));
}

vec2 fieldSpawnOrigin(float id) {
  float radius = sqrt(hash11(id * 6.13));
  return hashDirection(id, 3.79) * FIELD_SPAWN_REGION * radius;
}

void fieldPoint(
  float id,
  float time,
  out vec2 head,
  out float radiusPx
) {
  float depth = mod(hash11(id * 1.37) * DEPTH - time * SPEED, DEPTH);
  float z = depth + 0.24;
  float lifecycle = 1.0 - depth / DEPTH;
  vec2 direction = vec2(hash11(id * 2.71), hash11(id * 4.93)) * 2.0 - 1.0;
  direction *= mix(0.58, 1.35, hash11(id * 8.11)) * SPREAD;
  vec2 spawnOrigin = fieldSpawnOrigin(id);
  vec2 escapeVector = spawnOrigin
    + direction * 0.22
    + hashDirection(id, 11.73) * vec2(0.12, 0.08);
  vec2 escapeDirection = escapeVector / max(length(escapeVector), 0.0001);
  float escape = smoothstep(0.015, 0.24, lifecycle);
  float escapeDistance = escape * mix(3.2, 4.2, hash11(id * 13.91));
  head = spawnOrigin + direction / z + escapeDirection * escapeDistance;
  float perspective = mix(0.28, 1.42, 1.0 - z / (DEPTH + 0.24));
  radiusPx = max(1.25, uResolution.y * 0.004 * perspective);
}

float logoLayerProgress(int layerIndex, float time) {
  return fract(time / CYCLE_DURATION + float(layerIndex) / float(LOGO_LAYER_COUNT));
}

float newestLogoProgress(float time) {
  float newestProgress = 1.0;
  for (int layerIndex = 0; layerIndex < LOGO_LAYER_COUNT; layerIndex++) {
    float progress = logoLayerProgress(layerIndex, time);
    if (progress < RELEASE_START) newestProgress = min(newestProgress, progress);
  }
  return newestProgress;
}

float logoCaptureInfluence(vec2 position, float progress) {
  float scale = mix(LOGO_SCALE_START, LOGO_SCALE_END, progress);
  vec2 halfSize = vec2(1.16, 0.54) * scale + vec2(0.055);
  vec2 normalizedPosition = abs(position) / halfSize;
  vec2 squaredPosition = normalizedPosition * normalizedPosition;
  float shapeDistance = dot(squaredPosition, squaredPosition);
  return 1.0 - smoothstep(0.72, 1.08, shapeDistance);
}

float logoCaptureEnvelope(float progress) {
  float rise = smoothstep(0.0, CAPTURE_RISE_END, progress);
  float fall = 1.0 - smoothstep(CAPTURE_FALL_START, CAPTURE_END, progress);
  return rise * fall;
}

float captureEnergyWeight(float capture) {
  return smoothstep(0.0, 0.18, capture);
}

void logoContourRange(int pointIndex, out int contourStart, out int contourCount) {
  contourStart = pointIndex < LOGO_CONTOUR_SPLIT_INDEX
    ? 0
    : LOGO_CONTOUR_SPLIT_INDEX;
  contourCount = pointIndex < LOGO_CONTOUR_SPLIT_INDEX
    ? LOGO_CONTOUR_SPLIT_INDEX
    : LOGO_POINT_COUNT - LOGO_CONTOUR_SPLIT_INDEX;
}

vec2 travelingLogoPoint(int pointIndex, float time, out int movingPointIndex) {
  int contourStart;
  int contourCount;
  logoContourRange(pointIndex, contourStart, contourCount);
  float contourProgress = mod(
    float(pointIndex - contourStart) + time * LOGO_ORBIT_POINTS_PER_SECOND,
    float(contourCount)
  );
  int contourOffset = int(floor(contourProgress));
  int nextContourOffset = contourOffset + 1;
  if (nextContourOffset >= contourCount) nextContourOffset = 0;
  movingPointIndex = contourStart + contourOffset;
  int nextPointIndex = contourStart + nextContourOffset;
  return mix(
    LOGO_POINTS[movingPointIndex],
    LOGO_POINTS[nextPointIndex],
    fract(contourProgress)
  );
}

vec2 logoContourTangent(int pointIndex) {
  int contourStart;
  int contourCount;
  logoContourRange(pointIndex, contourStart, contourCount);
  int contourEnd = contourStart + contourCount - 1;
  int previousIndex = pointIndex == contourStart ? contourEnd : pointIndex - 1;
  int nextIndex = pointIndex == contourEnd ? contourStart : pointIndex + 1;
  vec2 contour = LOGO_POINTS[nextIndex] - LOGO_POINTS[previousIndex];
  return contour / max(length(contour), 0.00001);
}

vec2 livingLogoOffset(int pointIndex, float id, float time, float scale) {
  vec2 tangent = logoContourTangent(pointIndex);
  vec2 normal = vec2(-tangent.y, tangent.x);
  float phase = time * mix(1.8, 2.6, hash11(id * 41.7))
    + float(pointIndex) * 0.38
    + hash11(id * 47.3) * TAU;
  float crawl = sin(phase) + 0.42 * sin(phase * 1.91 + id);
  float squirm = sin(phase * 0.73 + id * 0.17) + 0.36 * cos(phase * 1.37);
  float strength = mix(0.0008, 0.0045, min(1.0, scale));
  return tangent * crawl * strength + normal * squirm * strength * 0.64;
}

vec2 logoPoint(
  int pointIndex,
  int layerIndex,
  float id,
  float time,
  out float radiusPx,
  out float opacity
) {
  float progress = logoLayerProgress(layerIndex, time);
  float growth = progress;
  float scale = mix(LOGO_SCALE_START, LOGO_SCALE_END, growth);
  float releaseThreshold = RELEASE_START + hash11(id * 17.31) * 0.06;
  float release = smoothstep(releaseThreshold, 1.0, progress);
  float releaseAge = max(0.0, progress - releaseThreshold) * CYCLE_DURATION;
  float orbitTime = time - releaseAge;
  int movingPointIndex;
  vec2 contourPoint = travelingLogoPoint(pointIndex, orbitTime, movingPointIndex);
  vec2 radial = contourPoint / max(length(contourPoint), 0.00001);
  float releaseDistance = release * mix(2.8, 4.2, hash11(id * 23.17));
  vec2 releaseDirection = normalize(
    radial * mix(0.72, 1.0, hash11(id * 29.53))
      + hashDirection(id, 31.91) * mix(0.12, 0.44, hash11(id * 37.11))
  );
  float verticalBalance = smoothstep(-0.48, 0.08, contourPoint.y);
  vec2 position = contourPoint * scale
    + livingLogoOffset(movingPointIndex, id, time, scale) * (1.0 - release)
    + releaseDirection * releaseDistance;
  float newestProgress = newestLogoProgress(time);
  float capture = 0.0;
  if (progress > newestProgress + 0.0001) {
    float newestEmergence = smoothstep(0.0, EMERGENCE_END, newestProgress);
    capture = logoCaptureInfluence(position, newestProgress)
      * logoCaptureEnvelope(newestProgress)
      * (1.0 - release);
    int capturedPointIndex = (pointIndex + layerIndex * 29) % LOGO_POINT_COUNT;
    float capturedScale = mix(LOGO_SCALE_START, LOGO_SCALE_END, newestProgress);
    int capturedMovingPointIndex;
    vec2 capturedContourPoint = travelingLogoPoint(
      capturedPointIndex,
      time,
      capturedMovingPointIndex
    );
    vec2 capturedPosition = capturedContourPoint * capturedScale
      + livingLogoOffset(capturedMovingPointIndex, id, time, capturedScale);
    position = mix(position, capturedPosition, capture);
  }
  float emergence = smoothstep(0.0, EMERGENCE_END, progress);
  float lowerContourReveal = smoothstep(0.08, 0.26, growth);
  opacity = emergence
    * mix(0.56, 1.0, growth)
    * mix(lowerContourReveal * 0.82, 1.0, verticalBalance)
    * mix(1.0, 0.12, captureEnergyWeight(capture));
  radiusPx = max(1.1, uResolution.y * mix(0.0028, 0.0054, growth));
  radiusPx *= mix(0.84, 1.0, verticalBalance);
  radiusPx *= mix(0.84, 1.16, hash11(id * 43.11));
  opacity *= mix(0.78, 1.08, hash11(id * 47.93));
  return position;
}

vec2 sampleParticlePath(
  int pointIndex,
  int layerIndex,
  float id,
  bool logoParticle,
  float age,
  out float radiusPx,
  out float opacity
) {
  float sampleTime = uTime - age;
  if (logoParticle) {
    return logoPoint(pointIndex, layerIndex, id, sampleTime, radiusPx, opacity);
  }

  vec2 head;
  fieldPoint(id, sampleTime, head, radiusPx);
  float fieldOpacity = (0.62 + 0.18 * hash11(id * 53.17))
    * (0.88 + 0.12 * sin(uTime * 2.0 + id));
  float newestProgress = newestLogoProgress(sampleTime);
  float newestEmergence = smoothstep(0.0, EMERGENCE_END, newestProgress);
  float capture = logoCaptureInfluence(head, newestProgress)
    * logoCaptureEnvelope(newestProgress);
  int capturedPointIndex = (pointIndex * 53 + 17) % LOGO_POINT_COUNT;
  float capturedScale = mix(LOGO_SCALE_START, LOGO_SCALE_END, newestProgress);
  int capturedMovingPointIndex;
  vec2 capturedContourPoint = travelingLogoPoint(
    capturedPointIndex,
    sampleTime,
    capturedMovingPointIndex
  );
  vec2 capturedPosition = capturedContourPoint * capturedScale
    + livingLogoOffset(capturedMovingPointIndex, id, sampleTime, capturedScale);
  head = mix(head, capturedPosition, capture);
  float capturedRadiusPx = max(1.1, uResolution.y * mix(0.0028, 0.0054, newestProgress));
  radiusPx = mix(radiusPx, capturedRadiusPx, capture);
  opacity = mix(fieldOpacity, newestEmergence * 0.22, captureEnergyWeight(capture));
  return head;
}

void main() {
  int instanceIndex = gl_InstanceID;
  bool logoParticle = instanceIndex < LOGO_PARTICLE_COUNT;
  int pointIndex = instanceIndex % LOGO_POINT_COUNT;
  int layerIndex = logoParticle ? instanceIndex / LOGO_POINT_COUNT : 0;
  float id = float(instanceIndex) + SEED * 17.173;
  float trailTime = FIELD_TRAIL_SAMPLE_TIME;
  if (logoParticle) {
    float progress = logoLayerProgress(layerIndex, uTime);
    float releaseThreshold = RELEASE_START + hash11(id * 17.31) * 0.06;
    float release = smoothstep(releaseThreshold, 1.0, progress);
    trailTime = mix(LOGO_TRAIL_SAMPLE_TIME, RELEASE_TRAIL_SAMPLE_TIME, release);
  }

  int segmentIndex = gl_VertexID / 6;
  int cornerIndex = gl_VertexID - segmentIndex * 6;
  float segmentStart = float(segmentIndex) / float(TRAIL_SEGMENT_COUNT);
  float segmentEnd = float(segmentIndex + 1) / float(TRAIL_SEGMENT_COUNT);
  float olderAge = trailTime * (1.0 - segmentStart);
  float newerAge = trailTime * (1.0 - segmentEnd);
  float olderRadiusPx;
  float newerRadiusPx;
  float olderOpacity;
  float newerOpacity;
  vec2 tail = sampleParticlePath(
    pointIndex,
    layerIndex,
    id,
    logoParticle,
    olderAge,
    olderRadiusPx,
    olderOpacity
  );
  vec2 head = sampleParticlePath(
    pointIndex,
    layerIndex,
    id,
    logoParticle,
    newerAge,
    newerRadiusPx,
    newerOpacity
  );
  vec2 segmentDelta = head - tail;
  float segmentWorldLength = length(segmentDelta);
  float discontinuityThreshold = logoParticle ? 0.35 : 0.85;
  if (segmentWorldLength > discontinuityThreshold) tail = head;

  vec2 headPx = head * (0.5 * uResolution.y) + 0.5 * uResolution;
  vec2 tailPx = tail * (0.5 * uResolution.y) + 0.5 * uResolution;
  vec2 deltaPx = headPx - tailPx;
  float segmentLengthPx = length(deltaPx);
  vec2 along = segmentLengthPx > 0.001 ? deltaPx / segmentLengthPx : vec2(1.0, 0.0);
  vec2 across = vec2(-along.y, along.x);
  float paddingPx = newerRadiusPx * 4.0 + 1.0;
  vec2 corner = QUAD[cornerIndex];
  float localAlongPx = mix(-paddingPx, segmentLengthPx + paddingPx, corner.x);
  float localAcrossPx = corner.y * paddingPx;
  vec2 positionPx = tailPx + along * localAlongPx + across * localAcrossPx;
  vec2 clip = positionPx / uResolution * 2.0 - 1.0;

  gl_Position = vec4(clip, 0.0, 1.0);
  vLocalPx = vec2(localAlongPx, localAcrossPx);
  vLengthPx = segmentLengthPx;
  vRadiusPx = newerRadiusPx;
  float segmentVisible = segmentLengthPx > 0.001 || segmentIndex == TRAIL_SEGMENT_COUNT - 1
    ? 1.0
    : 0.0;
  vOpacity = newerOpacity * segmentVisible;
  vTrailProgressStart = segmentStart;
  vIsHead = segmentIndex == TRAIL_SEGMENT_COUNT - 1 ? 1.0 : 0.0;
}`;

export const COMET_LOGO_FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec2 vLocalPx;
flat in float vLengthPx;
flat in float vRadiusPx;
flat in float vOpacity;
flat in float vTrailProgressStart;
flat in float vIsHead;

out vec4 outColor;

void main() {
  float segmentX = clamp(vLocalPx.x, 0.0, vLengthPx);
  float segmentDistance = length(vec2(vLocalPx.x - segmentX, vLocalPx.y));
  float segmentProgress = vLengthPx > 0.001 ? clamp(vLocalPx.x / vLengthPx, 0.0, 1.0) : 1.0;
  float trailProgress = vTrailProgressStart
    + segmentProgress / float(${COMET_LOGO_TRAIL_SEGMENT_COUNT});
  float trailWidth = vRadiusPx * mix(0.2, 0.72, trailProgress);
  float trailCore = 1.0 - smoothstep(trailWidth, trailWidth + 1.0, segmentDistance);
  float trailHalo = 1.0 - smoothstep(trailWidth, trailWidth * 2.4 + 1.0, segmentDistance);

  float headDistance = length(vec2(vLocalPx.x - vLengthPx, vLocalPx.y));
  float headCore = 1.0 - smoothstep(vRadiusPx, vRadiusPx + 1.0, headDistance);
  float headHalo = 1.0 - smoothstep(vRadiusPx, vRadiusPx * 4.0 + 1.0, headDistance);
  float light = (headCore + headHalo * 0.36) * vIsHead
    + trailCore * 0.68
    + trailHalo * 0.12;

  if (light <= 0.001 || vOpacity <= 0.001) discard;
  outColor = vec4(vec3(light * vOpacity * 0.68), 1.0);
}`;
