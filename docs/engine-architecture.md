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

## Legacy

The previous Pixi/CPU engine lives in `apps/studio` + `packages/stripes-shader` and remains the
shipping product until the Phase 9 cutover. Its docs are in `docs/legacy/`; its old agent rules in
`.cursor/legacy/`. Do not follow `docs/legacy/` for new-engine work.
