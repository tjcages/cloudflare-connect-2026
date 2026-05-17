# AI Context

This document is the high-level map for future AI agents working in this repo.

## Current Product

The app is a Canvas component builder with a deterministic seeded grid background. Users can configure the grid, add component layers, move/select instances on the canvas, configure icon-box properties, and copy the composed canvas as a 2x PNG.

The repo started as a seeded grid tool. Some older docs still describe an SVG-first implementation. Treat source code plus this file as the current architecture. `docs/grid-rulebook.md` remains authoritative for grid generation semantics.

## Architecture Map

| Area                | Responsibility                                                                    | Key Files                                                                             |
| ------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| App orchestration   | Top-level state, tab selection, drag state, instance updates, copy action         | `src/app/App.tsx`                                                                     |
| App styles          | Global layout, sidebar rail, grid controls, component list styling                | `src/app/App.css`                                                                     |
| Grid core           | Pure config normalization, masks, PRNG, generation, validation, shared grid types | `src/grid/config.ts`, `mask.ts`, `prng.ts`, `generator.ts`, `validate.ts`, `types.ts` |
| Grid integration    | Legacy clipboard helper around grid serialization                                 | `clipboard.ts`                                                                        |
| Canvas domain       | Pixi render setup, hit testing, PNG extract                                       | `src/canvas/`                                                                         |
| Pixi particles      | Shared `ParticleContainer` constraints (texture/tint/dynamics), connector sparks  | [`docs/pixi.md`](./pixi.md), `src/canvas/components/componentLayer.ts`                |
| Canvas React bridge | `src/canvas/index.tsx` + `src/components/pixi/` + global `src/store.ts`           | —                                                                                     |
| Grid sidebar        | Seed, size, ratios, stroke, gap mask, PNG copy                                    | `src/components/Sidebar.tsx`                                                          |
| Component sidebar   | Components list, layers list, selected layer config                               | `src/components/ComponentSidebar.tsx`                                                 |
| Component domain    | Component labels, dimensions, defaults, snapping helpers, icon-box layout         | `src/lib/componentRegistry.ts`, `src/lib/icon-box/layout.ts`                          |
| Icon-box Pixi cache | Per-leaf `cacheAsTexture` with `pixi-box-shadow`; transform rules                 | `docs/icon-box-pixi-caching.md`, `src/canvas/components/icon-box/build.ts`            |
| Icon registry       | SVG icon definitions and options                                                  | `src/lib/iconRegistry.ts`, `src/components/ComponentIcon.tsx`                         |
| Shared UI           | Shared layer/component row shell and icon tokens                                  | `src/components/ComponentListItem.tsx`, `src/components/iconTokens.ts`                |

## Core Invariants

- Grid generation is deterministic. Do not use `Math.random()` in generation.
- Grid geometry stays logical and serializable. Rendering offsets belong in renderer code.
- **`src/store.ts`** exposes shared builder document state (grid config/output, instances, drag, Pixi `Application`). Canvas setup modules subscribe; keep snapshots serializable.
- Component instances must remain serializable so future persistence/export is straightforward.
- Registry dimensions are authoritative for snapping, hit testing, and component bounds.
- UI style should remain minimal: white base, `#f3f3f3` borders, soft hover/active states, subdued grays.

## Extension Recipes

### Add A Grid Rule

1. Update `docs/grid-rulebook.md` with the rule and classify it as invariant, heuristic, visual style, UI behavior, or validation.
2. Add validation if it is a hard invariant.
3. Update `src/grid/generator.ts` or related helpers.
4. Add focused tests in `src/grid/*.test.ts`.
5. Run `npm test` and `npm run build`.

### Add A Component Type

1. Extend component types/props in `src/grid/types.ts`.
2. Add dimensions and default props in `src/lib/componentRegistry.ts`.
3. Add type-specific Pixi rendering under `src/canvas/components/<type>/` and dispatch from `src/canvas/components/componentLayer.ts`.
4. Ensure `src/canvas/hitTest.ts` uses registry bounds, not duplicated numbers.
5. Add sidebar configuration in `src/components/ComponentSidebar.tsx` if needed.
6. Add tests for registry defaults, drawing, hit testing, and UI behavior.

### Add An SVG Icon

1. Add the icon data to `src/lib/iconRegistry.ts`.
2. Keep paths data-driven and render with `ComponentIcon`.
3. Avoid hardcoded SVGs in row/sidebar components.
4. If the icon should be selectable, ensure the config UI reads from `ICON_OPTIONS`.
5. Add or update tests in `iconRegistry.test.ts` and affected UI tests.

### Add Canvas Rendering Behavior

1. Add or extend Pixi setup modules under `src/canvas/` (e.g. `grid/setup.ts`, `components/componentLayer.ts`, type builders under `components/<type>/`) and subscribe to `src/store.ts`.
2. Keep grid generation deterministic in `src/grid/*`; rendering reads `GeneratedGrid` and instances from the store only.
3. Preserve high-DPI sizing via Pixi renderer `resolution` and resize hooks in `src/components/pixi/index.tsx` / shell layout (`src/canvas/index.tsx`).
4. Keep PNG export aligned with the on-screen scene via `renderer.extract.image` at resolution `2` after clearing selection.
5. Prefer real-WebGL/browser tests for GPU paths; omit hollow Canvas2D mocks.
6. Icon-box filter + cache conventions: see `docs/icon-box-pixi-caching.md`.

### Change Sidebar Style

1. Reuse existing CSS variables, button styles, `ComponentListItem`, and `iconTokens` first.
2. Prefer `data-testid` for icon-only targets (rail tabs, canvas, gap cells). Otherwise use visible text and native `<label htmlFor>` associations where practical.
3. Prefer changing shared classes over one-off row/card styles.
4. Inspect the app in a browser when possible; spacing and hover states are hard to judge from CSS alone.

## Testing Map

- `src/grid/*.test.ts`: deterministic generation, config normalization, masks, renderer helpers, clipboard helpers.
- `src/lib/*.test.ts`: shared component registries, icon metadata, and layout-derived bounds.
- `src/canvas/*.test.ts`: drawing, hit testing, PNG export helpers.
- `src/components/*.test.tsx`: reusable component UI and interaction.
- `src/app/App.test.tsx`: integrated flows such as tabs, drag/move, selection, config, export.

Testing Library tests should prefer visible text and stable `data-testid` hooks for icon-only targets; use native labels for form fields. Canvas tests may assert drawing calls when user-visible pixel assertions are impractical.

## Verification Commands

```bash
npm run verify
```

`verify` runs tests, TypeScript project checks, and the production Vite build.

Linting and formatting use **oxlint** + **oxfmt** via `npm run code-check`. That command is **not** part of `verify` (keeps local iteration fast); GitHub Actions runs `code-check` before `verify` on pushes and pull requests. Run `npm run code-check` locally before pushing if you want to fail early.

Agents often iterate faster with `npm run typecheck` or `npx vitest run <file-or-glob>` before running full `npm run verify`; Vitest uses the `threads` pool here specifically so the suite stays fast under happy-dom.

For docs/rules-only changes, a frontmatter/path/stale-reference review is enough unless source files changed.

## Historical Docs Note

`docs/implementation-plan.md` describes the original first build and still mentions an SVG-first renderer. It is historical context, not the current source of truth for the Canvas component builder. Update or archive it only when explicitly asked.
