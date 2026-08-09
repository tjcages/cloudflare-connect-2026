# Comet logo: upstream the CTA path, per-shader states, schema-derived lab controls

**Date:** 2026-08-09
**Status:** approved, not yet implemented

## Context

The Cloudflare marketing CTA drives its texture from `createCometLogoTextureRenderer`.
Every behaviour it depends on currently lives in a pnpm patch in the marketing repo —
`patches/@necatikcl__stripes-engine@0.18.0.patch` — which patches the **built**
`dist/index.js`, not engine source.

Two facts make this urgent:

1. **The patch is the only copy.** `packages/stripes-engine/src/cometLogo/shaders.ts`
   is 1,634 lines and contains none of it — `formationMode`, `auroraHead` and
   `uFormationSpawnRadius` all return zero matches. Roughly 3,500 lines of GLSL plus
   a session's worth of CTA tuning exist nowhere else.
2. **Every tuning round costs a patch regeneration.** Each change means editing
   `dist`, hand-diffing against a pristine copy, reinstalling and re-verifying.

`comet-center-clear-shape` (v0.19.0) already carries a small part of the centre-clear
work in source — 4 files, +26 lines. It is the branch to build on.

## Decomposition

Three parts, in this order. Each is independently releasable.

| #   | Part                                                        | Rationale for the position                             |
| --- | ----------------------------------------------------------- | ------------------------------------------------------ |
| 1   | Port the CTA path to engine source; release; drop the patch | Removes the single-copy risk every later part inherits |
| 2   | Schema-derived comet controls in the lab                    | Closes the drift class before more settings are added  |
| 3   | Named-state API (`cta hover`) + lab state picker            | Builds on a config module that now carries metadata    |

## Part 1 — Port the CTA path

### Scope

Port **only the direct-flight path (formation mode 0)** and the settings the CTA
config touches. Explicitly drop the other 14 formation modes.

Dropping them removes `formationMode()` and its dispatch, which collapses
`steeredHead` from 16 branches to one and simplifies `formationLifeFade`,
`formationEngaged` and the radius-ease switch. `formationParamA`, `formationParamB`
and `formationSpawnRadius` exist only to serve those modes and go with them.

The ported source should therefore be **smaller** than the patch, not merely relocated.

### Behaviour inventory

Everything below is in the patch today and must survive the port. Grouped by source
file it lands in.

**`config.ts` — new settings.** The exact list is derived by diffing the patched
`dist/cometLogo/config.d.ts` (52 settings) against `src/cometLogo/config.ts` (37).
Known members: `fieldAlign`, `formationDirectness`, `formationMaxTravel`,
`centerClearAspect`, `centerClearSquareness`, `centerClearLeak`,
`centerClearFalloff`, `logoDensity`, `formationEase`, `formationWiggle`,
`formationInterrupt`, `formationStagger`. Settings that exist only for the dropped
modes are not ported.

**`shaders.ts` — particle layout.**

- Background field 64 → 160 particles (`Ls`/`Rs` = `Ns + 160`; sparks stay at 96).
- Dedicated logo pool: `logoParticle = extraLogo`, so no base-index comet is ever
  borrowed by the logo. `pairedLogoCandidate` is disabled — that mechanism swapped
  background comets' identities into logo roles.
- `sourceParticleOpacity` keeps its per-index values so the idle field's appearance
  is unchanged by the pool split.
- `logoDensity` sizes the pool outright: draw count is
  `zs + max(1, round(logoDensity * Ns))`, and it accepts fractional values.

**`shaders.ts` — formation.**

- `formationOrder`: blend the spatial order 60/40 with a per-comet uniform hash,
  apply `pow(…, 1.7)`, and use **additive** jitter (±0.05). The original
  multiplicative jitter was a no-op on the starter cohort, which departed as one
  clump; the power curve restores a prompt start without recreating it.
- `formationLifeFade` (mode 0) returns `smoothstep(0.0, 0.32, local) * formationCrossFade(...)`
  so pool comets fade in from nothing as they fly.
- A pool comet that has not yet engaged renders at `lifeFade = 0.0`. Without this it
  appears at its virtual field life, stationary, the moment the pool starts drawing.
- `formationSettleWiggle`: damped oscillation normal to the approach direction,
  `sin(local * freq * TAU + phase) * exp(-4.2 * local)`, gated by
  `smoothstep(0.0, 0.22, local)` and scaled by travel distance and `uFormationWiggle`.
  Frequency (2.1–3.6) and phase are hashed per comet. The decay leaves ~1% at
  arrival, so comets still land exactly on their anchors.

**`shaders.ts` — deformation.**

- `rejoinPopEase(t, id)`: normalised drag curve `(1 - exp(-k·t)) / (1 - exp(-k))`
  with `k = mix(3.2, 9.5, hash11(id * 27.91))`. Initial velocity 3.2–9.5× average,
  varying per comet, which is what reads as an explosion rather than a tween.
- `rejoinStagger` delay factor 0.5 → 0.14, so the launch is one burst with jitter
  rather than a wave.
- `rejoinCrossFade` is `1.0 - smoothstep(0.0, 0.5, rejoinStagger(id, progress))`:
  **opacity spans local 0→0.5 while movement spans 0→1**, so the throw keeps
  travelling after the comet is invisible.

**`shaders.ts` — trails.**

- `logoTrailBlend` is `1.0` while rejoining, else `1.0 - smoothstep(0.92, 1.0, uFormation)`.
  It must key off the **global** formation, not per-comet local progress: on a
  re-hover the formation resumes mid-way and every comet's local value is already
  near 1, which silently killed the trail.
- `trailTime` is clamped to `uRejoinElapsed` (rejoining) or
  `uFieldTime - formationDepartTime(id)` (forming), so a trail can never reach back
  into a pool comet's pre-departure virtual field history. That history is what made
  trails appear inconsistently between hovers.
- `maxTrailWorld` is `LOGO_MAX_TRAIL_WORLD` (0.2) for pool comets, else
  `MAX_TRAIL_WORLD * uFieldTrailLength`. Decoupling the ceiling from
  `logoTrailLength` is what lets speed express itself: length is `speed × window`,
  capped only at the extreme.
- The cap iterates (5 passes, 0.85 relaxation, re-measuring each time). One linear
  correction badly undershoots because the drag path covers most of its distance
  early — that produced canvas-spanning streaks.
- `TRAIL_SEGMENT_COUNT` 3 → 8, with the draw call's vertex count 18 → 48.
- **The fragment shader hardcodes the segment count** as `segmentProgress / float(3)`.
  It is a separate string that never sees the constant. It must move to `float(8)`
  in the same change, or the taper overshoots and trails render at full width.
- `cometTaper = trailProgress * trailProgress` multiplies `trailCore` and `trailHalo`,
  so brightness falls off toward the tail. Previously only width tapered.

**`animation.ts` / `renderer.ts` — state machine.**

- The formation origin (`uFormationStartFieldTime`) must reset whenever a formation
  starts from zero, not only when the previous mode was `"field"`. A second hover
  enters `"forming"` from `"rejoining"`, leaving the origin stale;
  `historicalFormation` then returns the current formation for every past time, every
  sampled age reports the same position, and the trail measures zero travel. With
  `formationMode` dropped the condition becomes `T === "field" || v.formation <= 0.001`.

### CTA preset

The tuned values ship as a preset in the engine (used by the lab and by marketing):

```
fieldSpeed 0.9, fieldDepth 1.6, fieldAlign 1, formationDirectness 0.8,
formationMaxTravel 0, fieldParticleSize 0.55, fieldTrailLength 0.12,
centerClearRadius 175, centerClearAspect 2.4, centerClearSquareness 2,
centerClearLeak 0.012, centerClearFalloff 5, logoScale 1.2,
logoParticleSize 0.85, logoTrailLength 0.24, logoDensity 2.25,
formationEase 0, formationWiggle 1, formationDuration 1.55,
rejoinDuration 1.08, formationInterrupt 2, formationStagger 0.3,
burstProbability 0.32, eruptionFrequency 0.065, sparkBrightness 0.46,
eruptionIntensity 0.4, fireIntensity 0.4, hotRim 0.38,
surfaceEffects 0.36, coronaMist 0.46
```

The hover ("angry sun") state overrides six of those, and scales the renderer clock
by 1.6. These become the `states.hover` block in Part 3:

```
sparkBrightness 0.76, eruptionIntensity 0.78, fireIntensity 0.7,
hotRim 0.74, surfaceEffects 0.6, coronaMist 0.64
```

### Acceptance test

Byte-identical `dist` is not available, since code is being deleted deliberately.
The engine is deterministic, so use **frame-exact parity** instead:

Render a fixed sequence of field times covering the whole lifecycle — idle, early
formation, mid-flight, formed hold, early deform, mid-deform, refill — through the
current patched `dist` and through a fresh build of the ported source, and compare
pixels. Any difference fails.

This lands as a test in the repo so later changes to the comet path are guarded the
same way.

### Rollout

Release from the engine repo (bump → tag → push; CI publishes). Then in marketing:
delete `patches/@necatikcl__stripes-engine@0.18.0.patch`, drop the
`patchedDependencies` entry from `pnpm-workspace.yaml`, and move to the published
version. This ends the patch-regeneration cycle.

## Part 2 — Schema-derived lab controls

The lab hand-writes its leva schema and is already ~16 settings behind; the port adds
more. Each comet setting declares its range once, beside its default:

```ts
fireIntensity: { default: 1, min: 0, max: 3, step: 0.01, group: "Fire" }
```

The lab's comet panel renders from that list rather than from hand-written entries,
so a new setting appears automatically.

Spiral and twizzler keep their hand-written schemas. They are not drifting, and
converting them is speculative work.

## Part 3 — Named-state API

```ts
preset = {
  settings: { fireIntensity: 0.4 /* … */ }, // base
  states: {
    hover: {
      overrides: { fireIntensity: 0.7, hotRim: 0.74 },
      timeScale: 1.6,
      transition: { durationSec: 0.25 },
    },
  },
};
```

`renderer.setState("hover" | null)` eases between base and overrides internally and
applies `timeScale` to the renderer's own clock. `overrides` is a deep partial,
matching the convention of the existing themed `dark:` blocks, so states compose with
theming rather than competing with it.

The lab gets a state picker that plays the real transition.

On the marketing side this deletes `CTA_COMET_LOGO_ANGRY_SETTINGS`, the `angryKeys`
loop, the `anger` accumulator and the `timeSec += deltaSec * (1 + anger * 0.6)` line
from `CtaTexture`; the component calls `setState` from the button's
pointerenter/leave handlers.

## Out of scope

- The 14 non-mode-0 formation paths. Deleted, not ported.
- Schema-derived controls for spiral and twizzler.
- Any change to the stripes pipeline, themes, or other shaders.
- Reworking `formationInterrupt`. It stays at 2 (a re-hover lets the deform finish),
  which is current CTA behaviour.

## Risks

- **The port is the only copy in flight.** Nothing may be deleted from the marketing
  patch until the frame-exact parity test passes against the ported source.
- **The fragment shader's hardcoded segment count** is easy to miss because it lives
  in a different string from the constant it must match. It is called out above for
  that reason.
- **Implementation happens in `section-grid-generator`**, a different repository from
  the marketing worktree this design was written in. Part 1 needs a session rooted in
  the engine repo; a worktree-isolated marketing session cannot commit there.
