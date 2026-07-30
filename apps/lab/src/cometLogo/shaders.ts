import { COMET_LOGO_FORMATION_DURATION_SEC } from "./animation";
import { COMET_LOGO_IDLE_RENDER_POINT_COUNT, COMET_LOGO_POINTS, COMET_LOGO_TRAIL_SEGMENT_COUNT } from "./points";

const logoPoints = COMET_LOGO_POINTS.map(([x, y]) => `vec2(${x.toFixed(5)}, ${y.toFixed(5)})`).join(",\n  ");

export const COMET_LOGO_VERTEX_SHADER = `#version 300 es
precision highp float;

uniform vec2 uResolution;
uniform float uFieldTime;
uniform float uFormation;
uniform float uRejoining;
uniform float uRejoinProgress;
uniform float uRejoinStartFieldTime;
uniform float uRejoinStartFormation;
uniform float uRejoinDuration;
uniform vec2 uFormationOrigin;
uniform float uFormationStartFieldTime;

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
const float LOGO_SCALE = 0.85;
const float FIELD_TRAIL_SAMPLE_TIME = 0.14;
const float LOGO_TRAIL_SAMPLE_TIME = 0.42;
const float VELOCITY_SAMPLE_TIME = 0.075;
const float LOGO_RADIUS_MIN_PX = 2.0;
const float LOGO_RADIUS_SCALE = 0.006;
const float FORMATION_DURATION = ${COMET_LOGO_FORMATION_DURATION_SEC.toFixed(1)};
const float FORMATION_STAGGER = 0.52;
const float FORMATION_STARTER_SHARE = 0.12;
const float TAU = 6.28318530718;
const int TRAIL_SEGMENT_COUNT = ${COMET_LOGO_TRAIL_SEGMENT_COUNT};
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

float formationEase(float t) {
  t = clamp(t, 0.0, 1.0);
  return t * t * (3.0 - 2.0 * t);
}

float historicalFormation(float time, float maximumFormation) {
  float elapsed = time - uFormationStartFieldTime;
  return min(
    maximumFormation,
    clamp(elapsed / max(FORMATION_DURATION, 0.001), 0.0, 1.0)
  );
}

vec2 quadraticBezier(vec2 start, vec2 control, vec2 target, float t) {
  float inverse = 1.0 - t;
  return inverse * inverse * start + 2.0 * inverse * t * control + t * t * target;
}

vec2 cubicHermite(vec2 start, vec2 startTangent, vec2 end, vec2 endTangent, float t) {
  float t2 = t * t;
  float t3 = t2 * t;
  return (2.0 * t3 - 3.0 * t2 + 1.0) * start
    + (t3 - 2.0 * t2 + t) * startTangent
    + (-2.0 * t3 + 3.0 * t2) * end
    + (t3 - t2) * endTangent;
}

void fieldPoint(
  float id,
  float time,
  out vec2 head,
  out float radiusPx,
  out vec2 velocity
) {
  float z = mod(hash11(id * 1.37) * DEPTH - time * SPEED, DEPTH) + 0.24;
  vec2 direction = vec2(hash11(id * 2.71), hash11(id * 4.93)) * 2.0 - 1.0;
  direction *= mix(0.58, 1.35, hash11(id * 8.11)) * SPREAD;
  head = direction / z;
  velocity = direction * SPEED / (z * z);
  float perspective = mix(0.28, 1.42, 1.0 - z / (DEPTH + 0.24));
  radiusPx = max(1.25, uResolution.y * 0.004 * perspective);
}

float localFormation(float id, float formation) {
  vec2 startHead;
  float startRadiusPx;
  vec2 startVelocity;
  fieldPoint(id, uFormationStartFieldTime, startHead, startRadiusPx, startVelocity);
  vec2 originWorld = (2.0 * uFormationOrigin - uResolution) / uResolution.y;
  float cursorOrder = smoothstep(0.04, 2.1, distance(startHead, originWorld));
  float starterAdjustedOrder = max(
    0.0,
    (cursorOrder - FORMATION_STARTER_SHARE) / (1.0 - FORMATION_STARTER_SHARE)
  );
  float order = clamp(
    starterAdjustedOrder * mix(0.94, 1.06, hash11(id * 19.31)),
    0.0,
    1.0
  );
  float delay = order * FORMATION_STAGGER;
  return clamp((formation - delay) / (1.0 - FORMATION_STAGGER), 0.0, 1.0);
}

vec2 logoContourTangent(int index) {
  int previousIndex = max(0, index - 1);
  int nextIndex = min(${COMET_LOGO_POINTS.length - 1}, index + 1);
  vec2 contour = LOGO_POINTS[nextIndex] - LOGO_POINTS[previousIndex];
  return contour / max(length(contour), 0.00001);
}

vec2 livingLogoOffset(int index, float id, float time) {
  vec2 tangent = logoContourTangent(index);
  vec2 normal = vec2(-tangent.y, tangent.x);
  float phase = time * mix(3.8, 6.0, hash11(id * 41.7))
    + float(index) * 0.38
    + hash11(id * 47.3) * TAU;
  float crawl = sin(phase) + 0.42 * sin(phase * 1.91 + id);
  float squirm = sin(phase * 0.73 + id * 0.17) + 0.36 * cos(phase * 1.37);
  return tangent * crawl * 0.015 + normal * squirm * 0.0095;
}

vec2 steeredHead(int index, float id, float time, float formation, out float radiusPx) {
  vec2 freeHead;
  vec2 freeVelocity;
  fieldPoint(id, time, freeHead, radiusPx, freeVelocity);
  vec2 target = LOGO_POINTS[index] * LOGO_SCALE;
  vec2 tangent = freeVelocity / max(length(freeVelocity), 0.00001);
  float controlDistance = min(0.72, 0.12 + distance(freeHead, target) * 0.34);
  vec2 control = freeHead + tangent * controlDistance;
  float local = localFormation(id, formation);
  vec2 steered = quadraticBezier(freeHead, control, target, formationEase(local));
  float livingBlend = smoothstep(0.08, 0.72, local);
  return steered + livingLogoOffset(index, id, time) * livingBlend;
}

vec2 rejoinHead(int index, float id, float progress, out float radiusPx) {
  float startFieldRadiusPx;
  vec2 start = steeredHead(
    index,
    id,
    uRejoinStartFieldTime,
    uRejoinStartFormation,
    startFieldRadiusPx
  );
  float logoRadiusPx = max(LOGO_RADIUS_MIN_PX, uResolution.y * LOGO_RADIUS_SCALE);
  float startRadiusPx = mix(
    startFieldRadiusPx,
    logoRadiusPx,
    formationEase(localFormation(id, uRejoinStartFormation))
  );
  float previousStartRadiusPx;
  float previousStartFormation = historicalFormation(
    uRejoinStartFieldTime - VELOCITY_SAMPLE_TIME,
    uRejoinStartFormation
  );
  vec2 previousStart = steeredHead(
    index,
    id,
    uRejoinStartFieldTime - VELOCITY_SAMPLE_TIME,
    previousStartFormation,
    previousStartRadiusPx
  );
  vec2 startVelocity = (start - previousStart) / VELOCITY_SAMPLE_TIME;

  float targetTime = uRejoinStartFieldTime + uRejoinDuration;
  vec2 target;
  float targetRadiusPx;
  vec2 targetVelocity;
  fieldPoint(id, targetTime, target, targetRadiusPx, targetVelocity);

  radiusPx = mix(startRadiusPx, targetRadiusPx, progress);
  return cubicHermite(
    start,
    startVelocity * uRejoinDuration,
    target,
    targetVelocity * uRejoinDuration,
    progress
  );
}

vec2 sampleRejoinPath(int index, float id, float age, out float radiusPx) {
  float sampleElapsed = uRejoinProgress * uRejoinDuration - age;
  if (sampleElapsed >= 0.0) {
    float progress = clamp(sampleElapsed / max(uRejoinDuration, 0.001), 0.0, 1.0);
    return rejoinHead(index, id, progress, radiusPx);
  }

  float formation = historicalFormation(
    uRejoinStartFieldTime + sampleElapsed,
    uRejoinStartFormation
  );
  return steeredHead(
    index,
    id,
    uRejoinStartFieldTime + sampleElapsed,
    formation,
    radiusPx
  );
}

vec2 sampleParticlePath(
  int index,
  float id,
  bool logoParticle,
  float age,
  out float radiusPx
) {
  if (!logoParticle) {
    vec2 head;
    vec2 velocity;
    fieldPoint(id, uFieldTime - age, head, radiusPx, velocity);
    return head;
  }
  if (uRejoining > 0.5) return sampleRejoinPath(index, id, age, radiusPx);
  float formation = historicalFormation(uFieldTime - age, uFormation);
  return steeredHead(index, id, uFieldTime - age, formation, radiusPx);
}

void main() {
  int index = gl_InstanceID;
  float id = float(index) + SEED * 17.173;
  bool logoParticle = index < ${COMET_LOGO_POINTS.length};
  float currentLocalFormation = logoParticle
    ? localFormation(id, uFormation)
    : 0.0;
  float logoTrailBlend = 0.0;
  if (logoParticle) {
    if (uRejoining > 0.5) {
      float rejoinStartLocal = localFormation(id, uRejoinStartFormation);
      logoTrailBlend = smoothstep(0.72, 1.0, rejoinStartLocal)
        * (1.0 - smoothstep(0.0, 0.35, uRejoinProgress));
    } else {
      logoTrailBlend = smoothstep(0.72, 1.0, currentLocalFormation);
    }
  }
  float trailTime = mix(
    FIELD_TRAIL_SAMPLE_TIME,
    LOGO_TRAIL_SAMPLE_TIME,
    logoTrailBlend
  );

  int segmentIndex = gl_VertexID / 6;
  int cornerIndex = gl_VertexID - segmentIndex * 6;
  float segmentStart = float(segmentIndex) / float(TRAIL_SEGMENT_COUNT);
  float segmentEnd = float(segmentIndex + 1) / float(TRAIL_SEGMENT_COUNT);
  float olderAge = trailTime * (1.0 - segmentStart);
  float newerAge = trailTime * (1.0 - segmentEnd);
  float olderRadiusPx;
  float newerRadiusPx;
  vec2 tail = sampleParticlePath(
    index,
    id,
    logoParticle,
    olderAge,
    olderRadiusPx
  );
  vec2 head = sampleParticlePath(
    index,
    id,
    logoParticle,
    newerAge,
    newerRadiusPx
  );
  vec2 segmentDelta = head - tail;
  float segmentWorldLength = length(segmentDelta);
  if (segmentWorldLength > 0.35) tail = head;

  float logoRadiusPx = max(LOGO_RADIUS_MIN_PX, uResolution.y * LOGO_RADIUS_SCALE);
  float radiusPx = !logoParticle || uRejoining > 0.5
    ? newerRadiusPx
    : mix(
      newerRadiusPx,
      logoRadiusPx,
      formationEase(currentLocalFormation)
    );
  float densityOpacity = 1.0;
  if (index >= ${COMET_LOGO_IDLE_RENDER_POINT_COUNT}) {
    densityOpacity = smoothstep(0.0, 0.18, uFormation);
    if (uRejoining > 0.5) {
      densityOpacity *= 1.0 - smoothstep(0.65, 1.0, uRejoinProgress);
    }
  }
  float opacity = (0.88 + 0.12 * sin(uFieldTime * 2.0 + id))
    * (logoParticle ? 1.0 : 0.72)
    * densityOpacity;

  vec2 headPx = head * (0.5 * uResolution.y) + 0.5 * uResolution;
  vec2 tailPx = tail * (0.5 * uResolution.y) + 0.5 * uResolution;
  vec2 deltaPx = headPx - tailPx;
  float segmentLengthPx = length(deltaPx);
  vec2 along = segmentLengthPx > 0.001 ? deltaPx / segmentLengthPx : vec2(1.0, 0.0);
  vec2 across = vec2(-along.y, along.x);
  float paddingPx = radiusPx * 4.0 + 1.0;
  vec2 corner = QUAD[cornerIndex];
  float localAlongPx = mix(-paddingPx, segmentLengthPx + paddingPx, corner.x);
  float localAcrossPx = corner.y * paddingPx;
  vec2 positionPx = tailPx + along * localAlongPx + across * localAcrossPx;
  vec2 clip = positionPx / uResolution * 2.0 - 1.0;

  gl_Position = vec4(clip, 0.0, 1.0);
  vLocalPx = vec2(localAlongPx, localAcrossPx);
  vLengthPx = segmentLengthPx;
  vRadiusPx = radiusPx;
  float segmentVisible = segmentLengthPx > 0.001 || segmentIndex == TRAIL_SEGMENT_COUNT - 1
    ? 1.0
    : 0.0;
  vOpacity = opacity * segmentVisible;
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
  float trailWidth = vRadiusPx * mix(0.22, 0.72, trailProgress);
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
