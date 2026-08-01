import {
  COMET_LOGO_EVENT_GROUP_COUNT,
  COMET_LOGO_EVENT_SPARK_POINT_COUNT,
  COMET_LOGO_IDLE_BACKGROUND_POINT_COUNT,
  COMET_LOGO_NEEDLE_SPARK_POINT_COUNT,
  COMET_LOGO_POINTS,
  COMET_LOGO_RENDER_POINT_COUNT,
  COMET_LOGO_SPARK_ANCHOR_POINTS,
  COMET_LOGO_TRAIL_SEGMENT_COUNT,
} from "./points";

const logoPoints = COMET_LOGO_POINTS.map(([x, y]) => `vec2(${x.toFixed(5)}, ${y.toFixed(5)})`).join(",\n  ");
const sparkAnchorPoints = COMET_LOGO_SPARK_ANCHOR_POINTS.map(([x, y]) => `vec2(${x.toFixed(5)}, ${y.toFixed(5)})`).join(
  ",\n  ",
);

export const COMET_LOGO_VERTEX_SHADER = `#version 300 es
precision highp float;

uniform vec2 uResolution;
uniform float uFieldTime;
uniform float uFormation;
uniform float uRejoining;
uniform float uRejoinProgress;
uniform float uRejoinElapsed;
uniform float uRejoinStartFieldTime;
uniform float uRejoinStartFormation;
uniform float uRejoinDuration;
uniform vec2 uFormationOrigin;
uniform float uFormationStartFieldTime;
uniform float uFieldSpeed;
uniform float uFieldDepth;
uniform float uFieldSpread;
uniform float uCenterClearRadius;
uniform float uFieldTrailLength;
uniform float uFieldParticleSize;
uniform float uLogoScale;
uniform float uLogoParticleSize;
uniform float uLogoTrailLength;
uniform float uLogoMotion;
uniform float uFormationDuration;
uniform float uFormationStagger;
uniform float uCenterPreference;
uniform float uSparkFrequency;
uniform float uSparkSize;
uniform float uSparkTrailLength;
uniform float uBurstProbability;
uniform float uWaveProbability;
uniform float uFireScale;
uniform float uFireSpeed;
uniform float uWeatherSpeed;
uniform float uWeatherVariation;
uniform float uEruptionFrequency;
uniform float uEruptionScale;
uniform float uEruptionCycleSpeed;

out vec2 vLocalPx;
flat out float vLengthPx;
flat out float vRadiusPx;
flat out float vOpacity;
flat out float vTrailProgressStart;
flat out float vIsHead;
flat out float vIsSpark;
flat out float vSparkKind;
flat out float vSparkFlicker;
flat out float vIsSurfaceEffect;
flat out float vEffectProgress;
flat out vec2 vEffectOutward;
flat out float vEffectRadiusPx;
flat out float vEffectSeed;

const float SEED = 57383.0;
const float FIELD_TRAIL_SAMPLE_TIME = 0.14;
const float LOGO_TRAIL_SAMPLE_TIME = 0.42;
const float NEEDLE_TRAIL_SAMPLE_TIME = 0.16;
const float BURST_TRAIL_SAMPLE_TIME = 0.11;
const float WAVE_TRAIL_SAMPLE_TIME = 0.055;
const float LOGO_RADIUS_MIN_PX = 2.0;
const float LOGO_RADIUS_SCALE = 0.006;
const float SPARK_KIND_NEEDLE = 0.0;
const float SPARK_KIND_BURST = 1.0;
const float SPARK_KIND_WAVE = 2.0;
const float EVENT_SPARK_START = ${COMET_LOGO_NEEDLE_SPARK_POINT_COUNT.toFixed(1)};
const float EVENT_GROUP_SIZE = ${(COMET_LOGO_EVENT_SPARK_POINT_COUNT / COMET_LOGO_EVENT_GROUP_COUNT).toFixed(1)};
const float FORMATION_STARTER_SHARE = 0.12;
const float FIELD_SPAWN_TIME = 0.62;
const float FIELD_RETIRE_TIME = 0.34;
const float FIELD_SPAWN_RADIUS_SCALE = 0.24;
const int REJOIN_CANDIDATE_COUNT = 3;
const float REJOIN_CANDIDATES[REJOIN_CANDIDATE_COUNT] = float[REJOIN_CANDIDATE_COUNT](
  0.85, 1.0, 1.18
);
const float MAX_TRAIL_WORLD = 0.22;
const float TAU = 6.28318530718;
const int TRAIL_SEGMENT_COUNT = ${COMET_LOGO_TRAIL_SEGMENT_COUNT};
const vec2 LOGO_POINTS[${COMET_LOGO_POINTS.length}] = vec2[${COMET_LOGO_POINTS.length}](
  ${logoPoints}
);
const vec2 SPARK_ANCHOR_POINTS[${COMET_LOGO_SPARK_ANCHOR_POINTS.length}] = vec2[${COMET_LOGO_SPARK_ANCHOR_POINTS.length}](
  ${sparkAnchorPoints}
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

float temporalNoise(float seed, float time) {
  float cell = floor(time);
  float local = fract(time);
  float blend = local * local * (3.0 - 2.0 * local);
  return mix(
    hash11(seed + cell * 17.17),
    hash11(seed + (cell + 1.0) * 17.17),
    blend
  );
}

// Cubic ease with explicit endpoint slopes. The old t(2-t) was this with
// startSlope 2, which spent a comet's whole speed budget in the first ~15% of
// the trip: a yank, then a flat plateau, then decay. A gentler startSlope moves
// the speed peak to the middle and gives a natural bell instead. The departure
// tangent is scaled by 1/startSlope, so the departure speed still equals the
// field velocity exactly no matter which slope is chosen.
float travelEase(float t, float startSlope, float endSlope) {
  float progress = clamp(t, 0.0, 1.0);
  float squared = progress * progress;
  float cubed = squared * progress;
  return (3.0 * squared - 2.0 * cubed)
    + startSlope * (cubed - 2.0 * squared + progress)
    + endSlope * (cubed - squared);
}

float formationStartSlope(float id) {
  return mix(0.65, 0.95, hash11(id * 83.9));
}

float formationTravelEase(float t, float id) {
  return travelEase(t, formationStartSlope(id), 0.0);
}

float rejoinTravelEase(float t) {
  return travelEase(t, 0.0, 1.0);
}

float historicalFormation(float time, float maximumFormation) {
  float elapsed = time - uFormationStartFieldTime;
  return min(
    maximumFormation,
    clamp(elapsed / max(uFormationDuration, 0.001), 0.0, 1.0)
  );
}

// Lateral swing added to a steered path. The 16e²(1-e)² shape is zero in both
// value and slope at e=0 and e=1, so it bends the trajectory without disturbing
// the velocity match at either end. Sign varies per comet so they swing both ways.
vec2 trajectoryBow(float id, vec2 direction, float span, float ease) {
  vec2 normal = vec2(-direction.y, direction.x);
  float swing = hash11(id * 61.7) < 0.5 ? -1.0 : 1.0;
  float amount = swing * mix(0.18, 0.38, hash11(id * 71.3)) * span;
  float inverse = 1.0 - ease;
  // Triple root at both ends: zero value, slope AND curvature there. The
  // earlier 16e²(1-e)² was only a double root, so it handed the path a lateral
  // acceleration kick right where it rejoins the field — read as a kink even
  // though position and velocity matched exactly.
  return normal * amount * 64.0 * ease * ease * ease * inverse * inverse * inverse;
}

// Matches position, velocity AND acceleration at both ends. Velocity alone
// leaves a curvature discontinuity where the return path meets the field, which
// reads as a kink even though the comet never jumps or changes speed.
vec2 quinticHermite(
  vec2 start,
  vec2 startVelocity,
  vec2 startAcceleration,
  vec2 end,
  vec2 endVelocity,
  vec2 endAcceleration,
  float t
) {
  float t2 = t * t;
  float t3 = t2 * t;
  float t4 = t3 * t;
  float t5 = t4 * t;
  return (1.0 - 10.0 * t3 + 15.0 * t4 - 6.0 * t5) * start
    + (t - 6.0 * t3 + 8.0 * t4 - 3.0 * t5) * startVelocity
    + (0.5 * t2 - 1.5 * t3 + 1.5 * t4 - 0.5 * t5) * startAcceleration
    + (10.0 * t3 - 15.0 * t4 + 6.0 * t5) * end
    + (-4.0 * t3 + 7.0 * t4 - 3.0 * t5) * endVelocity
    + (0.5 * t3 - t4 + 0.5 * t5) * endAcceleration;
}

vec2 cubicHermite(vec2 start, vec2 startTangent, vec2 end, vec2 endTangent, float t) {
  float t2 = t * t;
  float t3 = t2 * t;
  return (2.0 * t3 - 3.0 * t2 + 1.0) * start
    + (t3 - 2.0 * t2 + t) * startTangent
    + (-2.0 * t3 + 3.0 * t2) * end
    + (t3 - t2) * endTangent;
}

vec2 fieldDirection(float id) {
  vec2 direction = vec2(hash11(id * 2.71), hash11(id * 4.93)) * 2.0 - 1.0;
  direction *= mix(0.58, 1.35, hash11(id * 8.11)) * uFieldSpread;
  float magnitude = length(direction);
  return direction / max(magnitude, 0.00001) * max(magnitude, 0.46 * uFieldSpread);
}

float centerClearWorld() {
  return uCenterClearRadius / max(0.5 * uResolution.y, 1.0);
}

void fieldCycleBounds(float id, float time, out float age, out float remaining) {
  float speed = max(uFieldSpeed, 0.0001);
  float phase = hash11(id * 1.37) * uFieldDepth;
  float cycle = floor((phase - time * speed) / uFieldDepth);
  age = time - (phase - (cycle + 1.0) * uFieldDepth) / speed;
  remaining = (phase - cycle * uFieldDepth) / speed - time;
}

float fieldSpawnGrowth(float id, float time) {
  float age;
  float remaining;
  fieldCycleBounds(id, time, age, remaining);
  return smoothstep(0.0, FIELD_SPAWN_TIME, age);
}

float fieldLife(float id, float time) {
  float age;
  float remaining;
  fieldCycleBounds(id, time, age, remaining);
  return smoothstep(0.0, FIELD_SPAWN_TIME, age)
    * smoothstep(0.0, FIELD_RETIRE_TIME, remaining);
}

void fieldPoint(
  float id,
  float time,
  out vec2 head,
  out float radiusPx,
  out vec2 velocity
) {
  float z = mod(hash11(id * 1.37) * uFieldDepth - time * uFieldSpeed, uFieldDepth) + 0.24;
  vec2 direction = fieldDirection(id);
  float magnitude = length(direction);
  vec2 outward = direction / max(magnitude, 0.00001);
  float travelled = magnitude / z - magnitude / (uFieldDepth + 0.24);
  head = outward * (centerClearWorld() + travelled);
  velocity = direction * uFieldSpeed / (z * z);
  float perspective = mix(0.28, 1.42, 1.0 - z / (uFieldDepth + 0.24));
  radiusPx = max(1.25, uResolution.y * 0.004 * perspective)
    * uFieldParticleSize
    * mix(FIELD_SPAWN_RADIUS_SCALE, 1.0, fieldSpawnGrowth(id, time));
}

// d²/dt² of the field path: z falls linearly, and head goes as 1/z, so this is
// 2·direction·speed²/z³. Cheap and exact, which is what lets the return path
// arrive with the field's curvature and not just its velocity.
vec2 fieldAcceleration(float id, float time) {
  float z = mod(hash11(id * 1.37) * uFieldDepth - time * uFieldSpeed, uFieldDepth) + 0.24;
  return fieldDirection(id) * (2.0 * uFieldSpeed * uFieldSpeed / (z * z * z));
}

float fieldCycleIndex(float id, float time) {
  return floor((hash11(id * 1.37) * uFieldDepth - time * uFieldSpeed) / uFieldDepth);
}

float formationOrder(float id) {
  vec2 startHead;
  float startRadiusPx;
  vec2 startVelocity;
  fieldPoint(id, uFormationStartFieldTime, startHead, startRadiusPx, startVelocity);
  vec2 originWorld = (2.0 * uFormationOrigin - uResolution) / uResolution.y;
  float centerOrder = smoothstep(0.04, 1.62, length(startHead));
  float pointerOrder = smoothstep(0.04, 2.1, distance(startHead, originWorld));
  float preferredOrder = mix(pointerOrder, centerOrder, uCenterPreference);
  float starterAdjustedOrder = max(
    0.0,
    (preferredOrder - FORMATION_STARTER_SHARE) / (1.0 - FORMATION_STARTER_SHARE)
  );
  return clamp(
    starterAdjustedOrder * mix(0.92, 1.08, hash11(id * 19.31)),
    0.0,
    1.0
  );
}

float localFormation(float id, float formation) {
  float delay = formationOrder(id) * uFormationStagger;
  return clamp((formation - delay) / (1.0 - uFormationStagger), 0.0, 1.0);
}

float formationDepartTime(float id) {
  return uFormationStartFieldTime
    + formationOrder(id) * uFormationStagger * uFormationDuration;
}

float formationTravelTime() {
  return max(uFormationDuration * (1.0 - uFormationStagger), 0.001);
}

vec2 logoContourTangent(int index) {
  int previousIndex = max(0, index - 1);
  int nextIndex = min(${COMET_LOGO_POINTS.length - 1}, index + 1);
  vec2 contour = LOGO_POINTS[nextIndex] - LOGO_POINTS[previousIndex];
  return contour / max(length(contour), 0.00001);
}

float sparkGroupSeed(float sparkId) {
  if (sparkId < EVENT_SPARK_START) return sparkId + 1.0;
  return floor((sparkId - EVENT_SPARK_START) / EVENT_GROUP_SIZE) + 61.0;
}

float sparkCycleDuration(float sparkId, float groupSeed) {
  if (sparkId < EVENT_SPARK_START) {
    return mix(1.0, 1.8, hash11(groupSeed * 3.17)) / uSparkFrequency;
  }
  return mix(1.3, 2.2, hash11(groupSeed * 3.17)) / uSparkFrequency;
}

float sparkCycleValue(float sparkId, float time) {
  float groupSeed = sparkGroupSeed(sparkId);
  float duration = sparkCycleDuration(sparkId, groupSeed);
  return time / duration + hash11(groupSeed * 5.83);
}

float sparkCyclePhase(float sparkId, float time) {
  return fract(sparkCycleValue(sparkId, time));
}

float sparkCycleRandom(float sparkId, float time, float salt) {
  float groupSeed = sparkGroupSeed(sparkId);
  float cycleIndex = floor(sparkCycleValue(sparkId, time));
  return hash11(groupSeed * 1.91 + cycleIndex * 7.13 + salt);
}

float sparkKind(float sparkId, float time) {
  if (sparkId < EVENT_SPARK_START) return SPARK_KIND_NEEDLE;
  float choice = sparkCycleRandom(sparkId, time, 11.7);
  float eventProbability = min(1.0, uBurstProbability + uWaveProbability);
  float needleProbability = 1.0 - eventProbability;
  float normalizedBurstProbability = eventProbability
    * uBurstProbability
    / max(uBurstProbability + uWaveProbability, 0.0001);
  if (choice < needleProbability) return SPARK_KIND_NEEDLE;
  if (choice < needleProbability + normalizedBurstProbability) return SPARK_KIND_BURST;
  return SPARK_KIND_WAVE;
}

float sparkActiveShare(float kind) {
  if (kind < 0.5) return 0.4;
  if (kind < 1.5) return 0.36;
  return 0.44;
}

float sparkEventVisibility(float sparkId, float time) {
  float threshold = sparkId < EVENT_SPARK_START ? 0.22 : 0.02;
  return step(threshold, sparkCycleRandom(sparkId, time, 23.4));
}

float sparkSizeScale(float sparkId, float time) {
  float randomSize = sparkCycleRandom(sparkId, time, 37.2);
  return mix(0.68, 1.42, pow(randomSize, 1.25)) * uSparkSize;
}

int sparkAnchorIndex(float sparkId, float time) {
  float groupSeed = sparkGroupSeed(sparkId);
  float cycleIndex = floor(sparkCycleValue(sparkId, time));
  float anchor = mod(groupSeed * 29.0 + cycleIndex * 17.0, float(${COMET_LOGO_SPARK_ANCHOR_POINTS.length}));
  return int(floor(anchor));
}

vec2 sparkHead(float sparkId, float time, out float radiusPx) {
  float kind = sparkKind(sparkId, time);
  float groupSeed = sparkGroupSeed(sparkId);
  float sizeScale = sparkSizeScale(sparkId, time);
  int anchorIndex = sparkAnchorIndex(sparkId, time);
  vec2 origin = SPARK_ANCHOR_POINTS[anchorIndex] * uLogoScale;
  vec2 outward = origin / max(length(origin), 0.00001);
  vec2 tangent = vec2(-outward.y, outward.x);
  float progress = clamp(sparkCyclePhase(sparkId, time) / sparkActiveShare(kind), 0.0, 1.0);
  float travelEase = 1.0 - (1.0 - progress) * (1.0 - progress);

  if (kind < 0.5) {
    float spread = mix(-0.34, 0.34, hash11(sparkId * 7.19 + 1.0));
    vec2 direction = normalize(outward + tangent * spread);
    float travelRandom = mix(
      hash11(sparkId * 11.57 + 2.0),
      sparkCycleRandom(sparkId, time, 41.9),
      0.58
    );
    float travel = mix(0.09, 0.32, travelRandom) * travelEase * mix(0.82, 1.12, sizeScale);
    float arc = sin(progress * 3.14159265) * mix(-0.018, 0.018, hash11(sparkId * 13.23 + 3.0));
    float gravity = mix(0.008, 0.032, hash11(sparkId * 17.41 + 4.0)) * progress * progress;
    radiusPx = max(0.82, uResolution.y * 0.0019 * mix(0.72, 1.12, hash11(sparkId * 19.13 + 5.0)))
      * sizeScale;
    return origin + direction * travel + tangent * arc + vec2(0.0, -gravity);
  }

  if (kind < 1.5) {
    float member = mod(sparkId - EVENT_SPARK_START, EVENT_GROUP_SIZE);
    float memberProgress = member / (EVENT_GROUP_SIZE - 1.0);
    float spread = mix(-0.78, 0.78, memberProgress)
      + mix(-0.08, 0.08, hash11(sparkId * 7.31 + 6.0));
    vec2 direction = normalize(outward + tangent * spread);
    float travel = mix(0.08, 0.27, sparkCycleRandom(sparkId, time, 43.6))
      * travelEase
      * mix(0.86, 1.14, sizeScale);
    float gravity = mix(0.012, 0.04, hash11(sparkId * 13.91 + 7.0)) * progress * progress;
    origin += tangent * mix(-0.007, 0.007, hash11(sparkId * 17.17 + 8.0));
    radiusPx = max(0.88, uResolution.y * 0.002 * mix(0.76, 1.12, hash11(sparkId * 19.61 + 9.0)))
      * sizeScale;
    return origin + direction * travel + vec2(0.0, -gravity);
  }

  float member = mod(sparkId - EVENT_SPARK_START, EVENT_GROUP_SIZE);
  float centeredMember = member / (EVENT_GROUP_SIZE - 1.0) * 2.0 - 1.0;
  origin += tangent * centeredMember * 0.055 * mix(0.82, 1.18, sizeScale);
  vec2 direction = normalize(outward + tangent * centeredMember * 0.18);
  float travel = 0.03
    + mix(0.15, 0.24, sparkCycleRandom(sparkId, time, 47.3))
      * travelEase
      * mix(0.86, 1.12, sizeScale);
  float bow = (1.0 - centeredMember * centeredMember)
    * sin(progress * 3.14159265)
    * 0.018;
  radiusPx = max(0.82, uResolution.y * 0.00185 * mix(0.84, 1.08, hash11(groupSeed * 13.37)))
    * sizeScale;
  return origin + direction * travel + outward * bow;
}

float sparkOpacity(float sparkId, float time) {
  float kind = sparkKind(sparkId, time);
  float progress = sparkCyclePhase(sparkId, time) / sparkActiveShare(kind);
  float fadeInEnd = kind < 0.5 ? 0.08 : kind < 1.5 ? 0.14 : 0.12;
  float fadeOutStart = kind < 0.5 ? 0.62 : kind < 1.5 ? 0.48 : 0.55;
  float life = smoothstep(0.0, fadeInEnd, progress)
    * (1.0 - smoothstep(fadeOutStart, 1.0, progress))
    * sparkEventVisibility(sparkId, time);
  float formationVisibility = smoothstep(0.62, 0.92, uFormation);
  if (uRejoining > 0.5) {
    formationVisibility *= 1.0 - smoothstep(0.0, 0.28, uRejoinProgress);
  }
  return life * formationVisibility;
}

vec2 livingLogoOffset(int index, float id, float time) {
  vec2 tangent = logoContourTangent(index);
  vec2 normal = vec2(-tangent.y, tangent.x);
  float phase = time * mix(3.8, 6.0, hash11(id * 41.7))
    + float(index) * 0.38
    + hash11(id * 47.3) * TAU;
  float crawl = sin(phase) + 0.42 * sin(phase * 1.91 + id);
  float squirm = sin(phase * 0.73 + id * 0.17) + 0.36 * cos(phase * 1.37);
  return (tangent * crawl * 0.015 + normal * squirm * 0.0095) * uLogoMotion;
}

vec2 steeredHead(int index, float id, float time, float formation, out float radiusPx) {
  vec2 freeHead;
  vec2 freeVelocity;
  fieldPoint(id, time, freeHead, radiusPx, freeVelocity);
  float local = localFormation(id, formation);
  if (local <= 0.0) return freeHead;

  vec2 departHead;
  vec2 departVelocity;
  float departRadiusPx;
  fieldPoint(id, formationDepartTime(id), departHead, departRadiusPx, departVelocity);
  radiusPx = departRadiusPx;

  vec2 target = LOGO_POINTS[index] * uLogoScale;
  vec2 toTarget = target - departHead;
  float span = max(length(toTarget), 0.00001);
  float travel = formationTravelTime();

  float departSpeed = length(departVelocity);
  vec2 launchDirection = departVelocity / max(departSpeed, 0.00001);
  vec2 startTangent = launchDirection
    * min(departSpeed * travel / formationStartSlope(id), span * 0.62);

  vec2 approach = toTarget / span;
  vec2 approachNormal = vec2(-approach.y, approach.x);
  vec2 endTangent = normalize(
    approach + approachNormal * mix(-0.62, 0.62, hash11(id * 27.53))
  ) * span * 0.58;

  float ease = formationTravelEase(local, id);
  vec2 curved = cubicHermite(departHead, startTangent, target, endTangent, ease)
    + trajectoryBow(id, approach, span, ease);
  float livingBlend = smoothstep(0.08, 0.72, local);
  return curved + livingLogoOffset(index, id, time) * livingBlend;
}

// Each comet picks the return trip whose travel speed most closely matches the
// field speed it will have on arrival, so it never has to brake to a halt.
float rejoinDurationFor(float id, vec2 start) {
  float bestDuration = uRejoinDuration;
  float bestCost = 1000000.0;
  for (int candidate = 0; candidate < REJOIN_CANDIDATE_COUNT; candidate++) {
    float duration = max(REJOIN_CANDIDATES[candidate] * uRejoinDuration, 0.05);
    vec2 head;
    float headRadiusPx;
    vec2 velocity;
    fieldPoint(id, uRejoinStartFieldTime + duration, head, headRadiusPx, velocity);
    float travelSpeed = distance(head, start) / duration;
    float arrivalSpeed = length(velocity);
    float cost = abs(log(max(travelSpeed, 0.000001) / max(arrivalSpeed, 0.000001)));
    if (cost < bestCost) {
      bestCost = cost;
      bestDuration = duration;
    }
  }
  return bestDuration;
}

vec2 rejoinHead(int index, float id, float elapsed, out float radiusPx, out bool freeField) {
  float startFieldRadiusPx;
  vec2 start = steeredHead(
    index,
    id,
    uRejoinStartFieldTime,
    uRejoinStartFormation,
    startFieldRadiusPx
  );
  float rejoinDuration = rejoinDurationFor(id, start);
  if (elapsed >= rejoinDuration) {
    vec2 head;
    vec2 velocity;
    fieldPoint(id, uRejoinStartFieldTime + elapsed, head, radiusPx, velocity);
    freeField = true;
    return head;
  }
  freeField = false;
  float progress = clamp(elapsed / rejoinDuration, 0.0, 1.0);
  float logoRadiusPx = max(LOGO_RADIUS_MIN_PX, uResolution.y * LOGO_RADIUS_SCALE) * uLogoParticleSize;
  float startRadiusPx = mix(
    startFieldRadiusPx,
    logoRadiusPx,
    formationTravelEase(localFormation(id, uRejoinStartFormation), id)
  );

  vec2 target;
  float targetRadiusPx;
  vec2 targetVelocity;
  fieldPoint(id, uRejoinStartFieldTime + rejoinDuration, target, targetRadiusPx, targetVelocity);

  vec2 toTarget = target - start;
  float span = max(length(toTarget), 0.00001);

  vec2 anchor = LOGO_POINTS[index] * uLogoScale;
  vec2 outward = anchor / max(length(anchor), 0.00001);
  vec2 sideways = vec2(-outward.y, outward.x);
  vec2 launchDirection = normalize(
    outward + sideways * mix(-0.92, 0.92, hash11(id * 33.17))
  );
  vec2 startTangent = launchDirection * span * mix(0.48, 0.86, hash11(id * 51.71));

  vec2 endTangent = targetVelocity * rejoinDuration;

  // rejoinTravelEase has e'(1)=1 and e''(1)=-2, so matching the field's
  // acceleration through the chain rule needs a1 = aField*T² + 2*velocity*T.
  vec2 endAcceleration =
    fieldAcceleration(id, uRejoinStartFieldTime + rejoinDuration) * rejoinDuration * rejoinDuration
    + targetVelocity * (2.0 * rejoinDuration);
  // Field acceleration goes as 1/z³, so a comet returning to a near-plane slot
  // would otherwise get an end curvature large enough to whip the path around.
  float endAccelerationLimit = span * 8.0;
  float endAccelerationLength = length(endAcceleration);
  if (endAccelerationLength > endAccelerationLimit) {
    endAcceleration *= endAccelerationLimit / max(endAccelerationLength, 0.00001);
  }

  radiusPx = mix(startRadiusPx, targetRadiusPx, progress);
  float ease = rejoinTravelEase(progress);
  return quinticHermite(start, startTangent, vec2(0.0), target, endTangent, endAcceleration, ease)
    + trajectoryBow(id, toTarget / span, span, ease);
}

vec2 sampleRejoinPath(int index, float id, float age, out float radiusPx, out bool freeField) {
  float sampleElapsed = uRejoinElapsed - age;
  if (sampleElapsed >= 0.0) {
    return rejoinHead(index, id, sampleElapsed, radiusPx, freeField);
  }

  float formation = historicalFormation(
    uRejoinStartFieldTime + sampleElapsed,
    uRejoinStartFormation
  );
  freeField = localFormation(id, formation) <= 0.0;
  return steeredHead(
    index,
    id,
    uRejoinStartFieldTime + sampleElapsed,
    formation,
    radiusPx
  );
}

// freeField reports whether this sample sits on the live starfield path, so the
// trail-cut guard can tell a real depth recycle from steered or frozen motion.
vec2 sampleParticlePath(
  int index,
  float id,
  float sparkId,
  bool logoParticle,
  bool sparkParticle,
  float age,
  out float radiusPx,
  out bool freeField
) {
  freeField = false;
  if (sparkParticle) return sparkHead(sparkId, uFieldTime - age, radiusPx);
  if (!logoParticle) {
    vec2 head;
    vec2 velocity;
    fieldPoint(id, uFieldTime - age, head, radiusPx, velocity);
    freeField = true;
    return head;
  }
  if (uRejoining > 0.5) return sampleRejoinPath(index, id, age, radiusPx, freeField);
  float formation = historicalFormation(uFieldTime - age, uFormation);
  freeField = localFormation(id, formation) <= 0.0;
  return steeredHead(index, id, uFieldTime - age, formation, radiusPx);
}

void main() {
  int index = gl_InstanceID;
  bool logoParticle = index < ${COMET_LOGO_POINTS.length};
  bool sparkParticle = index >= ${COMET_LOGO_RENDER_POINT_COUNT};
  float id = float(index) + SEED * 17.173;
  float sourceParticleOpacity = logoParticle ? 1.0 : sparkParticle ? 1.0 : 0.72;
  bool pairedLogoCandidate = index < ${COMET_LOGO_IDLE_BACKGROUND_POINT_COUNT}
    || (
      index >= ${COMET_LOGO_POINTS.length}
      && index < ${COMET_LOGO_POINTS.length + COMET_LOGO_IDLE_BACKGROUND_POINT_COUNT}
    );
  if (pairedLogoCandidate) {
    int pairIndex = logoParticle
      ? index
      : index - ${COMET_LOGO_POINTS.length};
    float logoSourceId = float(pairIndex) + SEED * 17.173;
    float backgroundSourceId = float(pairIndex + ${COMET_LOGO_POINTS.length}) + SEED * 17.173;
    vec2 logoSourceHead;
    float logoSourceRadiusPx;
    vec2 logoSourceVelocity;
    fieldPoint(
      logoSourceId,
      uFormationStartFieldTime,
      logoSourceHead,
      logoSourceRadiusPx,
      logoSourceVelocity
    );
    vec2 backgroundSourceHead;
    float backgroundSourceRadiusPx;
    vec2 backgroundSourceVelocity;
    fieldPoint(
      backgroundSourceId,
      uFormationStartFieldTime,
      backgroundSourceHead,
      backgroundSourceRadiusPx,
      backgroundSourceVelocity
    );
    float logoSourceScore = length(logoSourceHead)
      + mix(-0.12, 0.12, hash11(logoSourceId * 13.71));
    float backgroundSourceScore = length(backgroundSourceHead)
      + mix(-0.12, 0.12, hash11(backgroundSourceId * 13.71));
    bool preferBackgroundSource = backgroundSourceScore < logoSourceScore;
    if (logoParticle) {
      id = preferBackgroundSource ? backgroundSourceId : logoSourceId;
      sourceParticleOpacity = preferBackgroundSource ? 0.72 : 1.0;
    } else {
      id = preferBackgroundSource ? logoSourceId : backgroundSourceId;
      sourceParticleOpacity = preferBackgroundSource ? 1.0 : 0.72;
    }
  }
  float sparkId = float(max(index - ${COMET_LOGO_RENDER_POINT_COUNT}, 0));
  float currentSparkKind = sparkKind(sparkId, uFieldTime);
  float currentLocalFormation = logoParticle
    ? localFormation(id, uFormation)
    : 0.0;
  float logoTrailBlend = 0.0;
  if (logoParticle) {
    if (uRejoining > 0.5) {
      float rejoinStartLocal = localFormation(id, uRejoinStartFormation);
      logoTrailBlend = smoothstep(0.72, 1.0, rejoinStartLocal)
        * (1.0 - smoothstep(0.0, 0.14, uRejoinProgress));
    } else {
      logoTrailBlend = smoothstep(0.72, 1.0, currentLocalFormation);
    }
  }
  float trailTime = mix(
    FIELD_TRAIL_SAMPLE_TIME * uFieldTrailLength,
    LOGO_TRAIL_SAMPLE_TIME * uLogoTrailLength,
    logoTrailBlend
  );
  if (sparkParticle) {
    trailTime = (currentSparkKind < 0.5
      ? NEEDLE_TRAIL_SAMPLE_TIME
      : currentSparkKind < 1.5
        ? BURST_TRAIL_SAMPLE_TIME
        : WAVE_TRAIL_SAMPLE_TIME) * uSparkTrailLength;
  } else {
    // Cap the trail by how fast this comet is actually travelling along its own
    // path — the field velocity alone misses steered formation/release motion,
    // which is where the runaway streaks came from.
    float probeRadiusNow;
    float probeRadiusThen;
    bool probeFreeNow;
    bool probeFreeThen;
    vec2 probeNow = sampleParticlePath(
      index, id, sparkId, logoParticle, sparkParticle, 0.0, probeRadiusNow, probeFreeNow
    );
    vec2 probeThen = sampleParticlePath(
      index, id, sparkId, logoParticle, sparkParticle, trailTime, probeRadiusThen, probeFreeThen
    );
    bool probeRecycled = probeFreeNow
      && probeFreeThen
      && fieldCycleIndex(id, uFieldTime) != fieldCycleIndex(id, uFieldTime - trailTime);
    float drawnTrailWorld = distance(probeNow, probeThen);
    float maxTrailWorld = MAX_TRAIL_WORLD * uFieldTrailLength;
    if (!probeRecycled && drawnTrailWorld > maxTrailWorld) {
      trailTime *= maxTrailWorld / drawnTrailWorld;
    }
  }

  int segmentIndex = gl_VertexID / 6;
  int cornerIndex = gl_VertexID - segmentIndex * 6;
  float segmentStart = float(segmentIndex) / float(TRAIL_SEGMENT_COUNT);
  float segmentEnd = float(segmentIndex + 1) / float(TRAIL_SEGMENT_COUNT);
  float olderAge = trailTime * (1.0 - segmentStart);
  float newerAge = trailTime * (1.0 - segmentEnd);
  float olderRadiusPx;
  float newerRadiusPx;
  bool tailOnFreeField;
  bool headOnFreeField;
  vec2 tail = sampleParticlePath(
    index,
    id,
    sparkId,
    logoParticle,
    sparkParticle,
    olderAge,
    olderRadiusPx,
    tailOnFreeField
  );
  vec2 head = sampleParticlePath(
    index,
    id,
    sparkId,
    logoParticle,
    sparkParticle,
    newerAge,
    newerRadiusPx,
    headOnFreeField
  );
  float tailSampleTime = uFieldTime - olderAge;
  float headSampleTime = uFieldTime - newerAge;
  bool fieldRecycled = tailOnFreeField
    && headOnFreeField
    && fieldCycleIndex(id, tailSampleTime) != fieldCycleIndex(id, headSampleTime);
  if (fieldRecycled) tail = head;
  if (
    sparkParticle
    && sparkCyclePhase(sparkId, uFieldTime - olderAge) > sparkCyclePhase(sparkId, uFieldTime - newerAge)
  ) {
    tail = head;
  }

  float logoRadiusPx = max(LOGO_RADIUS_MIN_PX, uResolution.y * LOGO_RADIUS_SCALE) * uLogoParticleSize;
  float radiusPx = !logoParticle || uRejoining > 0.5
    ? newerRadiusPx
    : mix(
      newerRadiusPx,
      logoRadiusPx,
      formationTravelEase(currentLocalFormation, id)
    );
  float densityOpacity = 1.0;
  float particleOpacity = logoParticle ? 1.0 : sparkParticle ? 1.0 : 0.72;
  if (!sparkParticle) {
    float roleOpacityBlend = smoothstep(0.0, 0.18, uFormation);
    if (uRejoining > 0.5) {
      roleOpacityBlend *= 1.0 - smoothstep(0.55, 0.95, uRejoinProgress);
    }
    particleOpacity = mix(
      sourceParticleOpacity,
      particleOpacity,
      roleOpacityBlend
    );
  }
  float lifeFade = 1.0;
  if (!sparkParticle) {
    if (logoParticle && uRejoining > 0.5) {
      lifeFade = mix(
        1.0,
        fieldLife(id, uFieldTime),
        smoothstep(0.55, 1.0, uRejoinProgress)
      );
    } else if (logoParticle && currentLocalFormation > 0.0) {
      lifeFade = mix(
        fieldLife(id, formationDepartTime(id)),
        1.0,
        smoothstep(0.0, 0.32, currentLocalFormation)
      );
    } else {
      lifeFade = fieldLife(id, uFieldTime);
    }
  }
  float shimmerId = sparkParticle ? sparkId : id;
  float opacity = (0.88 + 0.12 * sin(uFieldTime * 2.0 + shimmerId))
    * particleOpacity
    * densityOpacity
    * lifeFade;
  if (sparkParticle) opacity *= sparkOpacity(sparkId, uFieldTime - newerAge);
  float flicker = pow(0.5 + 0.5 * sin(uFieldTime * 23.0 + sparkId * 1.73), 4.0);
  float sparkFlicker = sparkParticle ? 0.92 + flicker * 0.24 : 1.0;
  float eventMember = mod(max(sparkId - EVENT_SPARK_START, 0.0), EVENT_GROUP_SIZE);
  bool surfaceEffect = sparkParticle
    && sparkId >= EVENT_SPARK_START
    && currentSparkKind > 0.5
    && eventMember < 0.5;
  bool outerSolarContourPoint = (
    index <= 20
    || (index >= 36 && index <= 46)
    || index >= 79
  )
    && index % 2 == 0;
  bool centerSolarContourPoint = (
    (index >= 21 && index <= 35)
    || (index >= 47 && index <= 78)
  )
    && index % 3 == 0;
  bool solarContourPoint = logoParticle
    && (
      outerSolarContourPoint
      || centerSolarContourPoint
    );
  bool solarSurface = solarContourPoint
    && segmentIndex == 0
    && currentLocalFormation > 0.16
    && (uRejoining < 0.5 || uRejoinProgress < 0.34);

  if (solarSurface) {
    float solarCenterRadiusPx;
    bool solarCenterOnFreeField;
    vec2 solarCenter = sampleParticlePath(
      index,
      id,
      sparkId,
      logoParticle,
      sparkParticle,
      0.0,
      solarCenterRadiusPx,
      solarCenterOnFreeField
    );
    vec2 solarTarget = LOGO_POINTS[index] * uLogoScale;
    vec2 solarOutward = solarTarget / max(length(solarTarget), 0.00001);
    float solarSeed = hash11(id * 11.73 + 4.9);
    float solarStartProgress = formationOrder(id) * uFormationStagger
      + 0.16 * (1.0 - uFormationStagger);
    float solarStartTime = uFormationStartFieldTime
      + solarStartProgress * uFormationDuration;
    float solarAge = max(0.0, uFieldTime - solarStartTime);
    float eruptionDuration = mix(4.8, 8.6, hash11(id * 23.17 + 6.3)) / uEruptionCycleSpeed;
    float eruptionDelay = mix(0.45, 3.6, solarSeed);
    float eruptionCycle = max(0.0, solarAge - eruptionDelay) / eruptionDuration;
    float eruptionIndex = floor(eruptionCycle);
    float eruptionPhase = fract(eruptionCycle);
    float eruptionChance = step(
      1.0 - uEruptionFrequency,
      hash11(id * 31.71 + eruptionIndex * 17.13)
    );
    float eruptionEnvelope = smoothstep(0.0, 0.16, eruptionPhase)
      * (1.0 - smoothstep(0.42, 0.96, eruptionPhase))
      * eruptionChance
      * smoothstep(0.82, 1.0, currentLocalFormation);
    float eruptionVariant = hash11(id * 43.11 + eruptionIndex * 29.7);
    float weatherTime = solarAge
      * uWeatherSpeed
      / mix(3.8, 7.2, hash11(id * 37.13 + 9.7))
      + solarSeed * 3.0;
    float weatherScale = temporalNoise(id * 29.41 + 3.6, weatherTime);
    float solarGrowth = smoothstep(0.16, 0.88, currentLocalFormation);
    float solarGrowthScale = mix(0.08, 1.0, solarGrowth);
    float solarRadiusPx = uResolution.y
      * 0.108
      * uFireScale
      * solarGrowthScale
      * mix(1.0 - 0.26 * uWeatherVariation, 1.0 + 0.26 * uWeatherVariation, weatherScale);
    float solarPaddingPx = solarRadiusPx
      * mix(1.45, 2.75 * uEruptionScale, eruptionEnvelope)
      + 4.0;
    vec2 corner = QUAD[cornerIndex];
    vec2 localPx = vec2(corner.x * 2.0 - 1.0, corner.y) * solarPaddingPx;
    vec2 solarCenterPx = solarCenter * (0.5 * uResolution.y) + 0.5 * uResolution;
    vec2 positionPx = solarCenterPx + localPx;
    vec2 clip = positionPx / uResolution * 2.0 - 1.0;
    float solarVisibility = smoothstep(0.16, 0.78, currentLocalFormation);
    if (uRejoining > 0.5) {
      solarVisibility *= 1.0 - smoothstep(0.0, 0.32, uRejoinProgress);
    }

    gl_Position = vec4(clip, 0.0, 1.0);
    vLocalPx = localPx;
    vLengthPx = 0.0;
    vRadiusPx = 0.0;
    vOpacity = opacity * solarVisibility;
    vTrailProgressStart = eruptionVariant;
    vIsHead = 0.0;
    vIsSpark = 0.0;
    vSparkKind = eruptionPhase;
    vSparkFlicker = eruptionEnvelope;
    vIsSurfaceEffect = 2.0;
    vEffectProgress = solarAge * uFireSpeed * mix(0.38, 0.66, solarSeed)
      + solarSeed;
    vEffectOutward = solarOutward;
    vEffectRadiusPx = solarRadiusPx;
    vEffectSeed = solarSeed;
    return;
  }

  if (surfaceEffect) {
    int effectAnchorIndex = sparkAnchorIndex(sparkId, uFieldTime);
    vec2 effectCenter = SPARK_ANCHOR_POINTS[effectAnchorIndex] * uLogoScale;
    vec2 effectOutward = effectCenter / max(length(effectCenter), 0.00001);
    float effectProgress = clamp(
      sparkCyclePhase(sparkId, uFieldTime) / sparkActiveShare(currentSparkKind),
      0.0,
      1.0
    );
    float effectSize = sparkSizeScale(sparkId, uFieldTime);
    float effectRadiusPx = uResolution.y
      * (currentSparkKind < 1.5 ? 0.055 : 0.11)
      * effectSize;
    float effectPaddingPx = effectRadiusPx + 4.0;
    vec2 corner = QUAD[cornerIndex];
    vec2 localPx = vec2(corner.x * 2.0 - 1.0, corner.y) * effectPaddingPx;
    vec2 effectCenterPx = effectCenter * (0.5 * uResolution.y) + 0.5 * uResolution;
    vec2 positionPx = effectCenterPx + localPx;
    vec2 clip = positionPx / uResolution * 2.0 - 1.0;

    gl_Position = vec4(clip, 0.0, 1.0);
    vLocalPx = localPx;
    vLengthPx = 0.0;
    vRadiusPx = 0.0;
    vOpacity = opacity * (segmentIndex == TRAIL_SEGMENT_COUNT - 1 ? 1.0 : 0.0);
    vTrailProgressStart = 0.0;
    vIsHead = 0.0;
    vIsSpark = 1.0;
    vSparkKind = currentSparkKind;
    vSparkFlicker = sparkFlicker;
    vIsSurfaceEffect = 1.0;
    vEffectProgress = effectProgress;
    vEffectOutward = effectOutward;
    vEffectRadiusPx = effectRadiusPx;
    vEffectSeed = sparkCycleRandom(sparkId, uFieldTime, 59.1);
    return;
  }

  vec2 headPx = head * (0.5 * uResolution.y) + 0.5 * uResolution;
  vec2 tailPx = tail * (0.5 * uResolution.y) + 0.5 * uResolution;
  vec2 deltaPx = headPx - tailPx;
  float segmentLengthPx = length(deltaPx);
  vec2 along = segmentLengthPx > 0.001 ? deltaPx / segmentLengthPx : vec2(1.0, 0.0);
  vec2 across = vec2(-along.y, along.x);
  float paddingPx = radiusPx * (sparkParticle ? 4.5 : 4.0) + 1.0;
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
  vIsSpark = sparkParticle ? 1.0 : 0.0;
  vSparkKind = currentSparkKind;
  vSparkFlicker = sparkFlicker;
  vIsSurfaceEffect = 0.0;
  vEffectProgress = 0.0;
  vEffectOutward = vec2(0.0, 1.0);
  vEffectRadiusPx = 0.0;
  vEffectSeed = 0.0;
}`;

export const COMET_LOGO_FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec2 vLocalPx;
flat in float vLengthPx;
flat in float vRadiusPx;
flat in float vOpacity;
flat in float vTrailProgressStart;
flat in float vIsHead;
flat in float vIsSpark;
flat in float vSparkKind;
flat in float vSparkFlicker;
flat in float vIsSurfaceEffect;
flat in float vEffectProgress;
flat in vec2 vEffectOutward;
flat in float vEffectRadiusPx;
flat in float vEffectSeed;

uniform float uSparkBrightness;
uniform float uSurfaceEffects;
uniform float uFireIntensity;
uniform float uFireTurbulence;
uniform float uFlameHeight;
uniform float uCoronaMist;
uniform float uCurlingWisps;
uniform float uHotRim;
uniform float uEruptionScale;
uniform float uEruptionIntensity;
uniform float uEruptionParticles;

out vec4 outColor;

float fragmentHash(float value) {
  return fract(sin(value * 127.1) * 43758.5453);
}

float fragmentNoise(vec2 point) {
  vec2 cell = floor(point);
  vec2 local = fract(point);
  vec2 blend = local * local * (3.0 - 2.0 * local);
  float lowerLeft = fragmentHash(dot(cell, vec2(127.1, 311.7)));
  float lowerRight = fragmentHash(dot(cell + vec2(1.0, 0.0), vec2(127.1, 311.7)));
  float upperLeft = fragmentHash(dot(cell + vec2(0.0, 1.0), vec2(127.1, 311.7)));
  float upperRight = fragmentHash(dot(cell + vec2(1.0, 1.0), vec2(127.1, 311.7)));
  return mix(
    mix(lowerLeft, lowerRight, blend.x),
    mix(upperLeft, upperRight, blend.x),
    blend.y
  );
}

void main() {
  if (vIsSurfaceEffect > 0.5) {
    if (vOpacity <= 0.001) discard;
    float effectDistance = length(vLocalPx);
    vec2 effectDirection = vLocalPx / max(effectDistance, 0.001);

    if (vIsSurfaceEffect > 1.5) {
      vec2 fireTangent = vec2(-vEffectOutward.y, vEffectOutward.x);
      float fireRadius = max(vEffectRadiusPx, 1.0);
      float outwardDistance = dot(vLocalPx, vEffectOutward) / fireRadius;
      float sidewaysDistance = dot(vLocalPx, fireTangent) / fireRadius;
      float phase = vEffectProgress * 6.2831853 + vEffectSeed * 19.0;
      float eruption = vSparkFlicker;
      float flowNoise = fragmentNoise(
        vec2(
          sidewaysDistance * 3.4 + vEffectSeed * 11.0,
          outwardDistance * 2.2 - phase * 0.42
        )
      );
      float detailNoise = fragmentNoise(
        vec2(
          sidewaysDistance * 7.7 - phase * 0.31 + vEffectSeed * 23.0,
          outwardDistance * 5.4 - phase * 0.92
        )
      );
      float turbulence = flowNoise * 0.64 + detailNoise * 0.36;
      float turbulentSidewaysDistance = sidewaysDistance
        + (turbulence - 0.5)
          * 0.22
          * uFireTurbulence
          * smoothstep(-0.08, 0.9, outwardDistance);
      float slowGust = (
        sin(phase * 0.37 + vEffectSeed * 11.0)
        + 0.52 * sin(phase * 0.19 - vEffectSeed * 17.0)
      ) / 1.52;
      float flameHeight = 0.88
        + 0.22 * sin(phase)
        + 0.11 * sin(phase * 1.73 + vEffectSeed * 7.0)
        + slowGust * 0.09
        + eruption * mix(0.28, 0.58, vSparkKind);
      flameHeight *= uFlameHeight;
      float outwardProgress = clamp(
        (outwardDistance + 0.08) / max(flameHeight + 0.08, 0.001),
        0.0,
        1.0
      );
      float sway = (
        sin(phase * 1.31 + outwardProgress * 5.2) * 0.18
        + sin(phase * 0.73 - outwardProgress * 8.1 + vEffectSeed * 13.0) * 0.08
        + slowGust * outwardProgress * 0.11
      ) * outwardProgress * outwardProgress;
      float flameWidth = mix(0.48, 0.025, smoothstep(0.0, 1.0, outwardProgress));
      float mainFlame = 1.0 - smoothstep(
        flameWidth,
        flameWidth + 0.14,
        abs(turbulentSidewaysDistance - sway)
      );
      float mainVertical = smoothstep(-0.2, -0.015, outwardDistance)
        * (1.0 - smoothstep(flameHeight * 0.58, flameHeight, outwardDistance));
      float mainBreakup = mix(0.22, 1.0, smoothstep(0.16, 0.86, turbulence));
      mainFlame *= mainVertical * mainBreakup;

      float secondaryOffset = mix(-0.36, 0.36, fract(vEffectSeed * 17.23))
        + sin(phase * 0.31 + vEffectSeed * 13.0) * 0.14;
      float secondaryHeight = 0.5
        + 0.2 * (0.5 + 0.5 * sin(phase * 1.47 + vEffectSeed * 31.0));
      secondaryHeight *= uFlameHeight;
      float secondaryProgress = clamp(
        (outwardDistance + 0.04) / max(secondaryHeight + 0.04, 0.001),
        0.0,
        1.0
      );
      float secondarySway = secondaryOffset
        + sin(phase * 1.83 - secondaryProgress * 5.7) * 0.07 * secondaryProgress;
      float secondaryWidth = mix(0.2, 0.018, secondaryProgress);
      float secondaryFlame = 1.0 - smoothstep(
        secondaryWidth,
        secondaryWidth + 0.1,
        abs(turbulentSidewaysDistance - secondarySway)
      );
      secondaryFlame *= smoothstep(-0.15, 0.0, outwardDistance)
        * (1.0 - smoothstep(secondaryHeight * 0.54, secondaryHeight, outwardDistance));

      float tertiaryOffset = -secondaryOffset * 0.68
        + sin(phase * 0.23 - vEffectSeed * 19.0) * 0.09;
      float tertiaryHeight = 0.28
        + 0.22 * (0.5 + 0.5 * sin(phase * 2.13 - vEffectSeed * 27.0));
      tertiaryHeight *= uFlameHeight;
      float tertiaryProgress = clamp(
        outwardDistance / max(tertiaryHeight, 0.001),
        0.0,
        1.0
      );
      float tertiarySway = tertiaryOffset
        + sin(phase * 2.37 + tertiaryProgress * 4.9) * 0.06 * tertiaryProgress;
      float tertiaryWidth = mix(0.16, 0.014, tertiaryProgress);
      float tertiaryFlame = 1.0 - smoothstep(
        tertiaryWidth,
        tertiaryWidth + 0.09,
        abs(turbulentSidewaysDistance - tertiarySway)
      );
      tertiaryFlame *= smoothstep(-0.12, 0.02, outwardDistance)
        * (1.0 - smoothstep(tertiaryHeight * 0.5, tertiaryHeight, outwardDistance));

      float eruptionPhase = vSparkKind;
      float eruptionVariant = vTrailProgressStart;
      float plumeHeight = mix(1.45, 2.18, eruptionVariant) * uEruptionScale;
      float plumeReach = plumeHeight * smoothstep(0.02, 0.34, eruptionPhase);
      float plumeProgress = clamp(
        (outwardDistance + 0.02) / max(plumeReach, 0.001),
        0.0,
        1.0
      );
      float plumeLean = mix(-0.34, 0.34, eruptionVariant);
      float plumeSway = plumeLean * plumeProgress
        + (
          sin(phase * 1.37 + plumeProgress * 7.1 + vEffectSeed * 33.0) * 0.15
          + sin(phase * 2.11 - plumeProgress * 4.7 + eruptionVariant * 19.0) * 0.07
        ) * plumeProgress * plumeProgress;
      float outerPlumeWidth = mix(
        0.38,
        0.045,
        smoothstep(0.0, 1.0, plumeProgress)
      );
      float corePlumeWidth = outerPlumeWidth * mix(0.32, 0.2, plumeProgress);
      float outerPlume = 1.0 - smoothstep(
        outerPlumeWidth,
        outerPlumeWidth + 0.15,
        abs(turbulentSidewaysDistance - plumeSway)
      );
      float corePlume = 1.0 - smoothstep(
        corePlumeWidth,
        corePlumeWidth + 0.075,
        abs(turbulentSidewaysDistance - plumeSway)
      );
      float plumeBreakup = mix(
        0.12,
        1.0,
        smoothstep(
          0.14,
          0.9,
          0.5
            + 0.5
              * sin(
                sidewaysDistance * 19.0
                + plumeProgress * 13.0
                - phase * 4.2
                + vEffectSeed * 47.0
              )
        )
      );
      float plumeVertical = smoothstep(-0.12, 0.03, outwardDistance)
        * (1.0 - smoothstep(plumeReach * 0.68, plumeReach, outwardDistance));
      outerPlume *= plumeVertical * plumeBreakup * eruption;
      corePlume *= plumeVertical * mix(0.62, 1.0, plumeBreakup) * eruption;

      float branchStart = mix(0.28, 0.46, eruptionVariant);
      float branchProgress = clamp(
        (plumeProgress - branchStart) / max(1.0 - branchStart, 0.001),
        0.0,
        1.0
      );
      float branchDirection = mix(-1.0, 1.0, step(0.5, eruptionVariant));
      float branchCenter = plumeSway
        + branchDirection * branchProgress * mix(0.26, 0.48, eruptionVariant);
      float branchWidth = mix(0.2, 0.025, branchProgress);
      float plumeBranch = 1.0 - smoothstep(
        branchWidth,
        branchWidth + 0.1,
        abs(turbulentSidewaysDistance - branchCenter)
      );
      plumeBranch *= smoothstep(0.0, 0.18, branchProgress)
        * (1.0 - smoothstep(0.76, 1.0, branchProgress))
        * plumeBreakup
        * eruption;

      float tipProgress = 0.76;
      float tipCenter = plumeLean * tipProgress
        + (
          sin(phase * 1.37 + tipProgress * 7.1 + vEffectSeed * 33.0) * 0.15
          + sin(phase * 2.11 - tipProgress * 4.7 + eruptionVariant * 19.0) * 0.07
        ) * tipProgress * tipProgress;
      vec2 plumeTip = vec2(
        sidewaysDistance - tipCenter,
        outwardDistance - plumeReach * tipProgress
      );
      float tipAngle = atan(plumeTip.y, plumeTip.x);
      float crownLobes = 0.82
        + 0.18 * sin(tipAngle * 5.0 + phase * 2.7 + eruptionVariant * 23.0);
      float crownRadius = mix(0.12, 0.22, eruptionVariant) * crownLobes;
      float eruptionCrown = (
        1.0 - smoothstep(crownRadius * 0.55, crownRadius, length(plumeTip))
      )
        * smoothstep(0.16, 0.34, eruptionPhase)
        * (1.0 - smoothstep(0.68, 0.95, eruptionPhase))
        * step(0.001, eruption);

      float eruptionParticles = 0.0;
      float eruptionActive = step(0.001, eruption);
      vec2 firePoint = vec2(sidewaysDistance, outwardDistance);
      for (int emberIndex = 0; emberIndex < 7; emberIndex++) {
        float emberId = float(emberIndex);
        float emberSeed = fragmentHash(
          vEffectSeed * 73.1
          + eruptionVariant * 41.7
          + emberId * 19.37
        );
        float emberStart = mix(
          0.16,
          0.42,
          fragmentHash(emberSeed * 13.9 + emberId)
        );
        float emberDuration = mix(
          0.38,
          0.62,
          fragmentHash(emberSeed * 29.1 + 2.7)
        );
        float emberAge = (eruptionPhase - emberStart) / emberDuration;
        float emberLife = smoothstep(0.0, 0.08, emberAge)
          * (1.0 - smoothstep(0.45, 1.0, emberAge))
          * step(0.0, emberAge)
          * eruptionActive;
        float emberSideVelocity = mix(
          -0.82,
          0.82,
          fragmentHash(emberSeed * 31.7 + 4.1)
        );
        float emberUpVelocity = mix(
          1.0,
          1.72,
          fragmentHash(emberSeed * 47.3 + 8.6)
        );
        float emberGravity = mix(
          0.42,
          0.78,
          fragmentHash(emberSeed * 61.9 + 3.2)
        );
        float safeEmberAge = max(emberAge, 0.0);
        float dragTravel = (
          1.0 - exp(-2.2 * safeEmberAge)
        ) / (1.0 - exp(-2.2));
        vec2 emberPosition = vec2(
          plumeLean * 0.18
            + emberSideVelocity * dragTravel
            + sin(safeEmberAge * 5.0 + emberSeed * 17.0) * 0.035,
          0.34
            + emberUpVelocity * dragTravel
            - emberGravity * safeEmberAge * safeEmberAge
        );
        vec2 emberVelocity = vec2(
          emberSideVelocity * exp(-1.4 * safeEmberAge),
          emberUpVelocity * exp(-1.2 * safeEmberAge)
            - 2.0 * emberGravity * safeEmberAge
        );
        vec2 emberDirection = emberVelocity / max(length(emberVelocity), 0.001);
        float emberTailLength = mix(
          0.08,
          0.24,
          fragmentHash(emberSeed * 79.1 + 6.4)
        );
        vec2 emberTail = emberPosition - emberDirection * emberTailLength;
        vec2 emberSegment = emberPosition - emberTail;
        vec2 emberOffset = firePoint - emberTail;
        float emberAlong = clamp(
          dot(emberOffset, emberSegment) / max(dot(emberSegment, emberSegment), 0.0001),
          0.0,
          1.0
        );
        float emberDistance = length(
          emberOffset - emberSegment * emberAlong
        );
        float emberRadius = mix(
          0.022,
          0.045,
          fragmentHash(emberSeed * 97.3 + 5.8)
        );
        float emberLight = 1.0 - smoothstep(
          emberRadius,
          emberRadius + 0.035,
          emberDistance
        );
        eruptionParticles += emberLight
          * emberLife
          * mix(0.58, 1.0, emberAlong);
      }

      float rollingHeat = mix(
        turbulence,
        0.5
          + 0.5
            * sin(
              sidewaysDistance * 9.0
              - outwardDistance * 7.0
              + phase * 3.4
              + vEffectSeed * 29.0
            ),
        0.34
      );
      float baseCorona = (1.0 - smoothstep(0.16, 0.62, abs(sidewaysDistance)))
        * (1.0 - smoothstep(0.12, 0.4, abs(outwardDistance - 0.02)));
      float surfaceHeat = (
        1.0
          - smoothstep(
            0.18,
            0.68,
            length(vec2(sidewaysDistance, outwardDistance * 1.25))
          )
      ) * mix(0.38, 1.0, rollingHeat);
      float coronaEnvelope = smoothstep(-0.2, 0.02, outwardDistance)
        * (1.0 - smoothstep(0.42, 1.22, outwardDistance))
        * (1.0 - smoothstep(0.38, 1.02, abs(sidewaysDistance)));
      float coronaMist = coronaEnvelope
        * mix(0.14, 1.0, smoothstep(0.22, 0.82, turbulence));
      vec2 curlCenter = vec2(
        sin(phase * 0.29 + vEffectSeed * 31.0) * 0.28,
        0.48 + sin(phase * 0.17 - vEffectSeed * 13.0) * 0.18
      );
      float curlRadius = 0.2
        + 0.08 * (0.5 + 0.5 * sin(phase * 0.21 + vEffectSeed * 17.0));
      vec2 curlLocal = vec2(
        turbulentSidewaysDistance - curlCenter.x,
        (outwardDistance - curlCenter.y) * 0.82
      );
      float curlDistance = abs(length(curlLocal) - curlRadius);
      float curlActivation = smoothstep(
        0.42,
        0.82,
        0.5 + 0.5 * sin(phase * 0.13 + vEffectSeed * 41.0)
      );
      float curlingWisp = (
        1.0 - smoothstep(0.025, 0.11, curlDistance)
      )
        * curlActivation
        * mix(0.24, 1.0, detailNoise)
        * smoothstep(-0.08, 0.12, outwardDistance);
      float hotRim = (
        1.0 - smoothstep(0.055, 0.24, abs(outwardDistance + 0.01))
      )
        * (1.0 - smoothstep(0.42, 0.94, abs(sidewaysDistance)))
        * mix(0.5, 1.0, turbulence);
      float fireFlicker = 0.76
        + 0.24 * (0.5 + 0.5 * sin(phase * 3.67 + vEffectSeed * 37.0));
      float normalFire = (
        mainFlame * 0.21
        + secondaryFlame * 0.13
        + tertiaryFlame * 0.1
        + baseCorona * 0.07
        + surfaceHeat * 0.06
        + coronaMist * 0.045 * uCoronaMist
        + curlingWisp * 0.085 * uCurlingWisps
        + hotRim * 0.055 * uHotRim
      ) * uFireIntensity;
      float eruptionFire = (
        outerPlume * 0.2
        + corePlume * 0.32
        + plumeBranch * 0.17
        + eruptionCrown * 0.18
      ) * uEruptionIntensity;
      float fireLight = (
        normalFire
        + eruptionFire
        + eruptionParticles * 0.42 * uEruptionParticles
      ) * fireFlicker * vOpacity;

      if (fireLight <= 0.001) discard;
      outColor = vec4(vec3(fireLight), 1.0);
      return;
    }

    float effectEase = 1.0 - (1.0 - vEffectProgress) * (1.0 - vEffectProgress);
    float effectLight;

    if (vSparkKind < 1.5) {
      float rotation = vEffectSeed * 6.2831853 + vEffectProgress * 0.34;
      vec2 primaryAxis = vec2(cos(rotation), sin(rotation));
      vec2 secondaryAxis = vec2(-primaryAxis.y, primaryAxis.x);
      float primaryAlong = abs(dot(vLocalPx, primaryAxis));
      float primaryAcross = abs(dot(vLocalPx, secondaryAxis));
      float secondaryAlong = abs(dot(vLocalPx, secondaryAxis));
      float secondaryAcross = abs(dot(vLocalPx, primaryAxis));
      float primarySpike = (1.0 - smoothstep(0.8, vEffectRadiusPx * 0.042 + 1.2, primaryAcross))
        * (1.0 - smoothstep(vEffectRadiusPx * 0.1, vEffectRadiusPx * 0.68, primaryAlong));
      float secondarySpike = (1.0 - smoothstep(0.8, vEffectRadiusPx * 0.06 + 1.4, secondaryAcross))
        * (1.0 - smoothstep(vEffectRadiusPx * 0.08, vEffectRadiusPx * 0.46, secondaryAlong));
      float core = 1.0 - smoothstep(
        vEffectRadiusPx * 0.035,
        vEffectRadiusPx * mix(0.2, 0.1, vEffectProgress) + 1.0,
        effectDistance
      );
      float bloom = 1.0 - smoothstep(
        vEffectRadiusPx * 0.05,
        vEffectRadiusPx * mix(0.36, 0.54, effectEase),
        effectDistance
      );
      float angle = atan(vLocalPx.y, vLocalPx.x);
      float unevenness = mix(
        0.62,
        1.0,
        0.5 + 0.5 * sin(angle * 7.0 + effectDistance * 0.13 + vEffectSeed * 19.0)
      );
      float normalizedDistance = effectDistance / max(vEffectRadiusPx, 1.0);
      float coronaPattern = 0.5
        + 0.5 * sin(angle * 13.0 + vEffectSeed * 37.0 + vEffectProgress * 4.2);
      coronaPattern *= 0.68
        + 0.32 * sin(angle * 21.0 - vEffectSeed * 17.0 - vEffectProgress * 2.8);
      float coronaRays = pow(max(coronaPattern, 0.0), 7.0)
        * smoothstep(0.06, 0.14, normalizedDistance)
        * (1.0 - smoothstep(0.24, 0.58, normalizedDistance));
      float glintRadius = vEffectRadiusPx
        * (0.2 + 0.07 * sin(angle * 5.0 + vEffectSeed * 29.0));
      float glintBand = 1.0 - smoothstep(
        0.8,
        3.0,
        abs(effectDistance - glintRadius)
      );
      float glintPattern = pow(
        max(
          0.0,
          0.5 + 0.5 * sin(angle * 17.0 + vEffectSeed * 43.0 + vEffectProgress * 5.4)
        ),
        14.0
      );
      float hotGlints = glintBand * glintPattern;
      float haloRadius = vEffectRadiusPx * mix(0.08, 0.52, effectEase);
      float haloWidth = vEffectRadiusPx * mix(0.08, 0.025, vEffectProgress);
      float halo = 1.0 - smoothstep(
        haloWidth,
        haloWidth * 2.6 + 1.0,
        abs(effectDistance - haloRadius)
      );
      float haloBreakup = mix(
        0.18,
        1.0,
        0.5 + 0.5 * sin(angle * 9.0 - vEffectSeed * 31.0)
      );
      float haloOutward = smoothstep(-0.62, 0.18, dot(effectDirection, vEffectOutward));
      float pulse = sin(clamp(vEffectProgress, 0.0, 1.0) * 3.14159265);
      effectLight = (
        core * 0.9
        + primarySpike * 0.26
        + secondarySpike * 0.17
        + bloom * unevenness * 0.12
        + coronaRays * 0.25
        + hotGlints * 0.42
        + halo * haloBreakup * haloOutward * 0.18
      ) * mix(0.76, 1.0, pulse);
    } else {
      float waveRadius = mix(vEffectRadiusPx * 0.08, vEffectRadiusPx * 0.9, effectEase);
      float bandDistance = abs(effectDistance - waveRadius);
      float bandWidth = vEffectRadiusPx * mix(0.18, 0.1, vEffectProgress);
      float haze = 1.0 - smoothstep(
        bandWidth,
        bandWidth * 2.8 + 2.0,
        bandDistance
      );
      float angle = atan(vLocalPx.y, vLocalPx.x);
      float breakup = 0.5
        + 0.5 * sin(angle * 11.0 + effectDistance * 0.09 + vEffectSeed * 23.0);
      breakup = mix(0.28, 1.0, smoothstep(0.12, 0.88, breakup));
      float pinpricks = pow(
        max(0.0, sin(angle * 17.0 + vEffectSeed * 31.0)),
        18.0
      ) * haze;
      float outwardMask = smoothstep(-0.28, 0.34, dot(effectDirection, vEffectOutward));
      vec2 effectTangent = vec2(-vEffectOutward.y, vEffectOutward.x);
      float flareLean = mix(-0.72, 0.72, fract(vEffectSeed * 17.31));
      vec2 flareAxis = normalize(vEffectOutward + effectTangent * flareLean);
      vec2 flareTangent = vec2(-flareAxis.y, flareAxis.x);
      vec2 loopCenter = flareAxis
        * vEffectRadiusPx
        * mix(0.16, 0.3, effectEase);
      vec2 loopLocal = vLocalPx - loopCenter;
      float loopAlong = dot(loopLocal, flareAxis);
      float loopAcross = dot(loopLocal, flareTangent);
      float loopDistance = length(vec2(loopAcross, loopAlong * 0.76));
      float loopRadius = vEffectRadiusPx * mix(0.1, 0.32, effectEase);
      float loopWidth = vEffectRadiusPx * mix(0.065, 0.025, vEffectProgress);
      float prominence = 1.0 - smoothstep(
        loopWidth,
        loopWidth * 2.8 + 1.0,
        abs(loopDistance - loopRadius)
      );
      float loopOpening = smoothstep(
        -0.38,
        0.18,
        dot(loopLocal / max(length(loopLocal), 0.001), flareAxis)
      );
      float loopBreakup = mix(
        0.2,
        1.0,
        smoothstep(
          0.12,
          0.88,
          0.5 + 0.5 * sin(angle * 7.0 + effectDistance * 0.08 + vEffectSeed * 41.0)
        )
      );
      float outwardDistance = dot(vLocalPx, flareAxis) / max(vEffectRadiusPx, 1.0);
      float sidewaysDistance = dot(vLocalPx, flareTangent) / max(vEffectRadiusPx, 1.0);
      float flareCurve = sidewaysDistance
        - flareLean * 0.22 * outwardDistance * outwardDistance;
      float flareTongue = (1.0 - smoothstep(0.014, 0.07, abs(flareCurve)))
        * smoothstep(0.02, 0.12, outwardDistance)
        * (1.0 - smoothstep(0.42, 0.82, outwardDistance));
      float flareVariant = fract(vEffectSeed * 53.17);
      float prominenceWeight = mix(0.22, 0.52, smoothstep(0.18, 0.72, flareVariant));
      float tongueWeight = mix(0.5, 0.18, smoothstep(0.28, 0.82, flareVariant));
      effectLight = (
        haze * breakup * 0.28
        + pinpricks * 0.24
        + prominence * loopOpening * loopBreakup * prominenceWeight
        + flareTongue * tongueWeight
      ) * outwardMask;
    }

    float effectStrength = 0.9 * uSurfaceEffects;
    effectLight *= vOpacity * vSparkFlicker * effectStrength;
    if (effectLight <= 0.001) discard;
    outColor = vec4(vec3(effectLight), 1.0);
    return;
  }

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
  float cometLight = (headCore + headHalo * 0.36) * vIsHead
    + trailCore * 0.68
    + trailHalo * 0.12;

  float needleMask = 1.0 - step(0.5, vSparkKind);
  float burstMask = step(0.5, vSparkKind) * (1.0 - step(1.5, vSparkKind));
  float waveMask = step(1.5, vSparkKind);
  float sparkTaper = mix(0.14, 1.0, smoothstep(0.0, 0.84, trailProgress));
  float sparkTrailWidth = max(0.65, vRadiusPx * mix(0.14, 0.38, trailProgress));
  float sparkTrailCore = 1.0 - smoothstep(
    sparkTrailWidth,
    sparkTrailWidth + 0.7,
    segmentDistance
  );
  float sparkTrailHalo = 1.0 - smoothstep(
    sparkTrailWidth,
    vRadiusPx * 2.7 + 1.0,
    segmentDistance
  );
  float sparkHeadCore = 1.0 - smoothstep(
    vRadiusPx * 0.92,
    vRadiusPx * 0.92 + 0.75,
    headDistance
  );
  float sparkHeadHalo = 1.0 - smoothstep(
    vRadiusPx * 0.8,
    vRadiusPx * 3.2 + 1.0,
    headDistance
  );
  float needleLight = (sparkHeadCore * 1.38 + sparkHeadHalo * 0.22) * vIsHead
    + sparkTrailCore * 1.12 * sparkTaper
    + sparkTrailHalo * 0.13 * sparkTaper;
  float burstLight = (sparkHeadCore * 1.62 + sparkHeadHalo * 0.22) * vIsHead
    + sparkTrailCore * 1.08 * sparkTaper
    + sparkTrailHalo * 0.12 * sparkTaper;
  float waveLight = (sparkHeadCore * 1.08 + sparkHeadHalo * 0.28) * vIsHead
    + sparkTrailCore * 0.38
    + sparkTrailHalo * 0.12;
  float sparkLight = needleLight * needleMask
    + burstLight * burstMask
    + waveLight * waveMask;
  float light = mix(cometLight, sparkLight, vIsSpark);
  float sparkStrength = (needleMask * 1.05 + burstMask * 1.25 + waveMask * 0.92)
    * vSparkFlicker;
  float outputStrength = mix(0.68, sparkStrength * uSparkBrightness, vIsSpark);

  if (light <= 0.001 || vOpacity <= 0.001) discard;
  outColor = vec4(vec3(light * vOpacity * outputStrength), 1.0);
}`;
