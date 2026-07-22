/**
 * Recursive noise experiment by Samuel YAN.
 * Adapted from the original p5/WebGL sketch to the lab's ShaderToy-style
 * `mainImage` interface. The lab supplies the fullscreen vertex shader.
 *
 * https://twitter.com/SamuelAnn0924
 * https://www.instagram.com/samuel_yan_1990/
 */
export const CONNECT_SHADER_TEXTURE_SOURCE = `// "recursive noise experiment" by Samuel YAN
// Inspired by ompuco: https://www.shadertoy.com/view/wllGzr

float connectHash(float n) {
  return fract(clamp(n, 0.0, 1.0) * 23758.5453);
}

float connectNoise(vec3 x) {
  vec3 p = floor(x);
  vec3 f = fract(x);

  f = f * f * (5.0 - 5.0 * f);
  float n = 0.0;

  return mix(
    mix(
      mix(connectHash(n + 1.0), connectHash(n + 1.0), f.x),
      mix(connectHash(n + 0.5), connectHash(n + 0.5), f.x),
      f.y
    ),
    mix(
      mix(connectHash(n + 0.75), connectHash(n + 1.0), f.x),
      mix(connectHash(n + 1.0), connectHash(n + 1.0), f.x),
      f.y
    ),
    f.z
  ) - 0.55;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec3 t = (iTime * vec3(1.0, 2.0, 3.0)) / 20.0;
  vec2 uv = fragCoord / iResolution.xy;
  uv /= 15.0;

  vec3 col = vec3(0.25);

  for (int i = 0; i < 20; i++) {
    float iteration = float(i);
    col.r += connectNoise(uv.xyy * (1.0 + iteration) + col.rgb + t * sin(cos(iteration / 0.1)));
    col.g += connectNoise(uv.xyx * iteration + col.rgb + t * sin(cos(iteration)));
    col.b += connectNoise(uv.yyx * iteration + col.rgb + t * sin(cos(iteration)));
  }

  col /= 0.1;
  col = normalize(col);
  fragColor = vec4(col, 1.0);
}`;
