# Reveal wave 4: lean hadouken arc, real fluid sim, storm, digital detonation

Date: 2026-07-20
Status: approved
Iterates on: 2026-07-20-reveal-wave3-design.md (user: hadouken has too many particles,
must peak EARLY and thin continuously, shorter merge, near-immediate detonation;
ink/trace/pulse rejected — replaced by fluid/storm/detonation)

## Types

`RevealType = "wave" | "assembly" | "turbulence" | "glitch" | "hadouken" | "fluid" | "storm" | "detonation"`
ink/trace/pulse deleted everywhere; removed strings → `"assembly"` fallback.
energyWarp modes: 0 turbulence · 1 glitch · 2 storm · 3 detonation. `fluid` gets its OWN
pass (feedback sim) and its own topology kind.

Defaults (speedMin/speedMax/stagger/intensity/detail/glow):
fluid 400/2800/400/1/0.5/0.7 · storm 400/2600/600/1/0.5/0.7 · detonation 200/1400/1200/1/0.5/0.8.
Hadouken defaults change: particleCount 4000 → **1800**, staggerMs 1400 → **900**.

## 1. Hadouken: lean early-peak arc, immediate detonation

- Spawn distribution: skewed triangular with mode c = 0.3 (peak ~30% into the window,
  then continuous thinning — never sits at high density):
  vert inverse-CDF `o = u < 0.3 ? sqrt(u·0.3) : 1 − sqrt((1 − u)·0.7)`;
  engine CDF `charge = lin < 0.3 ? lin²/0.3 : 1 − (1 − lin)²/0.7`.
- Detonation trigger: `chargeEnd = flight + 0.82·max(spread, 0.2)` → coefficient **0.68**.
- Defaults above shorten the merge itself.

## 2. Storm (energyWarp mode 2) — turbulence DNA, staged

n = 0.1 + fbm2(vUv·6 + 11.7)·0.1 (small jitter). Phases in f: ignite (emerge =
smoothstep(0, 0.18, f), spinning wisps); hurricane — azimuthal shear displacement
`perp·0.38·eye·spinUp` (eye = smoothstep(0.04, 0.30, r) keeps a calm center; spinUp =
smoothstep(0.05, 0.45, f)) plus one curl layer ·0.05, flow advected with p; dissipate —
per-pixel radial settle `settleStart = 0.55 + 0.35·clamp(r·1.4, 0, 1)`,
`s = smoothstep(settleStart, 1, f)` double-smoothed → decay; eye settles first, rim
last. 5-tap smear along displacement; motion glow ·1.1 and ignition glow ·1.4. Black at
f 0; exact field at rest (shared f ≥ 1 early-out; settleStart ≤ 0.9 so settle completes).

## 3. Digital detonation (energyWarp mode 3) — glitch DNA, staged

n = per-row hash (glitch-style rows mix(14, 60, detail)). Corruption intensity
`inten = smoothstep(0, 0.75, f)²`; row duty grows `mix(0.92, 0.3, inten)` (rare flickers
→ total chaos); offsets `(h − 0.5)·(0.25 + 0.45·inten)`; step clock `floor(p·46)`;
whiteout `smoothstep(0.78, 0.86, f)·(1 − smoothstep(0.88, 0.97, f))` added as
`white·glow·1.6`; master decay `1 − smoothstep(0.82, 0.95, f)` kills all corruption into
the clean snap; emerge `smoothstep(0, 0.1, f)·(0.45 + 0.55·smoothstep(0.3, 0.9, f))`
(image dimly present early, full at end — reaches exactly 1). Black at f 0; exact field
at rest.

## 4. Fluid (REAL simulation) — own pass, feedback state

- Ping-pong state pair at half field resolution, float color (RGBA16F; extend the RT
  pool/renderTarget for float if not already supported — WebGL2 EXT_color_buffer_float):
  rg = velocity (uv units/s), b = dye, a unused.
- **Sim step** (per frame while progress < 1): semi-Lagrangian advection
  `src = vUv − vel·dt`, velocity dissipation 0.985, dye 0.996; curl-noise forcing
  (central differences, ε 0.09, gain 0.045·intensity·dt·60); THREE orbiting injectors
  (`ip = 0.5 + (cos, 0.6·sin)(progress·(0.5 + 0.2k) + 2.094k)·(0.22 + 0.08k)`) each
  splatting dye `exp(−|d|²·260)·dt·(2.6 + 0.5k)` and a tangential swirl impulse
  `perp(d)·splat·dt·30·intensity`. Velocity clamped ±2, dye 0–2. dt =
  min(frameDelta, 1/30) seconds from the engine clock.
- **Composite:** global `f = clamp(p/(spread + flight))`; f ≥ 1 → plain field early-out.
  Dye visibility `visRaw = smoothstep(0.12, 0.85, dye)`, coverage floor
  `max(visRaw, smoothstep(0.88, 1, f))`; field sampled displaced by the LIVE velocity
  `−vel·0.04·(1 − vis)` (the image swirls with the fluid as it forms); dye-edge glow
  `(visRaw(1 − visRaw)·4)²·0.45·glow`. Black at start (dye 0); exact field at rest.
- **State lifecycle (engine):** clear both state RTs when rawProgress decreases
  (replay detected) or on pass build; stop stepping once progress ≥ 1 (composite
  early-outs; steady-state cost = one fullscreen fetch).
- Topology kind `"fluid"`; fluid↔warp/hadouken/scatter/wave switches rebuild.

## Process rules (standing)

Live-load + cycle every energy type after shader changes; no GLSL ES reserved words;
coverage floors on mask modes; black at p 0; exact field at rest; no springs; no
pow(negative). Ultracode: post-implementation verification runs as a parallel
adversarial review workflow (transcription, GLSL validity, per-mode invariants, config
consistency, fluid feedback lifecycle) before the live check.
