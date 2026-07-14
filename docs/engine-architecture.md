# Engine architecture (GPU-first rewrite)

The active engine is `packages/stripes-engine` (raw WebGL2, GLSL ES 3.00, no Pixi),
exercised by `apps/lab`. Design + phase roadmap: `docs/superpowers/specs/2026-06-22-gpu-engine-rewrite-design.md`.

## Invariants

- **Field-first.** One grayscale render field (white = draw a stripe). Every effect is a
  field→field GPU pass. Stripes are a pure terminal post-process; stripes-off shows the field.
- **GPU-first.** No CPU pixel sampling on the hot path. CPU only orchestrates + does one-shot
  export readbacks + glyph-atlas bake.
- **WebGL2 only.** ES 3.00 shaders; MRT / float RTs / instancing allowed. No WebGL1 path.
- **Resolution.** Output = CSS × DPR (clamped to MAX_TEXTURE_SIZE). Field passes at `fieldScale`
  (0.5×). Stripes + letters at full DPR.
- **Determinism.** Engine takes an injectable clock + seed; visual goldens depend on it.
- **No silent shader failures.** `compileProgram` throws with the info log.

## Render pipeline

```
field → backgroundStarsField → flamesField → [revealField | assemblyScatterField] →
  edgeMaskField → cursorField → downsample → downsampleColor → letterData → stripe →
  logoFill → stylize (→ canvas)
```

`field`/`backgroundStarsField`/`flamesField`/`revealField`(or `assemblyScatterField`)/
`edgeMaskField`/`cursorField` all read and write **field-resolution** textures (`fieldSize`,
`fieldScale` × output) — reveal/assembly runs **before downsample**, not on the cell texture.
`downsample` (and `downsampleColor` in colors mode) is the one pass that steps from field
resolution down to the cell grid; everything from `downsampleColor` onward operates on
cell-resolution (or output-resolution, for `stripe`/`logoFill`/`stylize`) textures. The stripe
pass itself is unchanged and renders 1:1 — nothing modifies its output; `logoFill`/`stylize`
post-process the stripe pass's own render target afterward. Stripes-off (`stripesEnabled: false`)
bypasses `downsample` through `stylize` and presents the (possibly stars/flames/reveal/edgeMask/
cursor-affected) field directly via a `present` pass — see the present-only table below.

### Pass order (stripes enabled)

| Slot | Pass                                           | Present when                                               |
| ---- | ---------------------------------------------- | ---------------------------------------------------------- |
| 1    | `field` (sourceField/sourceFieldColor)         | yes                                                        |
| 2    | `backgroundStarsField`                         | `config.background.stars.enabled`                          |
| 3    | `flamesField`                                  | `config.flames.enabled`                                    |
| 4    | `revealField` (wave) OR `assemblyScatterField` | `config.reveal.enabled` (type picks the variant)           |
| 5    | `edgeMaskField`                                | `config.edgeMask.enabled`                                  |
| 6    | `cursorField`                                  | `config.cursorTrail.enabled \|\| config.clickWave.enabled` |
| 7    | `downsample`                                   | yes                                                        |
| 8    | `downsampleColor`                              | `config.colors.mode === "colors"`                          |
| 9    | `letterData`                                   | `config.letters.enabled`                                   |
| 10   | `stripe`                                       | yes                                                        |
| 11   | `logoFill`                                     | `config.renderMode !== "sharp"`                            |
| 12   | `stylize`                                      | `config.renderMode !== "sharp"`                            |

### Pass order (stripes disabled — present-only branch)

| Slot | Pass                                    | Present when                                               |
| ---- | --------------------------------------- | ---------------------------------------------------------- |
| 1    | `field`                                 | yes                                                        |
| 2    | `backgroundStarsField`                  | `config.background.stars.enabled`                          |
| 3    | `flamesField`                           | `config.flames.enabled`                                    |
| 4    | `revealField` OR `assemblyScatterField` | `config.reveal.enabled`                                    |
| 5    | `edgeMaskField`                         | `config.edgeMask.enabled`                                  |
| 6    | `cursorField`                           | `config.cursorTrail.enabled \|\| config.clickWave.enabled` |
| 7    | `present`                               | yes                                                        |

`present` reads whichever field/color RT is currently active (`activeColorRT` in colors mode,
else `activeFieldRT`) and blits it straight to the canvas at output size — `downsample` through
`stylize` never run in this branch.

### Reveal pass variants

**Wave** (`reveal.type === "wave"`): A fullscreen mask pass (`revealField` / `reveal.frag`) that
reads the field texture and outputs a masked field texture (`revealedField`) via a radial wave
front. Placement: before `downsample` (and before `edgeMaskField`/`cursorField`, which chain off
whichever field RT is currently active).

**Assembly** (`reveal.type === "assembly"`): An instanced block-scatter pass
(`assemblyScatterField` / `assemblyScatter.vert` + `assemblyScatter.frag`) that renders
block quads (sized by `assembly.sliceSizePx`) flying in from outside the canvas and landing at
their field positions, with an optional blur pyramid for in-flight pieces. Placement: same as
wave — before `downsample`, writing `revealedField`.

### Topology gating

`buildPasses()` is called only when the pipeline **topology** changes — not on every
`setConfig`. Topology is defined by eleven boolean/enum signals, each tracked as a `last*` field
and compared in `setConfig`:

- `stripesEnabled` (stripes pipeline vs. present-only)
- `reveal.enabled` (reveal pass present vs. absent)
- `reveal.enabled && reveal.type === "assembly"` (assemblyScatterField vs. revealField)
- `flames.enabled` (flamesField present vs. absent)
- `background.stars.enabled` (backgroundStarsField present vs. absent)
- `edgeMask.enabled` (edgeMaskField present vs. absent)
- `cursorTrail.enabled` (cursorField present vs. absent, ORed with clickWave)
- `clickWave.enabled` (cursorField present vs. absent, ORed with cursorTrail)
- `letters.enabled` (letterData present vs. absent)
- `colors.mode` (`"colors"` adds the field-color/downsampleColor/cursor-color path)
- `renderMode` (`"sharp"` vs. anything else — gates logoFill/stylize)

Param-only changes (wave softness, assembly stagger, adjustments, stripes palette, star/flame
tuning, etc.) and progress updates (`triggerReveal`) never rebuild passes. Flipping any of the
eleven topology signals always rebuilds; newly-enabled flames/stars/cursorTrail/clickWave also
get a fresh sim state (`createFlamesState`/`createStarsState`/`createCursorTrailState`/
`createClickWaveState`) at that point.

## Legacy

The previous Pixi/CPU engine lives in `apps/studio` + `packages/stripes-shader` and remains the
shipping product until the Phase 9 cutover. Its docs are in `docs/legacy/`; its old agent rules in
`.cursor/legacy/`. Do not follow `docs/legacy/` for new-engine work.
