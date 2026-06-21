import { GlProgram, Mesh, MeshGeometry, RenderTexture, Shader, Texture, UniformGroup } from "pixi.js";
import type { Renderer } from "pixi.js";

const FIELD_DOWNSAMPLE_TAPS = 6;

const FIELD_DOWNSAMPLE_VERTEX = `
in vec2 aPosition;
in vec2 aUV;
out vec2 vUV;

void main(void) {
    vUV = aUV;
    gl_Position = vec4(aPosition.x * 2.0 - 1.0, 1.0 - aPosition.y * 2.0, 0.0, 1.0);
}
`;

const FIELD_DOWNSAMPLE_FRAGMENT = `
in vec2 vUV;
out vec4 finalColor;

uniform sampler2D uField;
uniform float uCols;
uniform float uRows;

void main(void) {
    float col = floor(vUV.x * uCols);
    float row = floor(vUV.y * uRows);

    float uMin = col / uCols;
    float uMax = (col + 1.0) / uCols;
    float vMin = row / uRows;
    float vMax = (row + 1.0) / uRows;

    float sum = 0.0;
    float taps = float(${FIELD_DOWNSAMPLE_TAPS});

    for (int ty = 0; ty < ${FIELD_DOWNSAMPLE_TAPS}; ty++) {
        for (int tx = 0; tx < ${FIELD_DOWNSAMPLE_TAPS}; tx++) {
            float uf = uMin + (float(tx) + 0.5) / taps * (uMax - uMin);
            float vf = vMin + (float(ty) + 0.5) / taps * (vMax - vMin);
            sum += texture(uField, vec2(uf, vf)).r;
        }
    }

    float mean = sum / (taps * taps);
    finalColor = vec4(mean, mean, mean, 1.0);
}
`;

const QUAD_POSITIONS = new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]);
const QUAD_UVS = new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]);
const QUAD_INDICES = new Uint32Array([0, 1, 2, 0, 2, 3]);

/**
 * Pure-TS helper that computes the UV coordinate for a single tap within a cell footprint.
 * The tap grid is NxN evenly spaced samples with half-texel offsets, positioned within the
 * cell's UV footprint [col/cols, (col+1)/cols] x [row/rows, (row+1)/rows].
 * This is the TypeScript mirror of the GLSL box-average math in FIELD_DOWNSAMPLE_FRAGMENT.
 */
export function cellTapUv(
  col: number,
  row: number,
  tapX: number,
  tapY: number,
  cols: number,
  rows: number,
  taps: number,
): { u: number; v: number } {
  const uMin = col / cols;
  const uMax = (col + 1) / cols;
  const vMin = row / rows;
  const vMax = (row + 1) / rows;
  const u = uMin + ((tapX + 0.5) / taps) * (uMax - uMin);
  const v = vMin + ((tapY + 0.5) / taps) * (vMax - vMin);
  return { u, v };
}

export type FieldDownsample = {
  render(renderer: Renderer, fieldTexture: Texture, target: RenderTexture, cols: number, rows: number): void;
  destroy(): void;
};

/**
 * Creates a GPU box-average pass that reduces a display-sized field texture to a cols×rows
 * RenderTexture where each output texel R = the mean of the field over that cell's footprint.
 * Uses a constant 6×6 tap grid; WebGL1-safe (GLSL ES 1.00, constant-bound loops, float ops).
 */
export function createFieldDownsample(): FieldDownsample {
  const uniforms = new UniformGroup({
    uCols: { value: 1, type: "f32" },
    uRows: { value: 1, type: "f32" },
  });

  const glProgram = GlProgram.from({
    vertex: FIELD_DOWNSAMPLE_VERTEX,
    fragment: FIELD_DOWNSAMPLE_FRAGMENT,
  });

  const geometry = new MeshGeometry({
    positions: QUAD_POSITIONS,
    uvs: QUAD_UVS,
    indices: QUAD_INDICES,
  });

  const shader = new Shader({
    glProgram,
    resources: {
      fieldDownsampleUniforms: uniforms,
      uField: Texture.EMPTY.source,
    },
  });

  const mesh = new Mesh({ geometry, shader });

  return {
    render(renderer, fieldTexture, target, cols, rows) {
      const u = uniforms.uniforms as { uCols: number; uRows: number };
      u.uCols = Math.max(1, cols);
      u.uRows = Math.max(1, rows);
      uniforms.update();
      shader.resources.uField = fieldTexture.source;
      renderer.render({ container: mesh, target, clear: true });
    },
    destroy() {
      mesh.destroy();
      shader.destroy(true);
      geometry.destroy();
    },
  };
}
