export const SHARD_SHATTER_REVEAL_FRAG = `#version 300 es
precision highp float;

const int SHARDS = 14;

uniform sampler2D uField;
uniform float uAspect;
uniform float uProgress;
uniform float uFront;
uniform float uImpulse;
uniform vec2 uImpact;
uniform vec2 uSite[SHARDS];
uniform vec2 uCentroid[SHARDS];
uniform vec2 uOffset[SHARDS];
uniform vec2 uRot[SHARDS];
uniform float uT[SHARDS];
uniform float uBias[SHARDS];

in vec2 vUv;
out vec4 outColor;

float sq(float x) {
  return x * x;
}

float hash21(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 3; i++) {
    v += amp * vnoise(p);
    p = p * 2.03 + vec2(11.7, 5.3);
    amp *= 0.5;
  }
  return v / 0.875;
}

float plateValue(vec2 q) {
  vec2 uv = vec2(q.x, 1.0 - q.y / max(uAspect, 1e-4));
  vec2 sw = vec2(sin(q.y * 9.0 + 1.3), cos(q.x * 7.5 - 0.7)) * 0.045;
  float img = texture(uField, clamp(uv + sw, 0.0, 1.0)).r;
  float frost = fbm(q * 4.6 + vec2(3.1, 7.9));
  return clamp(mix(0.15 + 0.8 * frost, img, 0.26), 0.0, 1.0);
}

void nearest2(vec2 q, out int i1, out int i2) {
  float d1 = 1e9;
  float d2 = 1e9;
  i1 = 0;
  i2 = 0;
  for (int k = 0; k < SHARDS; k++) {
    vec2 d = q - uSite[k];
    float dd = dot(d, d);
    if (dd < d1) {
      d2 = d1;
      i2 = i1;
      d1 = dd;
      i1 = k;
    } else if (dd < d2) {
      d2 = dd;
      i2 = k;
    }
  }
}

vec2 edgeFrame(vec2 q, int i1, int i2) {
  vec2 a = uSite[i1];
  vec2 b = uSite[i2];
  vec2 ab = b - a;
  float len = max(length(ab), 1e-5);
  vec2 n = ab / len;
  return vec2(-dot(q - 0.5 * (a + b), n), len);
}

void main() {
  float base = texture(uField, vUv).r;
  if (uProgress >= 1.0) {
    outColor = vec4(vec3(base), 1.0);
    return;
  }

  vec2 pos = vec2(vUv.x, (1.0 - vUv.y) * uAspect);

  int bestK = -1;
  int bestNb = 0;
  float bestT = -1.0;
  vec2 bestQ = pos;
  for (int k = 0; k < SHARDS; k++) {
    float tk = uT[k];
    if (tk <= 0.0 || tk >= 1.0) continue;
    vec2 d = pos - uOffset[k];
    vec2 r = uRot[k];
    vec2 q = vec2(r.x * d.x + r.y * d.y, r.x * d.y - r.y * d.x) + uCentroid[k];
    int n1;
    int n2;
    nearest2(q, n1, n2);
    if (n1 != k) continue;
    if (tk > bestT) {
      bestT = tk;
      bestK = k;
      bestNb = n2;
      bestQ = q;
    }
  }

  if (bestK >= 0) {
    vec2 a = uSite[bestK];
    vec2 b = uSite[bestNb];
    vec2 ab = b - a;
    float dEdge = -dot(bestQ - 0.5 * (a + b), ab / max(length(ab), 1e-5));
    float v = plateValue(bestQ) + uBias[bestK];
    v += exp(-sq(dEdge / 0.013)) * 0.32;
    v = mix(v, 0.03, smoothstep(0.0055, 0.0, dEdge) * 0.85);
    outColor = vec4(vec3(clamp(v, 0.0, 1.0)), 1.0);
    return;
  }

  int r1;
  int r2;
  nearest2(pos, r1, r2);
  if (uT[r1] > 0.0) {
    outColor = vec4(vec3(base), 1.0);
    return;
  }

  float dImp = length(pos - uImpact);
  float opened = smoothstep(uFront, uFront - 0.07, dImp);
  float pulse = exp(-sq((dImp - uFront) / 0.09)) * opened;

  vec2 a = uSite[r1];
  vec2 b = uSite[r2];
  vec2 ab = b - a;
  vec2 n = ab / max(length(ab), 1e-5);
  float dEdge = -dot(pos - 0.5 * (a + b), n);

  float prof = exp(-sq(dEdge / 0.058));
  float push = (0.021 * opened + 0.05 * pulse) * prof;
  vec2 dirI = (pos - uImpact) / max(dImp, 1e-4);
  float impPush = 0.055 * uImpulse * exp(-sq(dImp / 0.2));

  vec2 q = pos + n * push - dirI * impPush;
  float v = plateValue(q) + uBias[r1] * opened;

  float fw = max(0.0135 * opened + 0.042 * pulse, 4e-4);
  float fissure = smoothstep(fw, fw * 0.22, dEdge) * opened;
  v = mix(v, 0.03, fissure * 0.92);
  v += exp(-sq((dEdge - fw * 1.8) / max(fw * 0.85, 1e-4))) * opened * 0.28;
  v += uImpulse * exp(-sq(dImp / 0.085)) * 0.8;

  outColor = vec4(vec3(clamp(v, 0.0, 1.0)), 1.0);
}
`;
