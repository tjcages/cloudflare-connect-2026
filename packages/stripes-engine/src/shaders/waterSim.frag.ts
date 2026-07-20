export const WATER_SIM_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uPrev;      // rg = height, velocity
uniform vec2 uTexel;          // 1/simW, 1/simH
uniform vec2 uSplatA;         // segment start, sim pixels
uniform vec2 uSplatB;         // segment end, sim pixels
uniform float uSplatAmp;
uniform float uSplatRadius;
out vec4 outColor;

// Spring-coupled heightfield. CLAMP_TO_EDGE sampling makes the borders
// reflect softly, so waves bounce off the canvas walls.
void main() {
  vec2 hv = texture(uPrev, vUv).rg;
  float hL = texture(uPrev, vUv - vec2(uTexel.x, 0.0)).r;
  float hR = texture(uPrev, vUv + vec2(uTexel.x, 0.0)).r;
  float hT = texture(uPrev, vUv + vec2(0.0, uTexel.y)).r;
  float hB = texture(uPrev, vUv - vec2(0.0, uTexel.y)).r;
  float lap = (hL + hR + hT + hB) * 0.25 - hv.r;

  // Value noise breaks the stiffness up so wavefronts stay irregular
  // instead of collapsing into perfect circles.
  vec2 np = vUv / uTexel * 0.02;
  vec2 ni = floor(np);
  vec2 nf = fract(np);
  float n00 = fract(sin(dot(ni, vec2(127.1, 311.7))) * 43758.5453);
  float n10 = fract(sin(dot(ni + vec2(1.0, 0.0), vec2(127.1, 311.7))) * 43758.5453);
  float n01 = fract(sin(dot(ni + vec2(0.0, 1.0), vec2(127.1, 311.7))) * 43758.5453);
  float n11 = fract(sin(dot(ni + vec2(1.0, 1.0), vec2(127.1, 311.7))) * 43758.5453);
  vec2 sf = nf * nf * (3.0 - 2.0 * nf);
  float wn = mix(mix(n00, n10, sf.x), mix(n01, n11, sf.x), sf.y);

  float vel = (hv.g + lap * (0.45 * (0.80 + 0.30 * wn))) * 0.98555;
  float h = (hv.r + vel) * 0.9956;
  h = mix(h, (hL + hR + hT + hB) * 0.25, 0.06); // viscosity

  if (uSplatAmp != 0.0) {
    vec2 pos = vUv / uTexel;
    vec2 ba = uSplatB - uSplatA;
    float bl = length(ba);
    float rr = uSplatRadius;
    if (bl > 0.5) {
      // Swept segment: a capsule crest anchored on the cursor path, with a
      // weaker trailing lobe behind it so the stroke reads as a dipole wake.
      vec2 nd = ba / bl;
      vec2 offs = nd * rr * 1.4;
      float angS = atan(pos.y - uSplatA.y, pos.x - uSplatA.x);
      float wobS = 1.0 + 0.24 * sin(angS * 3.0 + wn * 6.2831);
      vec2 paF = pos - uSplatA;
      float ttF = clamp(dot(paF, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
      vec2 dpF = paF - ba * ttF;
      vec2 paB = pos - (uSplatA - offs);
      float ttB = clamp(dot(paB, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
      vec2 dpB = paB - ba * ttB;
      h += uSplatAmp * (exp(-dot(dpF, dpF) / (2.0 * rr * rr * wobS))
                       - 0.45 * exp(-dot(dpB, dpB) / (2.0 * rr * rr * wobS)));
    } else {
      vec2 dp = pos - uSplatA;
      float ang = atan(dp.y, dp.x);
      float wob = 1.0 + 0.30 * sin(ang * 3.0 + wn * 6.2831) + 0.18 * sin(ang * 5.0 - wn * 4.0);
      h += uSplatAmp * exp(-dot(dp, dp) / (2.0 * rr * rr * wob));
    }
  }

  outColor = vec4(h, vel, 0.0, 1.0);
}
`;
