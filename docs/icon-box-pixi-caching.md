# Icon-box Pixi: filters and `cacheAsTexture`

This note captures why icon-box chrome caches **per filtered leaf** and how transforms stay stable so `pixi-box-shadow` does not “double” offsets.

## Where the code lives

- Builder: `src/canvas/components/icon-box/build.ts`
- Layer sync (drag / z-order): `src/canvas/components/componentLayer.ts` (`syncIconBox`)

## Rules

1. **Cache on the same node that owns the filter** (`cacheAsTexture(true)` on that `Graphics` / inner `Container`), not on `chromeRoot` or other broad parents.

2. **Single grid translation for chrome:** `chromeRoot.position` is set to `(instance.x, instance.y)` (and updated on drag in `syncIconBox`). Filtered leaves default to **position `(0, 0)`** and encode layout in draw commands (`roundRect`, `rect`, …) so filter bounds stay in **local** space under `chromeRoot`.

3. **Icons:** Do **not** attach `BoxShadowFilter` to `iconHold`, which already carries slot placement (`holdX`, vertical inner offset). Use a child **`iconFiltered`** at `(0, 0)` with the filter + sprite, then cache **`iconFiltered`**. Otherwise shadow math can stack “filter offset + parent translate” and look wrong.

4. **Drag-only moves:** For translation-only updates, `syncIconBox` only adjusts `structureRoot` / `chromeRoot` positions. It does **not** call `updateCacheTexture()` on cached subtrees; cached pixels remain valid while the parent moves. Rebuild or refresh caches when props / theme / grid stroke change (handled by replacing the layer entry).

5. **Component layer:** `syncLayers` draws every instance type the store lists (markers, icon boxes, connector lines, etc.) and rebuilds shared connector joint caps each tick.

## Z-order reminder (`chromeRoot.sortableChildren`)

Among siblings, stacking uses `zIndex` on children — e.g. container reticles in `outerReticlesRoot` (20, lowest chrome), `innerBodyMotionRoot` (23) with card/markers/icons, accent bars (24), title strip (30+). Reticles stay fixed on connector-hit nudge; the inner body moves. Changing parenting for caches must preserve those indices.
