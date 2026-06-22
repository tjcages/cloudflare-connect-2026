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
out float vFade;
uniform float uProgress;
uniform float uDurationMs;
uniform float uSpeedMinMs;
uniform float uSpeedMaxMs;
uniform float uStaggerMs;
float hash(float n){ return fract(sin(n * 127.1 + 0.37) * 43758.5453); }
// CSS cubic-bezier easing: solve x(s)=t (Newton), return y(s). Control points P1(x1,y1), P2(x2,y2).
float bezierAxis(float a1, float a2, float s) {
    float c = 3.0 * a1;
    float b = 3.0 * (a2 - a1) - c;
    float a = 1.0 - c - b;
    return ((a * s + b) * s + c) * s;
}
float bezierSlope(float a1, float a2, float s) {
    float c = 3.0 * a1;
    float b = 3.0 * (a2 - a1) - c;
    float a = 1.0 - c - b;
    return (3.0 * a * s + 2.0 * b) * s + c;
}
float cubicBezier(float t, float x1, float y1, float x2, float y2) {
    float s = t;
    for (int i = 0; i < 5; i++) {
        float dx = bezierAxis(x1, x2, s) - t;
        float d = bezierSlope(x1, x2, s);
        if (abs(d) < 0.00001) break;
        s = clamp(s - dx / d, 0.0, 1.0);
    }
    return bezierAxis(y1, y2, s);
}
void main(void){
    float h1 = hash(aSeed);
    float h2 = hash(aSeed + 19.0);
    float h3 = hash(aSeed + 37.0);
    float h4 = hash(aSeed + 53.0);
    float dur = max(uDurationMs, 1.0);
    float o = h1;
    float cellTotal = clamp(mix(uSpeedMinMs, uSpeedMaxMs, h2) / dur, 0.05, 0.98);
    float start = (uStaggerMs / dur) * o;
    float t = clamp((uProgress - start) / cellTotal, 0.0, 1.0);
    float e = cubicBezier(t, 0.33, 1.0, 0.68, 1.0);
    vec2 ch = vec2(aCellCenter.x * 2.0 - 1.0, 1.0 - aCellCenter.y * 2.0);
    float clen = max(length(ch), 0.0001);
    vec2 outward = clen > 0.2 ? ch / clen : vec2(cos(h3 * 6.2831853), sin(h3 * 6.2831853));
    float jitter = (h4 - 0.5) * 1.4;
    float cj = cos(jitter);
    float sj = sin(jitter);
    vec2 dir = vec2(outward.x * cj - outward.y * sj, outward.x * sj + outward.y * cj);
    vec2 g = vec2(dir.x >= 0.0 ? max(dir.x, 0.001) : min(dir.x, -0.001), dir.y >= 0.0 ? max(dir.y, 0.001) : min(dir.y, -0.001));
    vec2 tA = (vec2(1.0) - ch) / g;
    vec2 tB = (vec2(-1.0) - ch) / g;
    float exitDist = min(max(tA.x, tB.x), max(tA.y, tB.y));
    float spawnDist = exitDist + 0.12;
    vec2 offset = dir * spawnDist * (1.0 - e);
    gl_Position = vec4(aClipHome + offset, 0.0, 1.0);
    vUV = aHomeUV;
    vCorner = aCorner;
    vSoft = 1.0 - smoothstep(0.7, 1.0, t);
    vFade = smoothstep(0.0, 0.4, t);
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
in float vFade;
out vec4 finalColor;
uniform sampler2D uHomeField;
void main(void){
    float c = texture(uHomeField, vUV).r;
    // In flight each cell is a smooth radial-gradient circle; as it nears home the shape
    // fills out to the full sharp square tile so the field reassembles seamlessly.
    float softFactor = clamp(vSoft, 0.0, 1.0); // 1 = full radial circle, 0 = sharp square
    if (softFactor > 0.001) {
        float r = length(vCorner - vec2(0.5)) * 2.0;  // 0 at center, 1 at edge midpoint
        // Defined core with a crisper (still smooth) edge — sharper than a wide gaussian.
        float radial = 1.0 - smoothstep(0.25, 0.85, r);
        c *= mix(1.0, radial, softFactor);
    }
    finalColor = vec4(c, c, c, c) * vFade;
}
`;

export type AssemblyPuzzleRenderOpts = {
  cols: number;
  rows: number;
  progress: number;
  durationMs: number;
  speedMinMs: number;
  speedMaxMs: number;
  staggerMs: number;
};

export type AssemblyPuzzlePass = {
  render(renderer: Renderer, homeFieldTexture: Texture, target: RenderTexture, opts: AssemblyPuzzleRenderOpts): void;
  ensureGrid(cols: number, rows: number): void;
  destroy(): void;
};

export function createAssemblyPuzzlePass(): AssemblyPuzzlePass {
  const uniforms = new UniformGroup({
    uProgress: { value: 0, type: "f32" },
    uDurationMs: { value: 2600, type: "f32" },
    uSpeedMinMs: { value: 300, type: "f32" },
    uSpeedMaxMs: { value: 1600, type: "f32" },
    uStaggerMs: { value: 900, type: "f32" },
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
      const { cols, rows, progress, durationMs, speedMinMs, speedMaxMs, staggerMs } = opts;
      ensureGrid(cols, rows);
      if (!mesh) return;
      const u = uniforms.uniforms as {
        uProgress: number;
        uDurationMs: number;
        uSpeedMinMs: number;
        uSpeedMaxMs: number;
        uStaggerMs: number;
      };
      u.uProgress = progress;
      u.uDurationMs = durationMs;
      u.uSpeedMinMs = speedMinMs;
      u.uSpeedMaxMs = speedMaxMs;
      u.uStaggerMs = staggerMs;
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
