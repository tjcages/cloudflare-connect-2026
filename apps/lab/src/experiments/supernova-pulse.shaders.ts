export const SUPERNOVA_FIELD_FRAG = `#version 300 es
precision highp float;

uniform sampler2D uField;
uniform vec2 uCssSize;
uniform float uTime;
uniform int uEvCount;
uniform vec2 uEvCenter[3];
uniform float uEvAge[3];
uniform float uEvSeed[3];
uniform float uEvPre[3];
uniform float uEvFlash[3];

in vec2 vUv;
out vec4 outColor;

const float SHOCK_SECONDS = 0.9;
const float REMNANT_SECONDS = 2.8;
const float STAR_CELL = 40.0;

float hash11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}

vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}

float shockRadius(float ts, float sc) {
  return 214.0 * sc * pow(ts, 0.44);
}

float shockWobble(float ang, float seed, float ts) {
  return (sin(ang * 4.0 + seed * 11.0) + 0.6 * sin(ang * 9.0 - seed * 7.0) + 0.35 * sin(ang * 15.0 + seed * 3.0)) *
    4.6 * ts;
}

float filaments(float ang, float r, float seed, float t) {
  float a = sin(ang * 7.0 + seed * 5.0 + t * 0.7);
  float b = sin(ang * 13.0 - seed * 3.0 - t * 1.3 + r * 0.05);
  float c = sin(r * 0.085 - t * 1.9 + seed * 9.0);
  return clamp(0.5 + 0.27 * a + 0.19 * b + 0.22 * c, 0.0, 1.0);
}

vec3 starSample(vec2 pos, float sc) {
  float cell = STAR_CELL * sc;
  vec2 gp = pos / cell;
  vec2 base = floor(gp);
  vec2 warp = vec2(0.0);
  float light = 0.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 cid = base + vec2(float(i), float(j));
      vec2 h = hash22(cid);
      float h3 = hash11(h.x * 57.0 + h.y * 13.0 + 3.7);
      float h4 = hash11(h.x * 23.0 + h.y * 91.0 + 8.1);
      if (h3 < 0.2) continue;
      vec2 sp = (cid + vec2(0.15) + 0.7 * h) * cell;
      vec2 d = pos - sp;
      float r = length(d);
      float tw = 0.7 + 0.3 * sin(uTime * (0.5 + 1.5 * h4) + h3 * 21.0);
      float size = (2.1 + 4.1 * h4 * h4) * sc * (0.85 + 0.3 * tw);
      light = max(light, smoothstep(size, size * 0.22, r) * (0.72 + 0.28 * tw));
      float lensR = size * 3.3;
      float g = exp(-(r * r) / (lensR * lensR));
      warp += (d / max(r, 1e-3)) * g * size * 0.95;
    }
  }
  return vec3(warp, light);
}

void main() {
  float sc = clamp(min(uCssSize.x, uCssSize.y) / 300.0, 0.5, 2.5);
  vec2 pos = vec2(vUv.x, 1.0 - vUv.y) * uCssSize;

  vec2 evWarp = vec2(0.0);
  for (int i = 0; i < 3; i++) {
    if (i >= uEvCount) break;
    float age = uEvAge[i];
    vec2 d = pos - uEvCenter[i];
    float r = max(length(d), 1e-3);
    vec2 dir = d / r;
    float ang = atan(d.y, d.x);
    float seed = uEvSeed[i];

    if (age < 0.0) {
      float p = clamp(1.0 + age / max(uEvPre[i], 1e-3), 0.0, 1.0);
      float pinchR = 130.0 * sc;
      float g = exp(-(r * r) / (pinchR * pinchR));
      evWarp -= dir * g * 18.0 * sc * p * p;
      continue;
    }

    float ts = age / SHOCK_SECONDS;
    if (ts < 1.0) {
      float R = shockRadius(ts, sc) + shockWobble(ang, seed, ts) * sc;
      float th = mix(30.0, 11.0, ts) * sc;
      float band = (r - R) / th;
      float g = exp(-band * band);
      float w = pow(1.0 - ts, 0.8);
      evWarp += dir * band * g * 27.0 * sc * w;
    }

    float tr = age / REMNANT_SECONDS;
    if (tr < 1.0) {
      float swirlR = mix(95.0, 195.0, tr) * sc;
      float g = exp(-(r * r) / (swirlR * swirlR));
      float dec = pow(1.0 - tr, 1.7);
      evWarp += vec2(-dir.y, dir.x) * g * dec * 13.0 * sc * sin(r / (26.0 * sc) - age * 2.6 + seed);
    }
  }

  vec3 st = starSample(pos + evWarp, sc);
  vec2 warp = evWarp + st.xy;
  vec2 uv = clamp(vUv + vec2(warp.x / uCssSize.x, -warp.y / uCssSize.y), 0.0, 1.0);
  float base = texture(uField, uv).r;

  float add = st.z * 0.95;
  float dim = 0.0;

  for (int i = 0; i < 3; i++) {
    if (i >= uEvCount) break;
    float age = uEvAge[i];
    float seed = uEvSeed[i];
    vec2 d = pos - uEvCenter[i];
    float r = max(length(d), 1e-3);
    float ang = atan(d.y, d.x);

    if (age < 0.0) {
      float p = clamp(1.0 + age / max(uEvPre[i], 1e-3), 0.0, 1.0);
      float pr = (2.6 + 9.0 * p) * sc;
      float pulse = 0.62 + 0.38 * sin(age * 42.0 * (0.4 + p));
      add += smoothstep(pr, pr * 0.2, r) * (0.45 + 0.55 * p) * pulse;
      continue;
    }

    float f = uEvFlash[i];
    float coreR = mix(18.0, 66.0, f) * sc;
    add += smoothstep(coreR, coreR * 0.2, r) * (1.0 - 0.86 * f);
    add += exp(-r / (118.0 * sc)) * exp(-age * 4.6) * 0.55;

    float ts = age / SHOCK_SECONDS;
    if (ts < 1.0) {
      float R = shockRadius(ts, sc) + shockWobble(ang, seed, ts) * sc;
      float th = mix(30.0, 11.0, ts) * sc;
      float band = (r - R) / th;
      float g = exp(-band * band);
      float w = pow(1.0 - ts, 0.8);
      float grain = 0.8 + 0.2 * sin(ang * 21.0 + seed * 27.0 + ts * 8.0);
      add += g * w * 0.72 * grain;
      float behind = (r - (R - th * 2.0)) / (th * 1.5);
      dim += exp(-behind * behind) * w * 0.3 * smoothstep(0.06, 0.36, ts);
    }

    float tr = age / REMNANT_SECONDS;
    if (tr < 1.0) {
      float nr = mix(74.0, 172.0, sqrt(tr)) * sc;
      float q = r / nr;
      if (q < 1.8) {
        float fil = filaments(ang, r / sc, seed, age);
        float body = exp(-q * q * 1.35) * pow(1.0 - tr, 1.5);
        add += body * (0.3 + 0.55 * fil);
        dim += body * 0.5 * (1.0 - fil);
      }
    }
  }

  float value = clamp(base * (1.0 - min(dim, 0.68)) + add, 0.0, 1.0);
  outColor = vec4(vec3(value), 1.0);
}
`;
