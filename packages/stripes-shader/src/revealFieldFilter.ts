import { Filter, GlProgram, UniformGroup } from "pixi.js";
import { ASSEMBLY_ORDER_TO_INDEX, type PlaygroundRevealConfig } from "./playgroundRevealConfig";
import { resolvePlaygroundRevealDurationMs } from "./playgroundRevealConfig";
import { resolveWaveRevealGeometry } from "./playgroundReveal";
import { STRIPE_FILTER_VERTEX } from "./stripeFilterShaders";

// Reveal as a field -> field pass (docs/render-pipeline-architecture.md, R3): masks the render
// field toward black where a cell has not yet been revealed, so reveal is visible with stripes
// ON or OFF and in the Field debug stage. The mask math mirrors the stripe shader's reveal block
// exactly (wave + assembly) so both agree. WebGL1-safe (R6): no integer abs/min/max.
export const REVEAL_FIELD_FILTER_FRAGMENT = `
in vec2 vTextureCoord;
in vec2 vDisplayCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform float uRevealMode;
uniform float uRevealProgress;
uniform vec2 uRevealOrigin;
uniform float uRevealMaxDistance;
uniform float uRevealSoftness;
uniform float uRevealWaviness;
uniform float uRevealNoiseScale;
uniform float uRevealBandRamp;
uniform float uRevealOrder;
uniform float uRevealSpread;
uniform float uRevealFlight;
uniform vec2 uPixelSize;
uniform vec2 uCellSize;
uniform vec2 uGridSize;

// Mirrors revealCellNoise() in stripeFilterShaders.ts and cellNoise() in playgroundReveal.ts.
float revealCellNoise(float col, float row, float scale) {
    float s = max(0.1, scale);
    vec2 p = vec2(floor(col / s), floor(row / s));
    vec3 p3 = fract(vec3(p.x, p.y, p.x) * vec3(0.1031, 0.1030, 0.0973));
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

void main(void) {
    float field = texture(uTexture, vTextureCoord).r;
    float revealMask = 1.0;
    if (uRevealMode > 0.5) {
        vec2 pixelCoord = vDisplayCoord * uPixelSize;
        float cw = max(uCellSize.x, 1.0);
        float ch = max(uCellSize.y, 1.0);
        float colIndex = floor(pixelCoord.x / cw);
        float rowIndex = floor(pixelCoord.y / ch);
        if (uRevealMode > 1.5) {
            float cols = max(uGridSize.x, 1.0);
            float rows = max(uGridSize.y, 1.0);
            float o;
            if (uRevealOrder > 2.5) {
                o = revealCellNoise(colIndex, rowIndex, 1.0);
            } else if (uRevealOrder > 1.5) {
                o = cols <= 1.0 ? 0.0 : clamp(colIndex / (cols - 1.0), 0.0, 1.0);
            } else {
                float cx = cols <= 1.0 ? 0.5 : (colIndex + 0.5) / cols;
                float cy = rows <= 1.0 ? 0.5 : (rowIndex + 0.5) / rows;
                float centerNorm = clamp(length(vec2(cx - 0.5, cy - 0.5)) / 0.70710678, 0.0, 1.0);
                o = uRevealOrder > 0.5 ? 1.0 - centerNorm : centerNorm;
            }
            float arrival = o * (1.0 - uRevealFlight) * uRevealSpread + uRevealFlight;
            revealMask = smoothstep(arrival, arrival + uRevealBandRamp, uRevealProgress);
        } else {
            vec2 cellUvPos = vec2((colIndex + 0.5) / uGridSize.x, (rowIndex + 0.5) / uGridSize.y);
            float normalizedDistance = length(cellUvPos - uRevealOrigin) / uRevealMaxDistance;
            float edgeNoise = (revealCellNoise(colIndex, rowIndex, uRevealNoiseScale) - 0.5) * uRevealWaviness;
            float softness = max(uRevealSoftness, 0.0001);
            revealMask = smoothstep(
                normalizedDistance - softness,
                normalizedDistance + softness + uRevealBandRamp,
                uRevealProgress + edgeNoise
            );
        }
    }
    finalColor = vec4(vec3(field * revealMask), 1.0);
}
`;

export type RevealFieldFilter = Filter & {
  syncReveal: (config: PlaygroundRevealConfig | null, progress: number) => void;
  syncGrid: (
    cols: number,
    rows: number,
    cellWidth: number,
    cellHeight: number,
    displayWidth: number,
    displayHeight: number,
  ) => void;
};

export function createRevealFieldFilter(): RevealFieldFilter {
  const uniforms = new UniformGroup({
    uRevealMode: { value: 0, type: "f32" },
    uRevealProgress: { value: 1, type: "f32" },
    uRevealOrigin: { value: [0.5, 0.5], type: "vec2<f32>" },
    uRevealMaxDistance: { value: 1, type: "f32" },
    uRevealSoftness: { value: 0, type: "f32" },
    uRevealWaviness: { value: 0, type: "f32" },
    uRevealNoiseScale: { value: 4, type: "f32" },
    uRevealBandRamp: { value: 0.18, type: "f32" },
    uRevealOrder: { value: 0, type: "f32" },
    uRevealSpread: { value: 0.85, type: "f32" },
    uRevealFlight: { value: 0.22, type: "f32" },
    uPixelSize: { value: [1, 1], type: "vec2<f32>" },
    uCellSize: { value: [1, 1], type: "vec2<f32>" },
    uGridSize: { value: [1, 1], type: "vec2<f32>" },
  });

  const filter = new Filter({
    glProgram: GlProgram.from({
      vertex: STRIPE_FILTER_VERTEX,
      fragment: REVEAL_FIELD_FILTER_FRAGMENT,
    }),
    clipToViewport: false,
    padding: 0,
    resources: { revealFieldUniforms: uniforms },
  }) as RevealFieldFilter;

  filter.syncGrid = (cols, rows, cellWidth, cellHeight, displayWidth, displayHeight) => {
    const u = uniforms.uniforms as { uGridSize: number[]; uCellSize: number[]; uPixelSize: number[] };
    u.uGridSize[0] = Math.max(1, cols);
    u.uGridSize[1] = Math.max(1, rows);
    u.uCellSize[0] = Math.max(1, cellWidth);
    u.uCellSize[1] = Math.max(1, cellHeight);
    u.uPixelSize[0] = Math.max(1, displayWidth);
    u.uPixelSize[1] = Math.max(1, displayHeight);
    uniforms.update();
  };

  filter.syncReveal = (config, progress) => {
    const u = uniforms.uniforms as {
      uRevealMode: number;
      uRevealProgress: number;
      uRevealOrigin: number[];
      uRevealMaxDistance: number;
      uRevealSoftness: number;
      uRevealWaviness: number;
      uRevealNoiseScale: number;
      uRevealBandRamp: number;
      uRevealOrder: number;
      uRevealSpread: number;
      uRevealFlight: number;
    };
    if (!config) {
      u.uRevealMode = 0;
      u.uRevealProgress = 1;
      uniforms.update();
      return;
    }
    u.uRevealProgress = progress;
    u.uRevealBandRamp = Math.min(0.4, Math.max(0.04, 330 / Math.max(1, resolvePlaygroundRevealDurationMs(config))));
    if (config.type === "assembly") {
      u.uRevealMode = 2;
      u.uRevealOrder = ASSEMBLY_ORDER_TO_INDEX[config.assembly.order];
      u.uRevealSpread = Math.max(0, config.assembly.spread);
      u.uRevealFlight = Math.max(0, config.assembly.flight);
      uniforms.update();
      return;
    }
    u.uRevealMode = 1;
    const geometry = resolveWaveRevealGeometry(config.wave.position);
    u.uRevealOrigin[0] = geometry.x;
    u.uRevealOrigin[1] = geometry.y;
    u.uRevealMaxDistance = geometry.maxDistance;
    u.uRevealSoftness = Math.max(0, config.wave.softness);
    u.uRevealWaviness = config.wave.waviness;
    u.uRevealNoiseScale = config.wave.noiseScale;
    uniforms.update();
  };

  return filter;
}
