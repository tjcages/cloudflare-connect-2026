# Reveal type promotion + turbulence hold + glitchier glitch + burn/portal/lightning + hadouken pacing

Date: 2026-07-20
Status: approved
Iterates on: 2026-07-20-hadouken-detonation-design.md

## 1. Type promotion (structural)

Energy reveals are NOT assembly — each becomes a first-class reveal type:

```ts
export type RevealType = "wave" | "assembly" | "turbulence" | "glitch" | "hadouken" | "burn" | "portal" | "lightning";
```

- `reveal.assembly` reverts to the flat scatter config (sliceSizePx, speedMinMs,
  speedMaxMs, staggerMs, scatterPx, angleJitterDeg, blurPx?, blurStart?). `AssemblyStyle`
  and the style dropdown are deleted.
- `reveal.turbulence/glitch/hadouken/burn/portal/lightning` are sibling blocks at the
  reveal level (shape: `WarpStyleConfig` = speedMin/max/stagger + intensity/detail/glow;
  hadouken additionally `particleCount`).
- `resolveRevealDurationMs`: wave → wave.durationMs; assembly → assembly block; any
  other type → that type's block (`staggerMs + speedMaxMs`).
- Migration in normalize (accept all older generations): R5/R6 shape
  (`assembly.style` + nested `assembly.{scatter,turbulence,glitch,hadouken}`) lifts —
  `assembly.scatter` → flat `assembly`, nested warp blocks → reveal-level blocks, and
  `type === "assembly"` with a non-scatter legacy style becomes that type. R4-and-older
  flat assembly fields stay the assembly block. Invalid types → `"assembly"`.
- Engine topology kinds: `"none" | "wave" | "scatter" | "warp" | "hadouken"` (turbulence/
  glitch/burn/portal/lightning share the energyWarp pass = "warp"; per-frame mode/block
  switches within "warp" don't rebuild).
- Leva: Type dropdown gains the six energy types; existing per-style groups re-predicate
  on `revealType`; new groups `revealBurn*/revealPortal*/revealLightning*` (6 controls
  each). `underlayIntro` becomes type-aware.

Defaults for new blocks (speedMin/speedMax/stagger/intensity/detail/glow):
burn 500/2000/1200/1/0.5/0.7 · portal 400/1600/300/1/0.5/0.7 · lightning 300/2400/0/1/0.5/0.8.

## 2. Turbulence hold ("stay there with vorticity, then final reveal")

Three acts within per-pixel f: ignite `emerge = smoothstep(0, 0.22, f)`; HOLD — decay
stays 1 (full displacement, flow keeps advecting, vorticity boost active) until f 0.62;
settle `decay = 1 − cubicOut(smoothstep(0.62, 1, f))`.

## 3. Glitchier glitch

Faster step clock (`floor(p·38)`), more rows (`mix(18, 70, detail)`), per-row-per-step
activity gate (45% of rows glitch each step — sparse harsh tears), 8% spike rows at 3.2×
offset, small vertical slice jitter (±0.03), row-local brightness boost on active rows,
stronger global flicker (±0.6·glow·decay), gain floored at 0.

## 4. New modes (energyWarp shader modes 2/3/4)

- **burn (2):** per-pixel ignition time from spatial fbm (existing n skeleton) — the
  front creeps organically. States: black → burning rim (ember glow `emerge·(1−emerge)·4`
  squared, noise-modulated brightness) → revealed (heat-shimmer displacement fading with
  `1 − f`). Exact field at f 1.
- **portal (3):** vertical rift at x 0.5 opens with cubic-out ease to width 0.72 (covers
  the screen), edge wobbled by animated fbm (±35%·intensity, Nether-portal energy), field
  visible only inside, bright edge ring fading as it opens, mask floor at f ≥ 0.97.
- **lightning (4):** uniform timeline (n = 0.12). Four bolts strike at f 0.16/0.34/0.52/
  0.70 — each a thin noise-jagged vertical bolt with `exp(−tk·26)` envelope, and each
  strike flash-illuminates the hidden field (`+0.16·env` alpha blink). Final flood
  `smoothstep(0.84, 0.98, f)` double-smoothed reveals fully; bolts gated out by the
  flood. Black at start; early-out at f 1.

## 5. Hadouken pacing

- Detonate earlier: `chargeEnd = flight + 0.82·max(spread, 0.2)` (blast rides in on the
  last visible batch; invisible stragglers get swallowed).
- Slower mask reveal: burst window 0.15 → 0.26 of duration.
- More eased compression: `grow = smoothstep(0, 0.5, charge)`; `cs = smoothstep(0.42,
0.82, charge)`; `comp = cs²(3 − 2cs)` (double-smoothed, completes at detonation).

## Invariants (all types)

Black at p 0; exact field at rest (f ≥ 1 early-out); cubic-out only; no pow(negative);
scatter/wave render logic untouched.
