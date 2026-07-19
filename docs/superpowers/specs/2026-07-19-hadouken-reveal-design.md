# Hadouken reveal + living warp styles (iterates on energy warp family)

Date: 2026-07-19
Status: approved
Iterates on: 2026-07-19-energy-warp-reveal-design.md (user verdict: turbulence LOVED,
glitch nice, vortex/streams/pull/ripple rejected — delete them)

## User requirements this round

1. **From nothing to shader.** The reveal compensates the page/shader loading gap, so it
   must start EMPTY and build to the field. Never show the full field instantly (the
   current warp styles start with the whole stirred image visible — flawed).
2. **Turbulence must live** — the turbulent distortion itself should flow and roil while
   active ("like the Minecraft Nether portal"), not just relax in place.
3. **New style `hadouken`** (the actual target): empty screen → energy particles appear
   everywhere → they slowly converge and merge at the CENTER → the merged charge forms a
   growing core, and the field is revealed radially outward from the center in
   proportion to how much energy has merged (Tekken/Street Fighter energy-ball charge).
4. Keep the no-spring rule: cubic-out easing only.

## Styles

`style: "scatter" | "turbulence" | "glitch" | "hadouken"` (default `"scatter"`;
invalid/legacy values fall back to scatter).

### turbulence (energyWarp mode 0) — reworked

- Displacement angle/magnitude noise is advected over time: `flow = vec2(p·2.2, −p·1.7)`
  added to the fbm coordinates — the swirl field boils while decay > 0. At decay 0 the
  output is exactly the field (rest state unchanged).
- Ignition: output is multiplied by `emerge = smoothstep(0, 0.4, f)` (f is the existing
  per-pixel jittered flight) — swirling patches of energy ignite from black instead of
  the whole field being present. Ignition glow: extra gain `uGlow·1.6·emerge·(1−emerge)`
  peaks mid-ignition.

### glitch (energyWarp mode 1) — reworked

- Same slice-offset + flicker behavior, plus `emerge = smoothstep(0, 0.25, f)` so rows
  ignite from black progressively (per-row hashed timing already exists).

### hadouken — new pass

- Instanced energy particles (procedural from gl_InstanceID via salted uint PCG hash —
  the established lesson: never sin-fract at 20k instances): spawn scattered across and
  beyond the canvas (`[−0.15, 1.15]²`), fade in over first 15% of flight, fly to
  `center ± 0.025` jitter with cubic-out ease, stretch along their motion direction
  (streak ∝ speed), shrink toward arrival, fade out over the last 15% as they merge.
- CPU-computed `charge` = fraction of particles arrived
  `clamp((rawProgress − flight) / max(spread, 0.2), 0, 1)`.
- Fullscreen core composite (drawn first, particles MAX-blended on top):
  - Reveal radius `R = maxR·1.15·charge^0.8` with an fbm-noisy, slowly-animating blob
    edge (±12.5%); field visible inside via `mask = smoothstep(Rl, Rl−0.12, r)`.
  - Boundary ring glow `exp(−((r−Rl)·9)²)·uGlow·1.2` and a center core glow whose size
    and brightness grow with charge — both fade out via `done = smoothstep(0.85, 1,
charge)` so the end state is exactly the field.
  - charge 0 → fully black (empty start requirement).

## Config

- REMOVE styles vortex/streams/pull/ripple (shader modes deleted; energyWarp keeps
  modes 0 turbulence / 1 glitch).
- KEEP `intensity` (0–2), `detail` (0–1), `glow` (0–1) — apply to all three non-scatter
  styles (hadouken: intensity scales particle size/energy 6px·intensity, detail scales
  edge-noise complexity, glow scales ring/core).
- ADD `particleCount` (default 4000, clamp 500–20000) — hadouken only.
- `uAspect` is dropped from the energyWarp shader/pass (unused by the two surviving
  modes); hadouken's pass has its own aspect uniform.
- Timing model unchanged.

## Engine

- `energyWarpPass`: uniforms lose `aspect`; mode map turbulence 0 / glitch 1.
- NEW `passes/hadoukenPass.ts` + `shaders/hadoukenCore.frag.ts`,
  `shaders/hadoukenParticles.vert.ts`, `shaders/hadoukenParticles.frag.ts` (two
  programs: fullscreen core composite, then instanced particles with gl.MAX blend; VAO
  for attributeless instancing; disposes everything).
- Topology: `assemblyPassKind` → `"none" | "scatter" | "warp" | "hadouken"` (warp↔
  hadouken rebuilds; turbulence↔glitch does not).

## Lab

- Style dropdown: Scatter | Turbulence | Glitch | Hadouken.
- `Particle count` (500–20000, step 100) renders only for hadouken; Intensity/Detail/
  Glow render for any non-scatter style.

## Testing

- normalize: 4-style list, particleCount defaults/clamps, legacy fallback.
- topology: scatter↔warp, warp↔hadouken rebuild; turbulence↔glitch and param changes
  don't.
- Visual: all three styles start from black; turbulence roils; hadouken particles
  converge and the image blooms from center; all settle to the exact field.

## Out of scope

- No overshoot/spring easing. No changes to scatter or wave.
