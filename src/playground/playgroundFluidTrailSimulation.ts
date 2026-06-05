import { Container, Filter, GlProgram, RenderTexture, Sprite, Texture, UniformGroup, type Application } from "pixi.js";
import type { PlaygroundFluidTrailInput } from "./playgroundFluidTrail";

export const PLAYGROUND_FLUID_TRAIL_SCALE = 0.25;
export const PLAYGROUND_FLUID_TRAIL_MIN_SIZE = 128;
export const PLAYGROUND_FLUID_TRAIL_MAX_SIZE = 640;
export const PLAYGROUND_FLUID_PRESSURE_ITERATIONS = 10;

const FLUID_VERTEX = `
in vec2 aPosition;
out vec2 vTextureCoord;

uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;

vec4 filterVertexPosition(void)
{
    vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
    position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
    position.y = position.y * (2.0*uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
    return vec4(position, 0.0, 1.0);
}

vec2 filterTextureCoord(void)
{
    return aPosition * (uOutputFrame.zw * uInputSize.zw);
}

void main(void)
{
    gl_Position = filterVertexPosition();
    vTextureCoord = filterTextureCoord();
}
`;

const FLUID_COMMON = `
vec2 decodeVelocity(vec4 value) {
    return vec2(value.r - value.g, value.b - value.a);
}

vec4 encodeVelocity(vec2 value) {
    vec2 v = clamp(value, vec2(-1.0), vec2(1.0));
    return vec4(max(v.x, 0.0), max(-v.x, 0.0), max(v.y, 0.0), max(-v.y, 0.0));
}

float decodeScalar(vec4 value) {
    return value.r - value.g;
}

vec4 encodeScalar(float value) {
    float v = clamp(value, -1.0, 1.0);
    return vec4(max(v, 0.0), max(-v, 0.0), 0.0, 1.0);
}
`;

export const PLAYGROUND_FLUID_ADVECT_FRAGMENT = `
in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform sampler2D uVelocity;
uniform vec2 uTexelSize;
uniform float uDissipation;
uniform float uIsVelocity;

${FLUID_COMMON}

void main(void) {
    vec2 velocity = decodeVelocity(texture(uVelocity, vTextureCoord));
    vec2 uv = clamp(vTextureCoord - velocity * uTexelSize * 18.0, vec2(0.0), vec2(1.0));
    vec4 advected = texture(uTexture, uv) * uDissipation;
    if (uIsVelocity > 0.5) {
        finalColor = encodeVelocity(decodeVelocity(advected));
    } else {
        finalColor = vec4(clamp(advected.rgb, vec3(0.0), vec3(1.0)), 1.0);
    }
}
`;

export const PLAYGROUND_FLUID_SPLAT_FRAGMENT = `
in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform vec4 uSplat;
uniform float uSplatEnabled;
uniform float uAspect;
uniform float uRadius;
uniform float uForce;
uniform float uIsVelocity;

${FLUID_COMMON}

void main(void) {
    vec4 current = texture(uTexture, vTextureCoord);
    if (uSplatEnabled < 0.5) {
        finalColor = current;
        return;
    }

    vec2 velocity = uSplat.zw;
    float speed = length(velocity);
    vec2 direction = speed > 0.001 ? normalize(velocity) : vec2(1.0, 0.0);
    vec2 delta = vTextureCoord - uSplat.xy;
    delta.x *= uAspect;

    float core = exp(-dot(delta, delta) / max(uRadius * uRadius, 0.00001));
    float behind = max(dot(delta, -direction), 0.0);
    float across = abs(delta.x * direction.y - delta.y * direction.x);
    float wake = exp(-(across * across) / max(uRadius * uRadius * 0.34, 0.00001));
    wake *= smoothstep(uRadius * 4.5, 0.0, behind);
    float splat = clamp(max(core, wake * clamp(speed * 2.4, 0.35, 1.0)), 0.0, 1.0);

    if (uIsVelocity > 0.5) {
        vec2 nextVelocity = decodeVelocity(current) + velocity * splat * uForce;
        finalColor = encodeVelocity(nextVelocity);
    } else {
        float signDye = velocity.x + velocity.y >= 0.0 ? splat : -splat;
        vec3 dye = current.rgb;
        dye.r += max(signDye, 0.0) * uForce;
        dye.b += max(-signDye, 0.0) * uForce;
        finalColor = vec4(clamp(dye, vec3(0.0), vec3(1.0)), 1.0);
    }
}
`;

export const PLAYGROUND_FLUID_CURL_FRAGMENT = `
in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform vec2 uTexelSize;

${FLUID_COMMON}

void main(void) {
    float left = decodeVelocity(texture(uTexture, vTextureCoord - vec2(uTexelSize.x, 0.0))).y;
    float right = decodeVelocity(texture(uTexture, vTextureCoord + vec2(uTexelSize.x, 0.0))).y;
    float bottom = decodeVelocity(texture(uTexture, vTextureCoord - vec2(0.0, uTexelSize.y))).x;
    float top = decodeVelocity(texture(uTexture, vTextureCoord + vec2(0.0, uTexelSize.y))).x;
    float curl = (right - left) - (top - bottom);
    finalColor = encodeScalar(curl * 0.5);
}
`;

export const PLAYGROUND_FLUID_VORTICITY_FRAGMENT = `
in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform sampler2D uCurl;
uniform vec2 uTexelSize;
uniform float uCurlStrength;

${FLUID_COMMON}

void main(void) {
    float left = abs(decodeScalar(texture(uCurl, vTextureCoord - vec2(uTexelSize.x, 0.0))));
    float right = abs(decodeScalar(texture(uCurl, vTextureCoord + vec2(uTexelSize.x, 0.0))));
    float bottom = abs(decodeScalar(texture(uCurl, vTextureCoord - vec2(0.0, uTexelSize.y))));
    float top = abs(decodeScalar(texture(uCurl, vTextureCoord + vec2(0.0, uTexelSize.y))));
    float center = decodeScalar(texture(uCurl, vTextureCoord));
    vec2 force = vec2(top - bottom, right - left);
    force = length(force) > 0.0001 ? normalize(force) : vec2(0.0);
    force *= center * uCurlStrength;
    vec2 velocity = decodeVelocity(texture(uTexture, vTextureCoord)) + vec2(force.x, -force.y);
    finalColor = encodeVelocity(velocity);
}
`;

export const PLAYGROUND_FLUID_DIVERGENCE_FRAGMENT = `
in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform vec2 uTexelSize;

${FLUID_COMMON}

void main(void) {
    float left = decodeVelocity(texture(uTexture, vTextureCoord - vec2(uTexelSize.x, 0.0))).x;
    float right = decodeVelocity(texture(uTexture, vTextureCoord + vec2(uTexelSize.x, 0.0))).x;
    float bottom = decodeVelocity(texture(uTexture, vTextureCoord - vec2(0.0, uTexelSize.y))).y;
    float top = decodeVelocity(texture(uTexture, vTextureCoord + vec2(0.0, uTexelSize.y))).y;
    finalColor = encodeScalar((right - left + top - bottom) * 0.5);
}
`;

export const PLAYGROUND_FLUID_PRESSURE_FRAGMENT = `
in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform sampler2D uDivergence;
uniform vec2 uTexelSize;

${FLUID_COMMON}

void main(void) {
    float left = decodeScalar(texture(uTexture, vTextureCoord - vec2(uTexelSize.x, 0.0)));
    float right = decodeScalar(texture(uTexture, vTextureCoord + vec2(uTexelSize.x, 0.0)));
    float bottom = decodeScalar(texture(uTexture, vTextureCoord - vec2(0.0, uTexelSize.y)));
    float top = decodeScalar(texture(uTexture, vTextureCoord + vec2(0.0, uTexelSize.y)));
    float divergence = decodeScalar(texture(uDivergence, vTextureCoord));
    finalColor = encodeScalar((left + right + bottom + top - divergence) * 0.25);
}
`;

export const PLAYGROUND_FLUID_GRADIENT_SUBTRACT_FRAGMENT = `
in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform sampler2D uPressure;
uniform vec2 uTexelSize;

${FLUID_COMMON}

void main(void) {
    float left = decodeScalar(texture(uPressure, vTextureCoord - vec2(uTexelSize.x, 0.0)));
    float right = decodeScalar(texture(uPressure, vTextureCoord + vec2(uTexelSize.x, 0.0)));
    float bottom = decodeScalar(texture(uPressure, vTextureCoord - vec2(0.0, uTexelSize.y)));
    float top = decodeScalar(texture(uPressure, vTextureCoord + vec2(0.0, uTexelSize.y)));
    vec2 velocity = decodeVelocity(texture(uTexture, vTextureCoord));
    velocity -= vec2(right - left, top - bottom) * 0.5;
    finalColor = encodeVelocity(velocity);
}
`;

export type PlaygroundFluidTrailSimulation = {
  readonly texture: Texture;
  step: () => void;
  destroy: () => void;
};

type TexturePair = {
  read: RenderTexture;
  write: RenderTexture;
  swap: () => void;
  destroy: () => void;
};

type FluidFilter = Filter & { uniforms: UniformGroup };
type FluidUniforms = ConstructorParameters<typeof UniformGroup>[0];

function clampDimension(value: number): number {
  return Math.min(PLAYGROUND_FLUID_TRAIL_MAX_SIZE, Math.max(PLAYGROUND_FLUID_TRAIL_MIN_SIZE, Math.round(value)));
}

export function resolvePlaygroundFluidTrailSize(display: { width: number; height: number }): { width: number; height: number } {
  return {
    width: clampDimension(display.width * PLAYGROUND_FLUID_TRAIL_SCALE),
    height: clampDimension(display.height * PLAYGROUND_FLUID_TRAIL_SCALE),
  };
}

function createRenderTexture(width: number, height: number): RenderTexture {
  const texture = RenderTexture.create({ width, height, resolution: 1 });
  texture.source.style.scaleMode = "linear";
  return texture;
}

function createTexturePair(width: number, height: number): TexturePair {
  let read = createRenderTexture(width, height);
  let write = createRenderTexture(width, height);
  return {
    get read() {
      return read;
    },
    get write() {
      return write;
    },
    swap: () => {
      const nextRead = write;
      write = read;
      read = nextRead;
    },
    destroy: () => {
      read.destroy(true);
      write.destroy(true);
    },
  };
}

function createFluidFilter(fragment: string, uniforms: FluidUniforms): FluidFilter {
  const uniformGroup = new UniformGroup(uniforms);
  const filter = new Filter({
    glProgram: GlProgram.from({
      vertex: FLUID_VERTEX,
      fragment,
    }),
    clipToViewport: false,
    padding: 0,
    resources: {
      fluidUniforms: uniformGroup,
    },
  }) as FluidFilter;
  filter.uniforms = uniformGroup;
  return filter;
}

function bindTexture(filter: Filter, name: string, texture: Texture) {
  texture.source.style.scaleMode = "linear";
  filter.resources[name] = texture.source;
}

export function createPlaygroundFluidTrailSimulation(
  app: Application,
  display: { width: number; height: number },
  input: PlaygroundFluidTrailInput,
): PlaygroundFluidTrailSimulation {
  const size = resolvePlaygroundFluidTrailSize(display);
  const texelSize = [1 / size.width, 1 / size.height];
  const aspect = size.width / Math.max(size.height, 1);
  const velocity = createTexturePair(size.width, size.height);
  const dye = createTexturePair(size.width, size.height);
  const pressure = createTexturePair(size.width, size.height);
  const divergence = createRenderTexture(size.width, size.height);
  const curl = createRenderTexture(size.width, size.height);
  const passSprite = new Sprite(Texture.EMPTY);
  passSprite.width = size.width;
  passSprite.height = size.height;
  const passStage = new Container();
  passStage.addChild(passSprite);

  const advectVelocityFilter = createFluidFilter(PLAYGROUND_FLUID_ADVECT_FRAGMENT, {
    uTexelSize: { value: texelSize, type: "vec2<f32>" },
    uDissipation: { value: 0.985, type: "f32" },
    uIsVelocity: { value: 1, type: "f32" },
  });
  const advectDyeFilter = createFluidFilter(PLAYGROUND_FLUID_ADVECT_FRAGMENT, {
    uTexelSize: { value: texelSize, type: "vec2<f32>" },
    uDissipation: { value: 0.982, type: "f32" },
    uIsVelocity: { value: 0, type: "f32" },
  });
  const splatVelocityFilter = createFluidFilter(PLAYGROUND_FLUID_SPLAT_FRAGMENT, {
    uSplat: { value: [0, 0, 0, 0], type: "vec4<f32>" },
    uSplatEnabled: { value: 0, type: "f32" },
    uAspect: { value: aspect, type: "f32" },
    uRadius: { value: 0.038, type: "f32" },
    uForce: { value: 0.72, type: "f32" },
    uIsVelocity: { value: 1, type: "f32" },
  });
  const splatDyeFilter = createFluidFilter(PLAYGROUND_FLUID_SPLAT_FRAGMENT, {
    uSplat: { value: [0, 0, 0, 0], type: "vec4<f32>" },
    uSplatEnabled: { value: 0, type: "f32" },
    uAspect: { value: aspect, type: "f32" },
    uRadius: { value: 0.052, type: "f32" },
    uForce: { value: 0.82, type: "f32" },
    uIsVelocity: { value: 0, type: "f32" },
  });
  const curlFilter = createFluidFilter(PLAYGROUND_FLUID_CURL_FRAGMENT, {
    uTexelSize: { value: texelSize, type: "vec2<f32>" },
  });
  const vorticityFilter = createFluidFilter(PLAYGROUND_FLUID_VORTICITY_FRAGMENT, {
    uTexelSize: { value: texelSize, type: "vec2<f32>" },
    uCurlStrength: { value: 0.022, type: "f32" },
  });
  const divergenceFilter = createFluidFilter(PLAYGROUND_FLUID_DIVERGENCE_FRAGMENT, {
    uTexelSize: { value: texelSize, type: "vec2<f32>" },
  });
  const pressureFilter = createFluidFilter(PLAYGROUND_FLUID_PRESSURE_FRAGMENT, {
    uTexelSize: { value: texelSize, type: "vec2<f32>" },
  });
  const gradientSubtractFilter = createFluidFilter(PLAYGROUND_FLUID_GRADIENT_SUBTRACT_FRAGMENT, {
    uTexelSize: { value: texelSize, type: "vec2<f32>" },
  });
  const filters = [
    advectVelocityFilter,
    advectDyeFilter,
    splatVelocityFilter,
    splatDyeFilter,
    curlFilter,
    vorticityFilter,
    divergenceFilter,
    pressureFilter,
    gradientSubtractFilter,
  ];

  const renderPass = (source: Texture, filter: Filter, target: RenderTexture) => {
    passSprite.texture = source;
    passSprite.filters = [filter];
    app.renderer.render({
      container: passStage,
      target,
      clear: true,
    });
  };

  const setSplatUniforms = (filter: FluidFilter) => {
    const uniforms = filter.uniforms.uniforms as { uSplat: number[]; uSplatEnabled: number };
    const splat = input.splat;
    uniforms.uSplat[0] = splat.x;
    uniforms.uSplat[1] = splat.y;
    uniforms.uSplat[2] = splat.vx;
    uniforms.uSplat[3] = splat.vy;
    uniforms.uSplatEnabled = splat.active ? 1 : 0;
    filter.uniforms.update();
  };

  const step = () => {
    bindTexture(advectVelocityFilter, "uVelocity", velocity.read);
    renderPass(velocity.read, advectVelocityFilter, velocity.write);
    velocity.swap();

    bindTexture(advectDyeFilter, "uVelocity", velocity.read);
    renderPass(dye.read, advectDyeFilter, dye.write);
    dye.swap();

    setSplatUniforms(splatVelocityFilter);
    renderPass(velocity.read, splatVelocityFilter, velocity.write);
    velocity.swap();

    setSplatUniforms(splatDyeFilter);
    renderPass(dye.read, splatDyeFilter, dye.write);
    dye.swap();
    input.consumeSplat();

    renderPass(velocity.read, curlFilter, curl);

    bindTexture(vorticityFilter, "uCurl", curl);
    renderPass(velocity.read, vorticityFilter, velocity.write);
    velocity.swap();

    renderPass(velocity.read, divergenceFilter, divergence);

    bindTexture(pressureFilter, "uDivergence", divergence);
    for (let iteration = 0; iteration < PLAYGROUND_FLUID_PRESSURE_ITERATIONS; iteration += 1) {
      renderPass(pressure.read, pressureFilter, pressure.write);
      pressure.swap();
    }

    bindTexture(gradientSubtractFilter, "uPressure", pressure.read);
    renderPass(velocity.read, gradientSubtractFilter, velocity.write);
    velocity.swap();
  };

  const destroy = () => {
    passSprite.destroy();
    passStage.destroy();
    filters.forEach((filter) => filter.destroy());
    velocity.destroy();
    dye.destroy();
    pressure.destroy();
    divergence.destroy(true);
    curl.destroy(true);
  };

  return {
    get texture() {
      return dye.read;
    },
    step,
    destroy,
  };
}
