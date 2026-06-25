export const LOGO_FILL_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uTex;
uniform vec2 uResolution;
uniform vec3 uBg;
out vec4 fragColor;
void main(){
  vec3 here = texture(uTex, vUv).rgb;
  if (distance(here, uBg) > 0.12) { fragColor = vec4(here, 1.0); return; }
  float st = 1.5 / uResolution.x;
  vec3 leftCol = uBg; float leftDist = 999.0;
  vec3 rightCol = uBg; float rightDist = 999.0;
  for (int i = 1; i <= 14; i++) {
    if (leftDist > 900.0) {
      vec3 s = texture(uTex, vUv - vec2(float(i) * st, 0.0)).rgb;
      if (distance(s, uBg) > 0.12) { leftCol = s; leftDist = float(i); }
    }
    if (rightDist > 900.0) {
      vec3 s = texture(uTex, vUv + vec2(float(i) * st, 0.0)).rgb;
      if (distance(s, uBg) > 0.12) { rightCol = s; rightDist = float(i); }
    }
  }
  if (leftDist < 900.0 && rightDist < 900.0) {
    fragColor = vec4(mix(leftCol, rightCol, leftDist / (leftDist + rightDist)), 1.0);
  } else {
    fragColor = vec4(here, 1.0);
  }
}
`;
