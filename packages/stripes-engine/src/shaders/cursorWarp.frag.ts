export const CURSOR_WARP_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uField;
uniform sampler2D uAccum;
uniform sampler2D uTear;
uniform vec2 uPixelSize;
uniform vec2 uCellSize;
uniform vec2 uGridSize;
uniform float uPushCap;
out vec4 finalColor;

vec2 capPush(vec2 p, float cap) {
  float L = length(p);
  return L > cap ? p * (cap / L) : p;
}

void main() {
  vec2 pixelCoord = vec2(vUv.x, 1.0 - vUv.y) * uPixelSize;
  float colIndex = floor(pixelCoord.x / max(uCellSize.x, 1.0));
  float rowIndex = floor(pixelCoord.y / max(uCellSize.y, 1.0));
  vec2 cuv = vec2((colIndex + 0.5) / max(uGridSize.x, 1.0), (rowIndex + 0.5) / max(uGridSize.y, 1.0));

  vec4 accum = texture(uAccum, cuv);
  float brighten = accum.r;
  vec2 pushCells = capPush(accum.gb, uPushCap);
  float tear = texture(uTear, cuv).r;

  vec2 offsetUv = pushCells * uCellSize / uPixelSize;
  offsetUv.y = -offsetUv.y;
  float field = texture(uField, vUv - offsetUv).r;
  field *= (1.0 - tear);
  field += (1.0 - field) * brighten;

  finalColor = vec4(vec3(clamp(field, 0.0, 1.0)), 1.0);
}
`;

export const CURSOR_WARP_COLOR_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uFieldColor;
uniform sampler2D uAccum;
uniform sampler2D uTear;
uniform vec2 uPixelSize;
uniform vec2 uCellSize;
uniform vec2 uGridSize;
uniform float uPushCap;
uniform vec3 uTrailColor;
out vec4 finalColor;

vec2 capPush(vec2 p, float cap) {
  float L = length(p);
  return L > cap ? p * (cap / L) : p;
}

void main() {
  vec2 pixelCoord = vec2(vUv.x, 1.0 - vUv.y) * uPixelSize;
  float colIndex = floor(pixelCoord.x / max(uCellSize.x, 1.0));
  float rowIndex = floor(pixelCoord.y / max(uCellSize.y, 1.0));
  vec2 cuv = vec2((colIndex + 0.5) / max(uGridSize.x, 1.0), (rowIndex + 0.5) / max(uGridSize.y, 1.0));

  vec4 accum = texture(uAccum, cuv);
  float brighten = clamp(accum.r, 0.0, 1.0);
  vec2 pushCells = capPush(accum.gb, uPushCap);
  float tear = texture(uTear, cuv).r;

  vec2 offsetUv = pushCells * uCellSize / uPixelSize;
  offsetUv.y = -offsetUv.y;
  vec4 c = texture(uFieldColor, vUv - offsetUv);
  float cov = c.a * (1.0 - tear);
  cov += (1.0 - cov) * brighten;
  vec3 rgb = mix(c.rgb, uTrailColor, brighten);
  finalColor = vec4(rgb, clamp(cov, 0.0, 1.0));
}
`;
