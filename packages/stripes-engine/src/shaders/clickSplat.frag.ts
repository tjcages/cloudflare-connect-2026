export const CLICK_SPLAT_FRAG = `#version 300 es
precision highp float;
in vec2 vCenterCell;
in float vRadiusCell;
in float vHalfStrokeCell;
in float vPushBandCell;
in float vPushPeak;
in float vWhiteAmt;
in float vProgress;
in float vSeed;
in float vWobbleAmplitude;
uniform vec2 uGridSize;
out vec4 finalColor;

float clamp01(float v) {
  return clamp(v, 0.0, 1.0);
}

float falloff(float distance, float radius) {
  if (radius <= 0.0 || distance >= radius) {
    return 0.0;
  }
  float t = 1.0 - distance / radius;
  return t * t * (3.0 - 2.0 * t);
}

float clickSeededUnit(float seed, float salt) {
  float x = sin(seed * 12.9898 + salt * 78.233) * 43758.5453;
  return x - floor(x);
}

float clickRadiusWobble(float seed, float angle, float progress, float amplitude) {
  float spin = progress * 6.28318530718;
  return amplitude * (
    sin(angle * 3.0 + seed * 0.71 + spin * 0.35) * 0.38 +
    sin(angle * 6.0 + seed * 1.19 - spin * 0.55) * 0.32 +
    sin(angle * 11.0 + seed * 2.07 + spin) * 0.22
  );
}

float clickStrengthBreakup(float seed, float x, float y, float progress, float jitter) {
  if (jitter <= 0.0) {
    return 1.0;
  }
  float n1 = clickSeededUnit(seed, x * 0.17 + y * 0.23 + progress * 48.0);
  float n2 = clickSeededUnit(seed, x * 0.41 + y * 0.09 - progress * 29.0 + seed * 0.13);
  float density = n1 * n2;
  return 1.0 - jitter * (1.0 - density);
}

float clickDissolveProgress(float waveProgress) {
  float t = clamp((waveProgress - 0.8) / 0.2, 0.0, 1.0);
  return t * t * (3.0 - 2.0 * t);
}

bool clickCellDissolved(float seed, float cellIdx, float dissolve) {
  return dissolve > 0.0 && clickSeededUnit(seed, cellIdx * 7.13 + 3.7) < dissolve;
}

const float CLICK_BREAKUP_JITTER = 0.25;
const float CLICK_INTERIOR_FILL = 0.5;

void main() {
  vec2 cell = floor(gl_FragCoord.xy);
  float cellIdx = cell.y * uGridSize.x + cell.x;

  float dissolve = clickDissolveProgress(vProgress);
  if (clickCellDissolved(vSeed, cellIdx, dissolve)) {
    discard;
  }

  float dx = cell.x - vCenterCell.x;
  float dy = cell.y - vCenterCell.y;
  float distance = sqrt(dx * dx + dy * dy);
  float angle = atan(dy, dx);

  float brighten = 0.0;
  if (vWhiteAmt > 0.0 && vRadiusCell > 0.0) {
    float frontRadius = vRadiusCell + clickRadiusWobble(vSeed, angle, vProgress, vWobbleAmplitude);
    float breakup = clickStrengthBreakup(vSeed, cell.x, cell.y, vProgress, CLICK_BREAKUP_JITTER);
    float fromFront = distance - frontRadius;
    float radial;
    if (fromFront > vHalfStrokeCell) {
      radial = 0.0;
    } else if (fromFront > 0.0) {
      radial = falloff(fromFront, vHalfStrokeCell);
    } else {
      float interiorT = clamp01(distance / max(0.0001, frontRadius));
      radial = CLICK_INTERIOR_FILL + (1.0 - CLICK_INTERIOR_FILL) * interiorT;
    }
    brighten = clamp01(vWhiteAmt * breakup * radial);
  }

  float pushX = 0.0;
  float pushY = 0.0;
  if (vPushPeak > 0.0 && vRadiusCell > 0.0 && distance > 0.0) {
    float reach = vRadiusCell + vWobbleAmplitude + vPushBandCell;
    if (distance < reach) {
      float frontRadius = max(0.5, vRadiusCell + clickRadiusWobble(vSeed, angle, vProgress, vWobbleAmplitude));
      float w;
      if (distance <= frontRadius) {
        float t = distance / frontRadius;
        w = t * t * (3.0 - 2.0 * t);
      } else {
        w = falloff(distance - frontRadius, vPushBandCell);
      }
      float force = vPushPeak * w;
      if (force > 0.0) {
        pushX = (dx / distance) * force;
        pushY = (dy / distance) * force;
      }
    }
  }

  if (brighten <= 0.0 && pushX == 0.0 && pushY == 0.0) {
    discard;
  }

  finalColor = vec4(brighten, pushX, pushY, 0.0);
}
`;
