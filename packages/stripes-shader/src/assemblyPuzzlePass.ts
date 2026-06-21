import { Geometry, GlProgram, Mesh, RenderTexture, Shader, Texture, UniformGroup } from "pixi.js";
import type { Renderer } from "pixi.js";

// Side length of each puzzle cell in display pixels.
export const CELL_PX = 28;

const ASSEMBLY_PUZZLE_VERTEX = `
in vec2 aClipHome;
in vec2 aHomeUV;
in vec2 aCellCenter;
in vec2 aCorner;
in float aSeed;
out vec2 vUV;
out vec2 vCorner;
out float vSoft;
uniform float uProgress;
uniform float uOrder;
uniform float uSpread;
uniform float uFlight;
float hash(float n){ return fract(sin(n * 127.1 + 0.37) * 43758.5453); }
void main(void){
    float h1 = hash(aSeed);
    float o;
    if (uOrder > 2.5) { o = h1; }
    else if (uOrder > 1.5) { o = aCellCenter.x; }
    else {
        float cn = clamp(length(aCellCenter - vec2(0.5)) / 0.70710678, 0.0, 1.0);
        o = uOrder > 0.5 ? 1.0 - cn : cn;
    }
    float start = o * (1.0 - uFlight) * uSpread;
    float arrival = start + uFlight;
    float t = uFlight <= 0.0 ? 1.0 : clamp((uProgress - start) / uFlight, 0.0, 1.0);
    float e = t * t * (3.0 - 2.0 * t);
    // Enter from the NEAREST canvas edge (shortest path in), not a random direction:
    // pick whichever of the cell's home edges (left/right vs top/bottom) is closer, and
    // start just past it. Edge cells barely move; center cells slide in from their side.
    vec2 ch = vec2(aCellCenter.x * 2.0 - 1.0, 1.0 - aCellCenter.y * 2.0); // home center in clip
    float dx = ch.x > 0.0 ? (1.0 - ch.x) : (ch.x + 1.0); // distance to nearest left/right edge
    float dy = ch.y > 0.0 ? (1.0 - ch.y) : (ch.y + 1.0); // distance to nearest top/bottom edge
    vec2 spawnDir = dx < dy
        ? vec2(ch.x > 0.0 ? 1.0 : -1.0, 0.0)
        : vec2(0.0, ch.y > 0.0 ? 1.0 : -1.0);
    float spawnDist = min(dx, dy) + 0.3; // push just past the nearest edge, off-screen
    vec2 offset = spawnDir * spawnDist * (1.0 - e);
    gl_Position = vec4(aClipHome + offset, 0.0, 1.0);
    vUV = aHomeUV;
    vCorner = aCorner;
    // Stay a full smooth circle for the ENTIRE flight; only AFTER the cell lands (arrival)
    // does it sharpen, over a short settle window, into the crisp square tile.
    float settleT = clamp((uProgress - arrival) / 0.15, 0.0, 1.0);
    vSoft = 1.0 - settleT; // 1 = full circle (whole flight + landing), 0 = sharp (settled)
}
`;

// Each cell contributes WHITE weighted by the field value (premultiplied), drawn with
// additive blending: black/background (0) contributes nothing (ignored), a half-white cell
// contributes 0.5 white, and overlapping cells STACK toward white instead of overwriting
// (so flying cells never erase already-landed content).
const ASSEMBLY_PUZZLE_FRAGMENT = `
in vec2 vUV;
in vec2 vCorner;
in float vSoft;
out vec4 finalColor;
uniform sampler2D uHomeField;
void main(void){
    float c = texture(uHomeField, vUV).r;
    // In flight each cell is a smooth radial-gradient circle; as it nears home the shape
    // fills out to the full sharp square tile so the field reassembles seamlessly.
    float softFactor = clamp(vSoft, 0.0, 1.0); // 1 = full radial circle, 0 = sharp square
    if (softFactor > 0.001) {
        float r = length(vCorner - vec2(0.5)) * 2.0;  // 0 at center, 1 at edge midpoint
        float radial = exp(-2.5 * r * r);               // smooth gaussian glow (no hard rim)
        c *= mix(1.0, radial, softFactor);
    }
    finalColor = vec4(c, c, c, c);
}
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
    const corner = new Float32Array(vertCount * 2);
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

        // UV corners: u in [cx/cols, (cx+1)/cols]. The home field is a RenderTexture sampled
        // raw (bottom-up), so v is flipped: the screen-top row (cy=0) samples the field top.
        const u0 = cx / cols;
        const u1 = (cx + 1) / cols;
        const v0 = 1 - cy / rows;
        const v1 = 1 - (cy + 1) / rows;

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

        // Per-vertex cell-local corner (0..1): TL, TR, BR, BL — for edge feathering.
        const corners = [0, 0, 1, 0, 1, 1, 0, 1];
        for (let v = 0; v < 4; v++) {
          cellCenter[(baseV + v) * 2 + 0] = ccx;
          cellCenter[(baseV + v) * 2 + 1] = ccy;
          corner[(baseV + v) * 2 + 0] = corners[v * 2]!;
          corner[(baseV + v) * 2 + 1] = corners[v * 2 + 1]!;
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
        aCorner: { buffer: corner, format: "float32x2", stride: 8, offset: 0 },
        aSeed: { buffer: seed, format: "float32", stride: 4, offset: 0 },
      },
      indexBuffer: indices,
    });

    mesh = new Mesh({ geometry: currentGeometry, shader });
    mesh.blendMode = "add";
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
      // Clear to OPAQUE black: gaps where no cell has landed are field background (hide),
      // not transparent (which would show the page through in the stripes-off field view).
      renderer.render({ container: mesh, target, clear: true, clearColor: [0, 0, 0, 1] });
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
