# Stripes-Shader Refactor & Installable Package — Design

**Date:** 2026-06-17
**Status:** Approved design; ready for phased implementation planning.
**Repo (current):** `section-grid-generator` (rename to `stripes-shader` deferred to later).

## Goal

Collapse this repo from two apps into one product, and turn the renderer into an
installable package:

1. **Remove the legacy "Section Grid Builder" main app** and make the playground
   the only app.
2. **Do the cleanups/refactors** that fall out of that (orphans, duplicate render
   code, scattered shared leaves).
3. **Ship the renderer as an installable package** — not a code/zip export. In a
   product app you `npm i` the package, paste a config authored in the studio,
   point it at a video, and the canvas renders with full fidelity.

The product is renamed **`stripes-shader`** throughout (package, component, config,
scene). The git repo/directory rename happens later.

## Approved Decisions

| Decision | Choice |
| --- | --- |
| Render fidelity / drift | **Extract one shared render core** (single source of truth). Delete the hand-maintained `portable/**` twin. Both the studio and the package consume the core. |
| Package scope | **Render-only canvas.** No Leva, no export, no ffmpeg in the package. The studio authors a config for a given video; the product app uses `config + video`. Interactive effects (cursor trail, click wave) are included when the config enables them. |
| Distribution | **Private registry / GitHub Packages.** Scoped, versioned, `npm i`-installable, access-controlled. `react`/`react-dom`/`pixi.js` are peer deps. |
| Font | **Self-bundle + auto-register.** The package ships the font file and registers `@font-face` on mount (`FontFace` API), so letters render with zero setup. Production swaps in the licensed font file; private registry keeps it internal. |
| Repo layout | **pnpm workspace monorepo** — `packages/stripes-shader` (published core) + `apps/studio` (authoring app, deployed to Cloudflare). Studio consumes the core via `workspace:*`. |

Assumed package scope `@necatikcl/stripes-shader` (GitHub Packages owner). Adjust if a
different org/scope is wanted.

## Background — why this is low-risk

The two apps are already cleanly decoupled (verified by a full import-graph closure
from both entry points):

- Builder closure ≈ 106 files; playground closure ≈ 102 files; **only 7 shared leaf
  files**: `components/Button.tsx`, `components/HexColorPopover.tsx`,
  `components/pixi/{index.tsx,utils.ts}`, `fonts/codeSnippet.ts`, `grid/prng.ts`,
  `lib/cn.ts`.
- The playground **never** imports `src/canvas`, `src/store*`, `src/app`, builder
  `src/components/**`, builder `src/lib/**`, `src/grid` generator code, `src/presets`,
  `src/types`, or `theme/{palette,accents}`. It builds its own Pixi scene via
  `setupTextureShaderScene.ts`.
- Some playground-owned code lives in "builder" folders and must NOT be swept away
  with the builder: `grid/clipboard.ts`, `grid/prng.ts`, `theme/colorSpace.ts`, and
  all of `src/lib/export/**`.

The package is ~80% built: an `AsciiVideo` component + a dependency-light
`src/lib/export/portable/**` render tree already exist. The flaw is that `portable/**`
is a **hand-maintained twin** of the live playground renderer and **already drifts**
(different edit dates, a `AsciiVideoConfig` type that omits live fields). The core
extraction exists to kill that drift permanently.

## Target Architecture

End state: **one render core, consumed two ways** (studio + package), strictly
one-way dependency `apps/studio → packages/stripes-shader`.

```
stripes-shader/                       (pnpm workspace root)
├─ package.json                       # root: dev tooling ONLY (oxlint, oxfmt, husky, vitest, typescript)
├─ pnpm-workspace.yaml                # packages: ['packages/*', 'apps/*']
│
├─ packages/stripes-shader/           # ▶ PUBLISHED CORE → @necatikcl/stripes-shader
│  ├─ package.json                    #   exports/types/files; peerDeps: react, react-dom, pixi.js
│  ├─ src/
│  │  ├─ index.ts                     #   public API barrel
│  │  ├─ StripesShader.tsx            #   render-only component: (config + src) → live canvas
│  │  ├─ config/                      #   unified StripesShaderConfig: types + DEFAULT_*/normalize*/isDefault*
│  │  ├─ scene/                       #   the Pixi scene: createStripesShaderScene, shaders, block-grid,
│  │  │                               #   stripes, letters, sparkle, flames, reveal, cursor-trail, click-wave
│  │  ├─ pixi/                        #   <Pixi> mount (moved from src/components/pixi)
│  │  ├─ color/                       #   colorSpace (moved from src/theme/colorSpace)
│  │  └─ font/                        #   @font-face auto-register + STRIPES_FONT_FAMILY
│  ├─ assets/BerkeleyMono-*.otf       #   bundled font
│  ├─ vite.config.ts                  #   lib build (ESM) + vite-plugin-dts; externals react/react-dom/pixi.js
│  └─ tsconfig*.json
│
└─ apps/studio/                       # ▶ AUTHORING APP (was the playground; deployed to Cloudflare)
   ├─ index.html                      #   was playground.html, served at /
   ├─ package.json                    #   "@necatikcl/stripes-shader": "workspace:*" + leva, @ffmpeg/*, motion, …
   ├─ src/                            #   TexturePlayground UI: Leva, persistence, video/SVG export, "Copy config"
   │                                  #   renders THROUGH the core (no duplicate render code)
   ├─ public/playground/example*.mp4
   ├─ vite.config.ts
   └─ wrangler.jsonc
```

The core imports only `react` + `pixi.js`. The studio adds the authoring-only deps on
top of the core.

## The Core (`packages/stripes-shader`)

### Unified config

One type, `StripesShaderConfig`, owned by `config/`, replaces both the live
`PlaygroundPersistedConfig` and the hand-written `AsciiVideoConfig`. It aggregates the
per-feature sub-configs (grid, textureAdjustments, sourceTransform, flames, reveal,
cursorTrail, clickWave, stripes/overlayStripes, luminance mode, sparkle scalars,
`duotoneEnabled`/`stripesEnabled`, background, displayWidth/Height), each moved out of
`src/playground` into the core **with its existing `DEFAULT_*` / `normalize*` /
`isDefault*` helpers**. The package accepts `Partial<StripesShaderConfig>` and
normalizes to a complete, range-checked config. The studio's persistence envelope,
copy/wire format, uploads, and IndexedDB stay studio-only and wrap this core type.

### Scene — one render path

All render modules move into `scene/`: `setupTextureShaderScene`
(→ `createStripesShaderScene`), shaders/filters (`stripeFilterShaders`,
`stripeDuotoneFilter`, `sourceTextureFilter`), `blockGridTexture`, `computeBlockGrid`,
`stripeColors`, `stripePaletteTexture`, `stripeIndexLutTexture`, the `stripeLetter*`
family, `samplePlaygroundFrame`, and effects (`cursorTrail*`, `clickWave`,
`playgroundSparkle`, `playgroundWidthShuffle`, `playgroundFlames`,
`playgroundReveal*`). `grid/prng.ts` moves here (the scene needs deterministic PRNG).

The factory is generalized to read config through a **getter**, so both consumers
share identical code:

```ts
createStripesShaderScene({ getConfig, getSource, getDisplaySize }): Ticker
// per frame: read getConfig() → sample frame → build block grid → sync uniforms → render
```

This is today's ref-reading `runDuotoneTick`, parameterized. `src/lib/export/portable/**`
is deleted — there is exactly one scene.

### Component — render-only API

```tsx
<StripesShader
  src={string | HTMLVideoElement | HTMLImageElement}
  mediaKind="video" | "image"
  config={Partial<StripesShaderConfig>}   // pasted from the studio
  width?={number} height?={number}        // defaults to config.displayWidth/Height
  autoPlay?  loop?  muted?  paused?        // video playback
  className?  style?
/>
```

Internally: registers the font, loads media, mounts `<Pixi>`, builds the scene with
`getConfig: () => normalizeStripesShaderConfig(config)`, re-syncs on `config` change
(full remount only on media-kind / display-size change — same `sceneKey` logic as
today). Ships with a `"use client"` directive + SSR guard (it touches
`document`/`window`/`performance`/`document.fonts`).

### Font auto-register

`font/` bundles `BerkeleyMono-*.otf` and registers it via the `FontFace` API on mount,
independent of any global CSS. `STRIPES_FONT_FAMILY` lives in the core. Production
swaps in the licensed font file.

### Packaging & publish (GitHub Packages)

- `package.json`: `name: "@necatikcl/stripes-shader"`, `type: module`, `exports`
  (`"."` → types + import), `main`/`module`/`types`, `files: ["dist"]`,
  `peerDependencies: { react, react-dom, pixi.js }`, `publishConfig.registry =
  https://npm.pkg.github.com`.
- Build: lib mode (ESM), externalize `react`/`react-dom`/`react/jsx-runtime`/`pixi.js`;
  `vite-plugin-dts` for `.d.ts`; font emitted as a bundled asset.
- Consumer: `.npmrc` (`@necatikcl:registry=…` + token) → `npm i
  @necatikcl/stripes-shader pixi.js` → paste config → `<StripesShader src config />`.

## The Studio (`apps/studio`)

Today's playground, minus duplicate render code and the old export. `TexturePlayground`
keeps all authoring concerns — Leva controls, localStorage/IndexedDB persistence,
uploads, video export (ffmpeg), SVG export (`stripeGridToSvg` + `writeSvgToClipboard`
stay here) — but renders **through the core**: its `*Ref` mirrors feed
`createStripesShaderScene({ getConfig: () => buildConfigFromRefs() })`. Same live-slider
feel, zero duplicate render code.

The **"Export as React (zip)" flow is replaced by a "Copy config" button** that copies a
`StripesShaderConfig` literal. Deleted: `ExportReactDialog`, `buildReactExport`,
`portableBundle`, `downloadReactExportZip`, `playgroundSnapshot`, `resolveExportPaths`,
`syncExportToTest`, `example5Snapshot`, all of `portable/**`.

## Phase 0 Deletion Set (builder removal)

Delete: `src/app/`, `src/canvas/`, `src/store.ts` + `store*.test`, `src/storePersist.ts`,
`src/store/`, `src/presets/`, `src/types/`, `src/devExposeBuilderStorage.ts`,
`src/main.tsx`, `index.html`; builder-only `src/components/**` (all except `Button`,
`HexColorPopover`, `pixi/**`); builder-only `src/lib/**` (all except `cn.ts` and — until
Phase 2 — `export/**`); builder-only `src/grid/**` (all except `prng.ts`,
`clipboard.ts`); `theme/palette.ts` + `theme/accents.ts`; `fonts/iconBoxTitle.ts`;
orphans `components/GridCanvas.tsx`, `grid/renderer.tsx`,
`playground/{VideoPlayground,setupVideoShaderScene,playgroundVideos,FieldHelp,controlValueParsing}`.

Rewire `vite.config.ts` (drop `rollupOptions.input`, drop `playgroundPathRedirect`),
rename `playground.html` → `index.html`, drop the `dev:playground` script, clean
`__SECTION_GRID_BUILDER_DEV__` from `vite-env.d.ts`. Net: ~150 source files + ~40 tests
removed; a single working app remains.

## Tooling / Build / Test / Deploy Migration

- **Vite:** one lib config under `packages/stripes-shader`, one app config under
  `apps/studio`. `wrangler.jsonc` moves to `apps/studio/` (serves `dist/`); deploy =
  `pnpm --filter studio build && wrangler deploy`.
- **Vitest:** convert to a Vitest workspace (`projects: ['packages/*', 'apps/*']`); the
  `node` vs `happy-dom` `environmentMatchGlobs` migrate per-project (scene/config →
  node, components → happy-dom). Render-module tests travel with their modules into the
  package; studio tests stay.
- **TS:** root `tsconfig.json` references both packages; the core adds a
  `tsconfig.build.json` (`declaration: true`, `emitDeclarationOnly`) for dts.
- **Lint/format/husky:** stay at the root (oxlint/oxfmt/lint-staged repo-wide); prune
  `.oxlintrc.json` overrides that named deleted builder paths; keep the `Math.random`
  ban scoped to the core scene + `grid/prng`.
- **Root `package.json`:** dev-tooling-only; runtime deps move into the package
  (`pixi.js` → peer + dev) and the studio (`leva`, `@ffmpeg/*`, `motion`, `fflate`,
  `react-colorful`, …).

## Sequencing — four reviewable phases

Each phase ends green: `pnpm verify` (test + typecheck + build) **and** a visual check
of the studio in the running dev server (no new dev server is started — the user's is
reused).

1. **Phase 0 — Delete builder, collapse to a single working app.** Flat layout, lowest
   risk.
2. **Phase 1 — Stand up the workspace skeleton.** Create `packages/` + `apps/`, move the
   playground into `apps/studio`, root becomes tooling-only. Mechanical; studio still
   renders with its own code.
3. **Phase 2 — Extract the core + unify config + kill the twin.** Move
   render/config/pixi/color/font into `packages/stripes-shader`, build
   `createStripesShaderScene` + `<StripesShader>`, point the studio at it via
   `workspace:*`, replace the export flow with "Copy config". The big refactor; verify
   the studio renders pixel-identically.
4. **Phase 3 — Package build & publish.** Lib build + dts + `exports`/peerDeps + font
   asset + GitHub Packages config; smoke-test in a throwaway consumer; publish a version.

Each phase gets its own implementation plan written and reviewed at its boundary (land
this spec → write Phase 0 plan → execute → write Phase 1 → …).

## Risks & Edge Cases

1. `grid/clipboard.ts` is playground-only despite the `grid/` location — used by
   `TexturePlayground` for SVG copy. Keep it (lands in the studio, not the core).
2. `theme/colorSpace.ts` is playground-only; siblings `palette.ts`/`accents.ts` are
   builder-only. Don't `rm -rf src/theme/` — `colorSpace.ts` moves into the core.
3. `grid/prng.ts` is shared (builder generator + playground letters). It moves into the
   core; the builder copy is deleted with the builder. A separate `portable/runtime/prng.ts`
   exists for the twin and is deleted with `portable/**`.
4. `src/lib/export/**` lives under `lib/` but is 100% playground feature code; it is
   removed in Phase 2 (replaced by the real package + "Copy config"), not in Phase 0.
   `portable/**` files are loaded as `?raw` text — deleting them also removes those raw
   imports.
5. Dynamic import edge: `CodeSnippetCodeField.tsx` does `await import("../lib/code-snippet/formatCode")`
   — both files are builder-only, deleted together in Phase 0.
6. Pre-existing broken re-export `buildReactExport.ts:137` (`export { hexToRgb01 } from
   "./colorSpace"` — no such file). Moot once the export system is deleted in Phase 2.
7. ORPHANs dead in both apps today — delete opportunistically: `components/GridCanvas.tsx`,
   `grid/renderer.tsx`, plus the playground-adjacent dead files listed in Phase 0.
8. Font fidelity: the studio currently relies on a `global.css` `@font-face`; the core
   must register the font itself so letters render in a consumer with no global CSS.
9. SSR: `<StripesShader>` is strictly client-only — needs the `"use client"` directive
   and guards for Next.js/Astro consumers.

## Out of Scope (YAGNI)

- No public npm publish (private GitHub Packages only).
- No ffmpeg/video export or Leva in the package — authoring stays in the studio.
- No SVG export in the package — render-only.
- No multi-font / theming system beyond a single bundled font (a configurable font
  family can be added later if needed).
- The git repo/directory rename to `stripes-shader` is deferred.
