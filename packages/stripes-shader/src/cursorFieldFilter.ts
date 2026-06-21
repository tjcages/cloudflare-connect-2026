import { Filter, GlProgram, Texture, UniformGroup } from "pixi.js";
import { STRIPE_FILTER_VERTEX } from "./stripeFilterShaders";

// Cursor trail + click-wave as a field -> field pass (docs/render-pipeline-architecture.md, R3):
// paints the field toward white where the cursor wake touched (trail.a) and warps it in
// screen space by the push offset, so click/trail are visible on the field with stripes ON or
// OFF. Mirrors the stripe shader's trail/push math exactly (tear thins, trail-alpha paints,
// source sampled displaced by the push offset). WebGL1-safe (R6): float ops only.
export const CURSOR_FIELD_FILTER_FRAGMENT = `
in vec2 vTextureCoord;
in vec2 vDisplayCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform sampler2D uCursorTrail;
uniform sampler2D uCursorTrailPush;
uniform float uCursorTrailEnabled;
uniform float uCursorTrailPushEnabled;
uniform float uCursorTrailPushRange;
uniform float uOverlayInvert;
uniform vec2 uPixelSize;
uniform vec2 uCellSize;
uniform vec2 uGridSize;

void main(void) {
    vec2 pixelCoord = vDisplayCoord * uPixelSize;
    float colIndex = floor(pixelCoord.x / max(uCellSize.x, 1.0));
    float rowIndex = floor(pixelCoord.y / max(uCellSize.y, 1.0));
    // Cursor data textures are stored display top-left, one texel per cell (flameCellUv).
    vec2 cuv = vec2((colIndex + 0.5) / max(uGridSize.x, 1.0), (rowIndex + 0.5) / max(uGridSize.y, 1.0));

    vec4 trail = uCursorTrailEnabled > 0.5 ? texture(uCursorTrail, cuv) : vec4(0.0);
    vec3 push = uCursorTrailPushEnabled > 0.5
        ? texture(uCursorTrailPush, cuv).rgb
        : vec3(128.0 / 255.0, 128.0 / 255.0, 0.0);
    // Byte 128 = zero offset (matches the 127-step biased encoding in CursorTrailOverlay). Offset is in cells.
    vec2 offset = (push.xy * 255.0 - 128.0) / 127.0 * uCursorTrailPushRange;
    float tear = push.z;

    // Screen-space warp: pull the field from the displaced position (cells -> UV).
    vec2 offsetUv = offset * uCellSize / uPixelSize;
    float field = texture(uTexture, vTextureCoord - offsetUv).r;

    bool inverted = uOverlayInvert > 0.5;
    // Tear thins toward background; trail alpha paints toward white. Mirrors the stripe shader.
    if (inverted) {
        field += (1.0 - field) * tear;
    } else {
        field *= (1.0 - tear);
    }
    float trailLift = trail.a;
    if (inverted) {
        field *= (1.0 - trailLift);
    } else {
        field += (1.0 - field) * trailLift;
    }
    finalColor = vec4(vec3(clamp(field, 0.0, 1.0)), 1.0);
}
`;

export type CursorFieldFilter = Filter & {
  syncCursorTrail: (trail: Texture | null, pushTexture: Texture | null, pushRange: number) => void;
  syncGrid: (
    cols: number,
    rows: number,
    cellWidth: number,
    cellHeight: number,
    displayWidth: number,
    displayHeight: number,
  ) => void;
  syncOverlayInvert: (inverted: boolean) => void;
};

export function createCursorFieldFilter(): CursorFieldFilter {
  const uniforms = new UniformGroup({
    uCursorTrailEnabled: { value: 0, type: "f32" },
    uCursorTrailPushEnabled: { value: 0, type: "f32" },
    uCursorTrailPushRange: { value: 0, type: "f32" },
    uOverlayInvert: { value: 0, type: "f32" },
    uPixelSize: { value: [1, 1], type: "vec2<f32>" },
    uCellSize: { value: [1, 1], type: "vec2<f32>" },
    uGridSize: { value: [1, 1], type: "vec2<f32>" },
  });

  let currentTrail = Texture.EMPTY;
  let currentPush = Texture.EMPTY;

  const filter = new Filter({
    glProgram: GlProgram.from({
      vertex: STRIPE_FILTER_VERTEX,
      fragment: CURSOR_FIELD_FILTER_FRAGMENT,
    }),
    clipToViewport: false,
    padding: 0,
    resources: {
      cursorFieldUniforms: uniforms,
      uCursorTrail: Texture.EMPTY.source,
      uCursorTrailPush: Texture.EMPTY.source,
    },
  }) as CursorFieldFilter;

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

  filter.syncOverlayInvert = (inverted) => {
    (uniforms.uniforms as { uOverlayInvert: number }).uOverlayInvert = inverted ? 1 : 0;
    uniforms.update();
  };

  filter.syncCursorTrail = (trail, pushTexture, pushRange) => {
    currentTrail = trail ?? Texture.EMPTY;
    currentPush = pushTexture ?? Texture.EMPTY;
    if (trail) {
      trail.source.style.scaleMode = "nearest";
    }
    if (pushTexture) {
      pushTexture.source.style.scaleMode = "nearest";
    }
    filter.resources.uCursorTrail = currentTrail.source;
    filter.resources.uCursorTrailPush = currentPush.source;
    const u = uniforms.uniforms as {
      uCursorTrailEnabled: number;
      uCursorTrailPushEnabled: number;
      uCursorTrailPushRange: number;
    };
    u.uCursorTrailEnabled = trail ? 1 : 0;
    u.uCursorTrailPushEnabled = pushTexture ? 1 : 0;
    u.uCursorTrailPushRange = pushRange;
    uniforms.update();
  };

  return filter;
}
