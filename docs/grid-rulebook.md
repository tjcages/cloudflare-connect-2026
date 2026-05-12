# Seeded Grid Rulebook

This document defines the rules for generating deterministic random grid artwork made from `40x40` and `80x80` rectangular cells. The goal is to keep every output visually consistent, easy to validate, and easy for future agents to extend without weakening the core geometry rules.

The reference images are visual inspiration only. The generator should create the same family of thin-line, irregular grid compositions, not copy a fixed layout.

## Core Vocabulary

- **Base unit:** `40px`. Every logical coordinate and size is expressed in base-grid units.
- **Small cell:** `1x1` base units, rendered as `40x40`.
- **Large cell:** `2x2` base units, rendered as `80x80`.
- **Overlay small cell:** a decorative `40x40` cell rendered on top of an `80x80` cell.
- **Logical canvas grid:** an imaginary rectangular grid of `40px` slots. Requested `canvasWidth` and `canvasHeight` are rounded to the nearest multiples of `40`.
- **Render viewport:** the visible drawing surface. It is `logicalWidth + 1px` by `logicalHeight + 1px` so centered strokes at the outer edges are not clipped.
- **Occupied footprint:** the base-grid slots covered by a generated cell.
- **Visual cell:** one rendered rectangle with exactly four outer borders and empty interior.
- **Gap mask:** user-painted base-grid slots that generation must not occupy. These are useful for title/content holes, like a bottom-left text area.
- **Seed:** deterministic input controlling all random decisions.

## Hard Invariants

These rules must always be true. If a candidate placement breaks one, reject the candidate.

- All `40x40` cells must have `x`, `y`, `width`, and `height` as multiples of `40`.
- All `80x80` cells must have `x` and `y` as multiples of `80`.
- Generated top-level cells must be either `40x40` or `80x80`.
- Every rendered cell must be a closed rectangle with four sides.
- No generated rectangle may partially overlap another generated rectangle.
- No generated rectangle may occupy a gap-mask slot.
- No generated rectangle may extend outside the rounded logical canvas bounds.
- Generated cells should form one composition connected through edges or corners, not scattered disconnected islands.
- The renderer must draw each visual cell as its own centered `1px` stroked rectangle using `#F3F3F3` on a white canvas.
- The same seed and same normalized config must always produce the same output rectangles in the same order.

## Stroke Rendering Rule

The generator must keep all cell geometry on the logical `40px` grid. Stroke correction belongs only to the renderer.

- Logical width and height are rounded to the nearest multiple of `40`.
- Render width is `logicalWidth + 1`.
- Render height is `logicalHeight + 1`.
- Each rectangle is drawn with a `1px` centered stroke.
- Each rectangle's rendered position is inset by `0.5px`: draw `(x + 0.5, y + 0.5, width, height)`.
- Adjacent rectangles overlap their centered strokes by `0.5px` each, so shared edges look like a single `1px` line instead of a `2px` line.
- Outer-edge strokes remain fully visible because the viewport has the extra `1px` buffer.
- Validation checks logical geometry only; render offsets must never be written back into generated cell data.

Example SVG rendering rule:

```tsx
<svg width={logicalWidth + 1} height={logicalHeight + 1}>
  {cells.map((cell) => (
    <rect
      key={cell.id}
      x={cell.x + 0.5}
      y={cell.y + 0.5}
      width={cell.width}
      height={cell.height}
      fill="none"
      stroke="#F3F3F3"
      strokeWidth={1}
    />
  ))}
</svg>
```

## Visual Consistency Rule

The output should never visually read as unsupported rectangle sizes such as `80x40`, `120x40`, `120x80`, or `40x160`. Those shapes can accidentally appear when multiple valid cells line up in a way that reads as one bigger unsupported block.

Use a cell boundary integrity check during placement:

- A `40x40` cell must not touch another `40x40` cell edge-to-edge, because two small cells can visually merge into an unsupported `80x40` or `40x80` rectangle.
- A `40x40` cell may corner-touch another `40x40` cell.
- A `40x40` cell may edge-touch an `80x80` cell.
- An `80x80` cell may touch other cells edge-to-edge only when the shared edge aligns cleanly to base-grid boundaries.
- Smaller cells may be placed at corners or along the outside of larger cells, but they must remain complete `40x40` visual cells.
- Corner-only contact is allowed and encouraged for sparse extensions, as long as the overall composition still reads as one connected grid.
- A group of adjacent cells should not visually imply a new unsupported rectangle size unless the individual four-sided borders remain clear.
- If a placement would create an ambiguous unsupported visual block, reject it and try another candidate.

The first implementation should enforce this conservatively. It is better to leave sparse whitespace than to force a placement that reads as an invalid shape.

## Density And Gap Rules

The generator should not try to fill the available canvas. Natural holes and missing corners are part of the visual language.

- Target density should stay intentionally sparse by default.
- A valid candidate may still be skipped to preserve open space.
- Empty space should be distributed; avoid leaving an entire quadrant, especially the upper-right, completely blank unless blocked by the gap mask.
- Prefer corner/diagonal continuity over repeated side-by-side filling when both are possible.
- Reject or heavily down-rank candidates that touch the existing footprint on many sides, because high-contact placements make the result read like one large grid block.
- Avoid long runs of tightly packed `40x40` cells that read like a filled tiled sheet.
- Diagonal chains of base `40x40` cells must not exceed 3 cells.
- A diagonal small-cell chain resets when the continuity is interrupted by an `80x80` cell or empty space.
- If four `40x40` cells form a dense `2x2` block near the composition edge, prefer removing one corner when connectivity remains valid.
- Corner removals should be deterministic from the seed.
- Edge protrusions and corner-connected branches are preferred over fully filled rectangular masses.
- User-defined gap masks remain hard exclusions; natural gaps are additional generator choices.

## Large Cell Distribution Rules

`80x80` cells should feel distributed throughout the composition rather than stacked into one block.

- Prefer some `80x80` cells on the top or bottom canvas edge so they feel like connectors entering from outside the visible area.
- Top and bottom edge connectors should still be normal `80x80` cells aligned to the `40px` base grid.
- Edge connectors are placement bias, not permission to create disconnected islands.
- Allow some `80x80` cells to sit side-by-side so larger chunks can replace visually busy groups of many small rects.
- Still avoid turning `80x80` cells into one dense rectangular block.
- Prefer mixing `80x80` cells with nearby `40x40` cells, whitespace, and corner connections.
- Large-cell ratio is a target tendency, not permission to create a dense large-cell cluster.
- If a large-cell placement would create a heavy block of adjacent large cells, skip it most of the time and try a smaller or more distant candidate.

## Nested And Decorative Cells

The reference style allows small rectangles to appear near larger rectangles and sometimes visually inside larger regions.

- Decorative small cells are real `40x40` closed rectangles.
- Preferred decorative positions are corners, edge-adjacent positions, sparse protrusions, and isolated accents.
- Small cells may be rendered over `80x80` cells only as `overlaySmall` cells.
- Overlay cells must sit fully inside a single `80x80` cell.
- Each `80x80` cell may receive a random `0..4` overlay cells.
- If an overlay cell is added inside an `80x80` cell, add a valid outside `40x40` companion next to it by side or diagonal contact.
- If no valid outside companion exists, skip that overlay.
- Overlay cells are drawn after base cells.
- Overlay cells do not count as regular occupancy and do not weaken the no-overlap rule for base cells.
- Decorative cells can later be controlled by a config such as `decorativeCellChance`.

This keeps regular grid generation clean while still allowing the small-over-large details from the reference style.

## Gap Mask Rule

The gap mask lets users reserve areas for titles, copy, or other content.

- The gap editor represents the canvas at base-grid resolution.
- The UI may preview this as a compact grid, initially `8x8`, but it must map proportionally to the actual canvas grid.
- Painted red slots are blocked.
- A generated cell is valid only if every base-grid slot in its footprint is unmasked.
- A large cell requires all `2x2` underlying base slots to be available.
- The generator should naturally route around masked regions instead of trying to fill them.
- Gaps are hard exclusions, not soft preferences.

## Seeded Generation Phases

1. **Normalize config:** round logical width and height to nearest multiples of `40`; derive render width and height by adding `1px`; clamp ratios so `smallCellRatio + largeCellRatio = 1`.
2. **Build candidate map:** list every valid `40x40` and `80x80` candidate footprint that is inside bounds and not blocked by the gap mask.
3. **Choose anchor regions:** randomly choose sparse anchors across the canvas to avoid a perfectly tiled look.
4. **Grow one connected grid:** start from a seed cell, then only accept candidates that edge-touch or corner-touch the existing footprint.
5. **Balance cell sizes:** attempt `80x80` and `40x40` cells according to the configured ratios while preserving one connected composition.
6. **Preserve natural gaps:** skip some valid candidates, avoid overfilled local neighborhoods, and remove corners from dense `2x2` small-cell blocks when safe.
7. **Add edge variation:** extend the silhouette unevenly and allow sparse protrusions while preserving valid cell sizes.
8. **Validate final output:** run invariant checks before rendering.

## Ratio Behavior

- `smallCellRatio` defaults to `0.2`.
- `largeCellRatio` defaults to `0.8`.
- Updating either ratio updates the other so their sum remains `1`.
- Ratios guide placement probability, not an exact area guarantee.
- A ratio of `0` is a hard exclusion for that cell kind.
- The `smallCellRatio` must cap all visible `40x40` cells, including base small cells, overlay cells, and overlay companions.
- Reserve part of the small-cell budget for overlays so base small cells do not consume the entire visual small-cell allowance.
- If the gap mask or collisions prevent the requested ratio, valid output takes priority over exact ratio matching.

## App Config Rules

- The control sidebar lives on the left.
- The canvas preview lives on the right.
- The canvas background is white.
- Width and height inputs accept arbitrary numeric values but are normalized to the nearest multiple of `40` before generation.
- `density` is a `0..1` ratio that controls the target share of occupied `40px` base slots.
- The occupied slot target is derived from normalized canvas capacity: `columns * rows * density`.
- `density: 1` should attempt to fill as much of the valid grid as possible, while still respecting gaps, collision rules, small-cell edge rules, and connectivity rules.
- `80x80` cells count as 4 occupied slots; `40x40` cells count as 1 occupied slot; overlays do not increase base occupancy.
- The app has a `Generate` button that advances or refreshes the generated grid.
- Any config update automatically triggers generation.
- The gap-mask editor is part of the config and should trigger generation after edits.
- Auto-generation should use the current seed unless the user explicitly asks for a new seed.
- The `Generate` button may create a new seed or re-run the current seed depending on the final product decision, but that behavior must be explicit in the implementation docs.

## Randomness Rules

- All random choices must use a seeded PRNG, never `Math.random()` directly.
- The same seed and same normalized config must always produce the same rectangles in the same order.
- Generation should use weighted random candidate selection rather than a fixed scan order.
- Failed placement attempts must have a bounded retry count.
- The generator should expose enough deterministic intermediate state for tests, such as normalized config and final cell list.

## Data Model Draft

```ts
type GridCellKind = "small" | "large";

type GridCell = {
  id: string;
  kind: GridCellKind; // "small" | "large" | "overlaySmall"
  x: number;
  y: number;
  width: 40 | 80;
  height: 40 | 80;
};

type GapMask = boolean[][]; // true means blocked

type GridConfig = {
  seed: string;
  width: number;
  height: number;
  density: number;
  smallCellRatio: number;
  largeCellRatio: number;
  gapMask: GapMask;
};

type NormalizedGridConfig = GridConfig & {
  logicalWidth: number;
  logicalHeight: number;
  renderWidth: number;
  renderHeight: number;
};

type GeneratedGrid = {
  config: NormalizedGridConfig;
  cells: GridCell[];
};
```

## Validation Checklist

The validator should be written as a pure function and run after generation.

- Every `x` and `y` is divisible by `40`.
- Every `80x80` base cell has `x` and `y` divisible by `80`.
- Every `width` and `height` is either `40` or `80`.
- Every cell footprint is inside `logicalWidth` and `logicalHeight`.
- No cell footprint intersects a blocked gap-mask slot.
- No two generated cell footprints overlap.
- `overlaySmall` cells may overlap only the `80x80` cell that contains them.
- No two `40x40` cells share a full edge.
- In mixed layouts where `80x80` cells are enabled, no diagonal chain of base `40x40` cells is longer than 3 cells.
- In pure `40x40` layouts, the diagonal-chain cap does not apply; otherwise the connected grid cannot grow beyond a few cells.
- All generated cells form one connected grid through edge or corner contact.
- Every cell has a stable deterministic `id`.
- Re-running generation with the same config returns an identical `cells` array.
- Render dimensions equal logical dimensions plus `1px`.

## Extension Guidelines For Future Agents

Add new behavior by category so future changes are easy to reason about.

- **Hard invariant:** a rule that must never be broken. Add validator coverage.
- **Placement heuristic:** a rule that changes the look but cannot weaken invariants.
- **Visual style:** a rendering-only rule. It must not change generated logical geometry.
- **UI behavior:** a control or interaction rule. It should describe how config changes trigger generation.
- **Validation:** a testable check for generated output.

When extending this system:

- Any new cell size must explicitly define its base-grid footprint and visual consistency rules.
- Config additions must include defaults and deterministic behavior notes.
- Avoid hidden coupling between renderer and generator; the generator outputs plain rectangle data, and the renderer draws it.
- Prefer rejecting uncertain placements over adding compatibility hacks.
- Do not preserve compatibility with unshipped in-progress rule changes; update the rule book and implementation together.

## First-Build Scope

The first build should create the intended visual family through one connected group of non-overlapping `40x40` and `80x80` base rectangles, sparse placement, edge variation, user-defined gap masks, and decorative `overlaySmall` cells drawn inside some `80x80` cells.
