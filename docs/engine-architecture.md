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
sourceField → downsample → [reveal | assemblyScatter] → stripe (→ canvas)
```

All reveal/assembly effects run **PRE-STRIPE** on the cell texture. The stripe pass is
unchanged and renders 1:1 — nothing modifies its output. Stripes-off bypasses the entire
downsample/reveal/stripe chain and presents the field directly.

### Pass order (stripes enabled)

| Slot | Pass                          | Always present    |
| ---- | ----------------------------- | ----------------- |
| 1    | `field` (sourceField)         | yes               |
| 2    | `downsample`                  | yes               |
| 3    | `reveal` OR `assemblyScatter` | only when enabled |
| 4    | `stripe`                      | yes               |

### Reveal pass variants

**Wave** (`reveal.type === "wave"`): A fullscreen mask pass (`revealPass` / `reveal.frag`) that
reads the cell texture and outputs a masked cell texture via a radial wave front. Placement:
between downsample and stripe. The stripe pass reads from the `reveal` RT instead of `cell`.

**Assembly** (`reveal.type === "assembly"`): An instanced block-scatter pass
(`assemblyScatterPass` / `assemblyScatter.vert` + `assemblyScatter.frag`) that renders
40px-block quads flying in from outside the canvas and landing at their cell positions. Placement:
between downsample and stripe. The stripe pass reads from the `reveal` RT.

### Topology gating

`buildPasses()` is called only when the pipeline **topology** changes — not on every
`setConfig`. Topology is defined by three boolean signals:

- `stripesEnabled` (stripes pipeline vs. present-only)
- `reveal.enabled` (reveal pass present vs. absent)
- `reveal.enabled && reveal.type === "assembly"` (assemblyScatter vs. wave mask)

Param-only changes (wave softness, assembly stagger, adjustments, stripes palette, etc.) and
progress updates (`triggerReveal`) never rebuild passes. Flipping any of the three topology
signals always rebuilds.

## Legacy

The previous Pixi/CPU engine lives in `apps/studio` + `packages/stripes-shader` and remains the
shipping product until the Phase 9 cutover. Its docs are in `docs/legacy/`; its old agent rules in
`.cursor/legacy/`. Do not follow `docs/legacy/` for new-engine work.
