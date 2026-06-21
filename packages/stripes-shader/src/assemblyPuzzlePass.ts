import { Geometry, GlProgram, Mesh, RenderTexture, Shader, Texture, UniformGroup } from "pixi.js";
import type { Renderer } from "pixi.js";

// Side length of each puzzle cell in display pixels.
export const CELL_PX = 16;

const ASSEMBLY_PUZZLE_VERTEX = `
in vec2 aClipHome;
in vec2 aHomeUV;
in vec2 aCellCenter;
in float aSeed;
out vec2 vUV;
uniform float uProgress;
uniform float uOrder;
uniform float uSpread;
uniform float uFlight;
float hash(float n){ return fract(sin(n * 127.1 + 0.37) * 43758.5453); }
void main(void){
    float h1 = hash(aSeed);
    float h2 = hash(aSeed + 57.0);
    float o;
    if (uOrder > 2.5) { o = h1; }
    else if (uOrder > 1.5) { o = aCellCenter.x; }
    else {
        float cn = clamp(length(aCellCenter - vec2(0.5)) / 0.70710678, 0.0, 1.0);
        o = uOrder > 0.5 ? 1.0 - cn : cn;
    }
    float start = o * (1.0 - uFlight) * uSpread;
    float t = uFlight <= 0.0 ? 1.0 : clamp((uProgress - start) / uFlight, 0.0, 1.0);
    float e = t * t * (3.0 - 2.0 * t);
    float ang = h2 * 6.28318530718;
    vec2 dir = vec2(cos(ang), sin(ang));
    float dist = 2.6 + h1 * 1.0;
    vec2 offset = dir * dist * (1.0 - e);
    gl_Position = vec4(aClipHome + offset, 0.0, 1.0);
    vUV = aHomeUV;
}
`;

const ASSEMBLY_PUZZLE_FRAGMENT = `
in vec2 vUV;
out vec4 finalColor;
uniform sampler2D uHomeField;
void main(void){ finalColor = vec4(vec3(texture(uHomeField, vUV).r), 1.0); }
`;

export type AssemblyPuzzleRenderOpts = {
  cols: number;
  rows: number;
  progress: number;
  order: number;
  spread: number;
  flight: number;
};

export type AssemblyPuzzlePass = {
  render(renderer: Renderer, homeFieldTexture: Texture, target: RenderTexture, opts: AssemblyPuzzleRenderOpts): void;
  ensureGrid(cols: number, rows: number): void;
  destroy(): void;
};

export function createAssemblyPuzzlePass(): AssemblyPuzzlePass {
  const uniforms = new UniformGroup({
    uProgress: { value: 0, type: "f32" },
    uOrder: { value: 0, type: "f32" },
    uSpread: { value: 0.85, type: "f32" },
    uFlight: { value: 0.32, type: "f32" },
  });

  const glProgram = GlProgram.from({
    vertex: ASSEMBLY_PUZZLE_VERTEX,
    fragment: ASSEMBLY_PUZZLE_FRAGMENT,
  });

  const shader = new Shader({
    glProgram,
    resources: {
      assemblyPuzzleUniforms: uniforms,
      uHomeField: Texture.EMPTY.source,
    },
  });

  let mesh: Mesh<Geometry, Shader> | null = null;
  let currentGeometry: Geometry | null = null;
  let lastGridKey = "";

  const ensureGrid = (cols: number, rows: number) => {
    const key = `${cols}x${rows}`;
    if (key === lastGridKey && mesh !== null) {
      return;
    }
    lastGridKey = key;
    mesh?.destroy();
    currentGeometry?.destroy(true);

    const cellCount = cols * rows;
    const vertCount = cellCount * 4;
    const indexCount = cellCount * 6;

    const clipHome = new Float32Array(vertCount * 2);
    const homeUV = new Float32Array(vertCount * 2);
    const cellCenter = new Float32Array(vertCount * 2);
    const seed = new Float32Array(vertCount);
    const indices = new Uint32Array(indexCount);

    for (let cy = 0; cy < rows; cy++) {
      for (let cx = 0; cx < cols; cx++) {
        const cellIdx = cy * cols + cx;
        const baseV = cellIdx * 4;
        const baseI = cellIdx * 6;

        // Clip-space corners: x in [-1 + 2*cx/cols, -1 + 2*(cx+1)/cols]
        // Clip-space y: top-left origin → cy=0 maps to clip y=+1 (top), cy=rows to y=-1 (bottom)
        const clipX0 = -1 + (2 * cx) / cols;
        const clipX1 = -1 + (2 * (cx + 1)) / cols;
        const clipY0 = 1 - (2 * cy) / rows; // top edge of this row in clip space
        const clipY1 = 1 - (2 * (cy + 1)) / rows; // bottom edge of this row in clip space

        // UV corners: u in [cx/cols, (cx+1)/cols], v in [cy/rows, (cy+1)/rows]
        const u0 = cx / cols;
        const u1 = (cx + 1) / cols;
        const v0 = cy / rows;
        const v1 = (cy + 1) / rows;

        const ccx = (cx + 0.5) / cols;
        const ccy = (cy + 0.5) / rows;
        const s = cellIdx;

        // Vertex 0: top-left   (clipX0, clipY0) → UV(u0, v0)
        clipHome[(baseV + 0) * 2 + 0] = clipX0;
        clipHome[(baseV + 0) * 2 + 1] = clipY0;
        homeUV[(baseV + 0) * 2 + 0] = u0;
        homeUV[(baseV + 0) * 2 + 1] = v0;

        // Vertex 1: top-right  (clipX1, clipY0) → UV(u1, v0)
        clipHome[(baseV + 1) * 2 + 0] = clipX1;
        clipHome[(baseV + 1) * 2 + 1] = clipY0;
        homeUV[(baseV + 1) * 2 + 0] = u1;
        homeUV[(baseV + 1) * 2 + 1] = v0;

        // Vertex 2: bottom-right (clipX1, clipY1) → UV(u1, v1)
        clipHome[(baseV + 2) * 2 + 0] = clipX1;
        clipHome[(baseV + 2) * 2 + 1] = clipY1;
        homeUV[(baseV + 2) * 2 + 0] = u1;
        homeUV[(baseV + 2) * 2 + 1] = v1;

        // Vertex 3: bottom-left (clipX0, clipY1) → UV(u0, v1)
        clipHome[(baseV + 3) * 2 + 0] = clipX0;
        clipHome[(baseV + 3) * 2 + 1] = clipY1;
        homeUV[(baseV + 3) * 2 + 0] = u0;
        homeUV[(baseV + 3) * 2 + 1] = v1;

        for (let v = 0; v < 4; v++) {
          cellCenter[(baseV + v) * 2 + 0] = ccx;
          cellCenter[(baseV + v) * 2 + 1] = ccy;
          seed[baseV + v] = s;
        }

        // Two triangles: 0-1-2 and 0-2-3
        indices[baseI + 0] = baseV + 0;
        indices[baseI + 1] = baseV + 1;
        indices[baseI + 2] = baseV + 2;
        indices[baseI + 3] = baseV + 0;
        indices[baseI + 4] = baseV + 2;
        indices[baseI + 5] = baseV + 3;
      }
    }

    currentGeometry = new Geometry({
      attributes: {
        aClipHome: { buffer: clipHome, format: "float32x2", stride: 8, offset: 0 },
        aHomeUV: { buffer: homeUV, format: "float32x2", stride: 8, offset: 0 },
        aCellCenter: { buffer: cellCenter, format: "float32x2", stride: 8, offset: 0 },
        aSeed: { buffer: seed, format: "float32", stride: 4, offset: 0 },
      },
      indexBuffer: indices,
    });

    mesh = new Mesh({ geometry: currentGeometry, shader });
  };

  return {
    render(renderer, homeFieldTexture, target, opts) {
      const { cols, rows, progress, order, spread, flight } = opts;
      ensureGrid(cols, rows);
      if (!mesh) return;
      const u = uniforms.uniforms as { uProgress: number; uOrder: number; uSpread: number; uFlight: number };
      u.uProgress = progress;
      u.uOrder = order;
      u.uSpread = spread;
      u.uFlight = flight;
      uniforms.update();
      shader.resources.uHomeField = homeFieldTexture.source;
      renderer.render({ container: mesh, target, clear: true });
    },
    ensureGrid,
    destroy() {
      mesh?.destroy();
      currentGeometry?.destroy(true);
      mesh = null;
      currentGeometry = null;
      shader.destroy(true);
    },
  };
}
