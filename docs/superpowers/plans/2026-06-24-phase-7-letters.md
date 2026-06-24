# Phase 7 — Letters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the legacy "letters" — glyphs rendered on the brightest-band stripe cells — to the new GPU engine: a baked glyph atlas + a per-cell glyph-data texture (presence + glyph index, stable per cell, matrix-style shuffle over time) composited as white glyphs over the stripes.

**Architecture:** A **stripe-stage** effect (like sparkle). (1) Bake the fixed charset into ONE packed glyph atlas texture (canvas raster → ImageData → raw-buffer texture; one-time). (2) A cheap GPU **glyph-data pass** (cols×rows R8) writes, per cell: `0` = no letter, else `glyphIndex+1` — present when the cell is in the brightest band AND a per-cell PRNG `chance(coverage)` passes; the glyph index is per-cell-seeded (stable) and cycles via a deterministic time-hash shuffle. (3) The **stripe frag** composites the glyph (sampled from the atlas, white) over the bar for letter cells. A pure-TS `letterMath.ts` holds the PRNG placement + shuffle index and is unit-tested; the GLSL mirrors it.

**Decisions locked:**

- **Animated shuffle:** deterministic per-cell time-hash glyph cycling (matrix-style: brief rapid bursts then rest), `shuffleSpeed` knob. No `Math.random`/`performance.now` (golden-safe).
- **White glyphs** (faithful tint `0xffffff`) composited over the stripes.
- **Default OFF** (`letters.enabled` default `false`) → existing 19 goldens byte-unchanged.
- **Brightest band = top configured band:** a cell is letter-eligible when `cellLuma >= max(stripe.startFrom)` (avoids a GPU global max-reduction; for a logo the top band is reached). Below the lowest stripe threshold = background = never a letter.
- **Fixed charset** = legacy printable ASCII (A–Z, a–z, 0–9, symbols ≈ 94 glyphs); not a config field for v1.
- **Per-cell stability:** glyph base index + presence seeded by `(col,row)` so unchanged cells don't pop across rebuilds (mirrors legacy `createPrng("col,row")`).
- **Y-flip:** the glyph atlas (canvas y-down) must be sampled upright in the screen-oriented stripe pass — flip the atlas `v` (see [[gpu-engine-rewrite-progress]] Y-orientation gotcha) and verify on a known glyph.

**Tech Stack:** raw WebGL2 / GLSL ES 3.00; TypeScript; Vitest; Playwright real-GPU goldens.

## Global Constraints

- pi/pir ONLY; prefix verify/e2e with `npm_config_store_dir="$HOME/Library/pnpm/store/v10"` if needed. WebGL2 `#version 300 es`; compile must throw on failure.
- Glyph atlas + glyph-data are RAW typed-array textures / RTs, NEVER canvas-uploaded color textures ([[gpu-data-textures-must-be-raw-buffers]] — bake via canvas then `getImageData` → Uint8Array; white-on-transparent → store coverage in R8).
- NO code comments unless asked. Object styles. Work on `main`; commit per task; never push. ([[work-directly-on-main]], [[no-push-offers-show-results]])
- Goldens `?hud=0`, darwin-keyed, `--update-snapshots`, `maxDiffPixelRatio 0.01`.
- ALL existing goldens (19) MUST stay byte-unchanged (default-off).
- Reuse the user's dev server at http://localhost:5174.

## Reference: legacy → new mapping

| Legacy                                                                                                               | New (engine)                                                       | Notes                                      |
| -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------ |
| `stripeLetterConstants.ts` / `stripeLetterFont.ts` charset + raster                                                  | `letters/letterAtlas.ts`                                           | bake packed atlas → raw R8 texture         |
| `stripeLetterPlacements.ts` (`computeStripeLetterPlacements`, `createPrng("col,row")`, `STRIPE_LETTER_COVERAGE=0.1`) | `letters/letterMath.ts`                                            | per-cell presence + base glyph index       |
| `playgroundLetterShuffle.ts` + `tickLetterShuffle` (CPU cycle state machine)                                         | `letters/letterMath.ts` deterministic time-hash                    | stateless shuffle index(time)              |
| `stripeLetterLayer.ts` (Pixi sprites)                                                                                | `passes/letterDataPass.ts` + composite in `shaders/stripe.frag.ts` | GPU glyph-data + in-shader glyph composite |
| `config` letter fields                                                                                               | `config/{types,normalize}.ts` `letters`                            | enabled/coverage/sizeScale/shuffleSpeed    |

## Key formulas

- Placement (port `computeStripeLetterPlacements`): cell eligible if `cellLuma >= uTopBandThreshold` (top band) AND `prng(col,row).chance(coverage)`. Base glyph index = `prng(col,row).integer(0, charset.length-1)`. Use a GLSL hash mirroring `createPrng("col,row")`'s `chance`/`integer` (port `prng.ts` deterministically; verify TS↔GLSL parity in tests).
- Shuffle (deterministic redesign): per cell, `cycleLen = (baseDelay + seed*jitter)/shuffleSpeed`; within the first `burst` of each cycle the glyph rapidly changes (`stepLen` steps) to `hash(seed, cycleIndex, stepIndex) % charsetLen`, otherwise the base glyph. Time-driven, no state. Speed scales cycle/step lengths (mirror legacy `/speed`). Tunable constants ported from `playgroundLetterShuffle.ts`.
- Atlas: monospace font → uniform glyph cell. Grid `A×A` with `A=ceil(sqrt(charsetLen))`. Glyph `g`'s cell at `(g%A, g/A)`. Sample with cell-local UV scaled by `sizeScale`, centered; flip `v` for upright.
- Composite (stripe frag, letters on): `data = texture(uGlyphData, cellCenterUv).r * 255`; if `data >= 0.5`: `gi = round(data)-1`; `cov = texture(uAtlas, atlasUv(gi, glyphLocal)).r`; `finalColor.rgb = mix(barColor, vec3(1.0), cov)`.

## File Structure

**New:** `letters/letterMath.ts` (+ test); `letters/letterAtlas.ts` (+ test); `letters/charset.ts`; `shaders/letterData.frag.ts`; `passes/letterDataPass.ts`; `tests/letters.spec.ts`.
**Modified:** `config/types.ts`, `config/normalize.ts` (+ test), `legacy/migrateLegacyConfig.ts`, `shaders/stripe.frag.ts` (glyph composite), `passes/stripePass.ts` (atlas + glyph-data uniforms), `engine.ts` (atlas bake + letterData pass + topology + uniforms), `apps/lab/src/controls/levaSchema.ts` (Letters folder).

---

### Task 1: Config — `letters` section

**Files:** types.ts, normalize.ts, normalize.test.ts, migrateLegacyConfig.ts
**Produces:** `interface LettersConfig { enabled: boolean; coverage: number; sizeScale: number; shuffleSpeed: number }`; `DEFAULT_LETTERS = { enabled:false, coverage:0.1, sizeScale:0.9, shuffleSpeed:1 }`.

- [ ] **Step 1:** Add `LettersConfig` + `letters` on `EngineConfig`.
- [ ] **Step 2:** Failing tests: omitted → enabled false; coverage clamp 0..1 (default 0.1); sizeScale clamp 0.1..1 (default 0.9); shuffleSpeed clamp 0.05..10 (default 1); enabled `!== undefined ? !!v : default` (omitted → false).
- [ ] **Step 3:** verify FAIL. **Step 4:** `DEFAULT_LETTERS` + `normalizeLetters` + wire-in + DEFAULT_ENGINE_CONFIG + partial + migrate (default). **Step 5:** verify PASS. **Step 6:** commit `feat(engine): letters config (default off)`.

### Task 2: Pure-TS `letterMath.ts` (placement + shuffle)

**Files:** letters/charset.ts, letters/letterMath.ts (+ test)
**Produces:** `LETTER_CHARSET` (ported ASCII); `letterPrngChance(col,row,coverage): boolean`; `letterBaseGlyph(col,row,charsetLen): number`; `letterGlyphAt(col,row,timeSec,charsetLen,shuffleSpeed): number` (shuffle-resolved index); `letterCellPresent(col,row,cellLuma,topBandThreshold,coverage): boolean`.

- [ ] **Step 1:** Failing tests: determinism (same col,row,time → same glyph; differs by cell); `chance(coverage)` distribution roughly ~coverage over a grid; not-top-band (luma<threshold) → not present; shuffle changes the glyph within a burst window then rests at base; speed scales cycle timing; charset length bound.
- [ ] **Step 2:** verify FAIL. **Step 3:** port `createPrng`/charset + the redesigned deterministic shuffle (read `prng.ts`, `stripeLetterPlacements.ts`, `playgroundLetterShuffle.ts`). **Step 4:** verify PASS. **Step 5:** commit `feat(engine): letterMath placement + deterministic shuffle`.

### Task 3: Glyph atlas bake `letterAtlas.ts`

**Files:** letters/letterAtlas.ts (+ test)
**Produces:** `buildLetterAtlas(): { data: Uint8Array; width: number; height: number; gridCols: number; gridRows: number; glyphPx: number }` — packs `LETTER_CHARSET` into an `A×A` grid via canvas raster (monospace, white) → `getImageData` → R8 coverage buffer (use the alpha/luma channel). Plus `createLetterAtlasTexture(gl, atlas)` (raw-buffer texture, NEAREST or LINEAR).

- [ ] **Step 1:** Failing test (jsdom canvas may be limited — test the packing math: grid dims `A=ceil(sqrt(len))`, glyph→cell index mapping, buffer length = width\*height; guard SSR/no-canvas with a deterministic fallback so tests run).
- [ ] **Step 2:** verify FAIL. **Step 3:** implement (bake via canvas2D fillText per glyph into its grid cell at rasterScale; getImageData → R8; if no document/canvas, return a zero/checker buffer of correct dims). **Step 4:** verify PASS. **Step 5:** commit `feat(engine): letter glyph atlas (packed raw-buffer texture)`.

### Task 4: GPU glyph-data pass `letterDataPass.ts`

**Files:** shaders/letterData.frag.ts, passes/letterDataPass.ts

- [ ] **Step 1:** `letterData.frag` (fullscreen over cols×rows): per cell read `uCell` luma; compute `present = luma >= uTopBandThreshold && prngChance(col,row,uCoverage)`; `gi = letterGlyphAt(col,row,uTimeSec,uCharsetLen,uShuffleSpeed)`; output `vec4((present ? float(gi+1) : 0.0)/255.0, 0,0,1)`. GLSL hashes MUST mirror `letterMath.ts` (chance/integer/shuffle) exactly.
- [ ] **Step 2:** `letterDataPass`: `render(target cols×rows R-RT, cellTex, { cols, rows, topBandThreshold, coverage, timeSec, charsetLen, shuffleSpeed })`.
- [ ] **Step 3:** `pir verify` (compile) PASS. **Step 4:** commit `feat(engine): GPU letter glyph-data pass (presence + shuffle index)`.

### Task 5: Stripe composite + engine wiring

**Files:** shaders/stripe.frag.ts, passes/stripePass.ts, engine.ts

- [ ] **Step 1:** `stripe.frag`: add uniforms `uLettersEnabled`, `uGlyphData`, `uAtlas`, `uAtlasGrid`(vec2), `uCharsetLen`, `uLetterSizeScale`. After the bar color: if `uLettersEnabled > 0.5`, read `uGlyphData` at the cell center; if a glyph present, compute the cell-local glyph UV (centered, scaled by `uLetterSizeScale`, **v flipped** for upright), sample `uAtlas.r` coverage, `finalColor.rgb = mix(barColor, vec3(1.0), cov)`. Must no-op when disabled.
- [ ] **Step 2:** `stripePass`: add the new uniforms + atlas/glyph-data texture units.
- [ ] **Step 3:** engine.ts: bake the atlas once (`buildLetterAtlas` + texture) — rebuild only if charset/size changes (charset fixed → bake once). When `letters.enabled`: build `letterDataPass`; in the stripe branch, before `stripePass.render`, run the letterData pass into a `glyphData` cols×rows RT (passing `timeSec=clock.now()/1000`, `topBandThreshold = max(stripe.startFrom)`, coverage, shuffleSpeed, charsetLen); pass the atlas + glyphData + grid + sizeScale to `stripePass`. Topology-gate on `letters.enabled`. Dispose pass.
- [ ] **Step 4:** `pir verify` → PASS. `pir test:e2e` → existing 19 UNCHANGED (off ⇒ stripe frag no-ops, no letterData pass). **Step 5:** commit `feat(engine): letters glyph composite in stripe pass (topology-gated, off by default)`.

### Task 6: Lab controls + goldens

**Files:** apps/lab/src/controls/levaSchema.ts, tests/letters.spec.ts

- [ ] **Step 1:** "Letters" folder: `lettersEnabled` (bool); `coverage` (0..1 step .01); `sizeScale` (0.1..1 step .05); `shuffleSpeed` (0.05..3 step .05). Gate non-enabled on `get("Letters.lettersEnabled")===true`; map into `letters:{...}`.
- [ ] **Step 2:** `pir verify`. Live-verify at http://localhost:5174 (stripes on, letters enabled): confirm white glyphs on the brightest cells, **upright** (Y-flip correct), shuffling over time. Temp screenshot at a KNOWN spot to confirm orientation; delete temps.
- [ ] **Step 3:** `tests/letters.spec.ts`: golden at `/?manual=1&seed=1&dpr=2&w=400&h=300&hud=0`, `stripesEnabled:true`, `letters:{enabled:true, coverage:0.5}`, `renderAt(1000)` (fixed clock → deterministic shuffle). Screenshot `letters-stripes.png`, `maxDiffPixelRatio 0.01`. READ it: white glyphs on bright cells, upright. Determinism re-run PASS.
- [ ] **Step 4:** Full `pir test:e2e` → all green (20); prior 19 unchanged. **Step 5:** commit `feat(lab)+test(engine): Letters controls + golden`.

## Self-Review

- **Coverage:** config (T1), placement+shuffle math (T2), atlas (T3), GPU glyph-data (T4), composite+wiring (T5), UI+golden (T6); animated shuffle (T2/T4), white glyphs (T5), default-off invariant (T1, verified T5/T6), Y-flip (T5, verified T6). ✓
- **Type consistency:** `LettersConfig` identical across types/normalize/engine/lab; `letterMath` exports consumed by tests + mirrored in `letterData.frag`; atlas grid dims shared by `letterAtlas`/`letterDataPass`/`stripe.frag` (uAtlasGrid); glyph-data R8 encoding (0=none, gi+1) consistent pass↔frag. ✓
- **Risks:** TS↔GLSL hash parity (chance/integer/shuffle) — pin in T2 tests + verify visually in T6. Atlas Y-flip — verify upright on a known glyph (T6). jsdom canvas in T3 — guard with a fallback so unit tests run. Brightest-band = top configured band (documented deviation from legacy actual-max-present).
