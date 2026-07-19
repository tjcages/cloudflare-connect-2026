# Reveal Types Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Promote the energy reveals to first-class reveal types, add burn/portal/lightning modes, give turbulence a hold phase, make glitch harsher, and retune hadouken pacing.

**Architecture:** `RevealType` grows to 8 values; `reveal.assembly` reverts to flat scatter config; warp-family types share the energyWarp pass (modes 0–4) with per-type config blocks; hadouken keeps its pass. Shader rewrite of energyWarp with per-mode output blocks. See spec for exact phase math.

**Tech Stack:** TypeScript, WebGL2 (GLSL ES 3.00), vitest, leva. Scripts via `pir` only.

**Spec:** `docs/superpowers/specs/2026-07-20-reveal-types-design.md` — normative for all constants/defaults/migration rules.

## Global Constraints

- Scatter and wave RENDER logic byte-identical (scatter config paths change from `assembly.scatter.*` back to `assembly.*`).
- All energy types: black at p 0, exact field at rest via `f >= 1` early-out; cubic-out only; never pow(negative-base) — write `x*x`; PCG for per-instance, sin-hash fine for continuous noise.
- Migration: R5/R6 nested shapes lift per spec; legacy `type: "assembly"` + non-scatter style becomes that type; invalid types → `"assembly"`.
- New block defaults per spec: burn 500/2000/1200/1/0.5/0.7, portal 400/1600/300/1/0.5/0.7, lightning 300/2400/0/1/0.5/0.8. Warp-block speed clamp floor stays 50; scatter 100.
- No code comments unless non-obvious constraint. `pir test` / `pir typecheck` at repo root. Commit per task. Never set git identity; never push.

---

### Task 1: Type promotion (types/normalize/migration/revealMath/engine/lab/tests)

**Files:**

- Modify: `packages/stripes-engine/src/config/types.ts` (`RevealType`, delete `AssemblyStyle`, restructure `RevealConfig`), `packages/stripes-engine/src/config/normalize.ts` (defaults + migration), `packages/stripes-engine/src/reveal/revealMath.ts`, `packages/stripes-engine/src/legacy/migrateLegacyConfig.ts` (+ test), `packages/stripes-engine/src/engine.ts` (branch conditions on `reveal.type`; `assemblyPassKind` → `revealPassKind(): "none" | "wave" | "scatter" | "warp" | "hadouken"`; `WARP_MODES = { turbulence: 0, glitch: 1, burn: 2, portal: 3, lightning: 4 }`; warp branch block = `config.reveal[type]`; hadouken branch reads `config.reveal.hadouken`; scatter branch reads flat `config.reveal.assembly`), `apps/lab/src/defaultLabConfig.ts`, `apps/lab/src/controls/levaSchema.ts` (Type dropdown: Wave/Assembly/Turbulence/Glitch/Hadouken/Burn/Portal/Lightning; delete Style dropdown; re-predicate existing groups on `Reveal.revealType`; add `revealBurn*`/`revealPortal*`/`revealLightning*` groups — 6 controls each, same ranges as the turbulence group; mapping builds the new shape), `apps/lab/src/connectShader/underlayIntro.ts` (type-aware duration)
- Tests: `normalize.test.ts` (rewrite assembly describe: per-type defaults incl. the three new blocks; R5/R6 nested-shape lift — input `{ type: "assembly", assembly: { style: "turbulence", scatter: { sliceSizePx: 50 }, turbulence: { glow: 0.2 } } }` normalizes to `type: "turbulence"`, `assembly.sliceSizePx: 50`, `turbulence.glow: 0.2`; flat R4 fields stay assembly; invalid type → assembly), `revealMath.test.ts` (duration per type: lightning = 0+2400, burn = 1200+2000; assembly unchanged), `engine.topology.test.ts` (kind helper: enabled? type==="wave"→"wave" : type==="assembly"→"scatter" : type==="hadouken"→"hadouken" : "warp"; tests: wave↔turbulence rebuilds, assembly↔burn rebuilds, turbulence↔lightning does NOT rebuild, hadouken↔portal rebuilds)

**Interfaces:** `RevealType` as in spec; `WarpStyleConfig` unchanged; `reveal.hadouken` keeps `particleCount`.

- [ ] Steps: tests first (`pir test -- normalize revealMath topology` FAIL) → implement → full `pir test` + `pir typecheck` green → commit `feat(engine): promote energy reveals to first-class reveal types (+burn/portal/lightning config)`.

Note: the energyWarp shader still has only modes 0/1 after this task — selecting burn/portal/lightning must not crash (mode uniform 2/3/4 hits no branch; mode 4 fallthrough is lightning's slot in the CURRENT shader's else — acceptable interim, Task 2 lands immediately after). Do not "fix" this in Task 1.

---

### Task 2: energyWarp shader rewrite (hold, harsher glitch, burn/portal/lightning)

**Files:**

- Modify: `packages/stripes-engine/src/shaders/energyWarp.frag.ts` — replace `main()` entirely (keep vhash/vnoise/fbm2 and uniform declarations):

```glsl
void main() {
  highp float p = max(uProgress, 0.0);
  highp float freq = mix(2.0, 10.0, uDetail);

  highp float n;
  if (uMode == 0) {
    n = fbm2(vUv * mix(3.0, 12.0, uDetail) + 7.3);
  } else if (uMode == 1) {
    highp float rows = mix(18.0, 70.0, uDetail);
    n = vhash(vec2(floor(vUv.y * rows) * 0.61, 8.8));
  } else if (uMode == 2) {
    n = fbm2(vUv * mix(3.0, 9.0, uDetail) + 4.7);
  } else {
    n = 0.12;
  }

  highp float f = clamp((p - uSpread * n) / max(uFlight, 1e-4), 0.0, 1.0);
  if (f >= 1.0) {
    finalColor = vec4(vec3(texture(uField, vUv).r), 1.0);
    return;
  }

  if (uMode == 0) {
    highp float s = smoothstep(0.62, 1.0, f);
    highp float settle = 1.0 - pow(1.0 - s, 3.0);
    highp float decay = 1.0 - settle;
    highp float emerge = smoothstep(0.0, 0.22, f);
    vec2 flow = vec2(p * 0.9, -p * 0.6);
    vec2 q1 = vUv * freq + flow + 2.1;
    vec2 q2 = vUv * freq * 2.6 + flow * 1.8 + 17.3;
    highp float e = 0.09;
    vec2 c1 = vec2(fbm2(q1 + vec2(0.0, e)) - fbm2(q1 - vec2(0.0, e)), fbm2(q1 - vec2(e, 0.0)) - fbm2(q1 + vec2(e, 0.0))) / (2.0 * e);
    vec2 c2 = vec2(fbm2(q2 + vec2(0.0, e)) - fbm2(q2 - vec2(0.0, e)), fbm2(q2 - vec2(e, 0.0)) - fbm2(q2 + vec2(e, 0.0))) / (2.0 * e);
    vec2 curlV = c1 * 0.75 + c2 * 0.35;
    highp float vort = 0.55 + 0.9 * decay;
    vec2 disp = curlV * 0.09 * vort * uIntensity * decay;
    highp float acc = 0.0;
    for (int t = 0; t < 5; t++) {
      highp float w = 0.55 + 0.225 * float(t);
      acc += texture(uField, clamp(vUv + disp * w, 0.0, 1.0)).r;
    }
    highp float v = acc * 0.2;
    highp float gain = 1.0 + uGlow * 1.2 * min(1.0, length(disp) * 8.0) * decay + uGlow * 1.6 * emerge * (1.0 - emerge);
    finalColor = vec4(vec3(v * gain * emerge), 1.0);
    return;
  }

  if (uMode == 1) {
    highp float ease = 1.0 - pow(1.0 - f, 3.0);
    highp float decay = 1.0 - ease;
    highp float emerge = smoothstep(0.0, 0.25, f);
    highp float rows = mix(18.0, 70.0, uDetail);
    highp float row = floor(vUv.y * rows);
    highp float stp = floor(p * 38.0);
    highp float active = step(0.55, vhash(vec2(row * 0.53 + stp * 1.71, 6.1)));
    highp float h = vhash(vec2(row * 0.37 + stp * 1.13, 4.2));
    highp float spike = 1.0 + step(0.92, vhash(vec2(row * 0.29 + stp * 0.97, 9.4))) * 2.2;
    vec2 disp = vec2((h - 0.5) * 0.35 * spike, (vhash(vec2(row * 0.71 + stp * 1.31, 2.6)) - 0.5) * 0.06) * active * uIntensity * decay;
    highp float acc = 0.0;
    for (int t = 0; t < 5; t++) {
      highp float w = 0.55 + 0.225 * float(t);
      acc += texture(uField, clamp(vUv + disp * w, 0.0, 1.0)).r;
    }
    highp float v = acc * 0.2;
    highp float gain = 1.0 + uGlow * 0.5 * active * decay + uGlow * 0.6 * decay * (vhash(vec2(stp, 3.7)) - 0.5) * 2.0 + uGlow * 1.2 * emerge * (1.0 - emerge);
    finalColor = vec4(vec3(v * max(gain, 0.0) * emerge), 1.0);
    return;
  }

  if (uMode == 2) {
    highp float emerge = smoothstep(0.05, 0.5, f);
    highp float rim = emerge * (1.0 - emerge) * 4.0;
    vec2 shim = (vec2(fbm2(vUv * 22.0 + p * 3.0), fbm2(vUv * 22.0 + 31.7 - p * 2.2)) - 0.5) * 0.03 * uIntensity * (1.0 - f);
    highp float v = texture(uField, clamp(vUv + shim, 0.0, 1.0)).r;
    highp float ember = rim * rim;
    finalColor = vec4(vec3(v * emerge * (1.0 + uGlow * 0.8 * rim) + uGlow * (0.55 + 0.45 * fbm2(vUv * 14.0 + p * 1.3)) * ember), 1.0);
    return;
  }

  if (uMode == 3) {
    highp float ease = 1.0 - pow(1.0 - f, 3.0);
    highp float dx = abs(vUv.x - 0.5);
    highp float e2 = fbm2(vec2(vUv.y * mix(3.0, 8.0, uDetail) + 1.7, p * 1.6)) - 0.5;
    highp float w = ease * 0.72;
    highp float edge = max(w * (1.0 + e2 * 0.35 * uIntensity), 0.0);
    highp float mask = max(smoothstep(edge, edge - 0.06, dx), smoothstep(0.97, 1.0, f));
    highp float rw = (dx - edge) * 26.0;
    highp float ring = exp(-rw * rw) * uGlow * 1.5 * (1.0 - ease);
    finalColor = vec4(vec3(texture(uField, vUv).r * mask + ring), 1.0);
    return;
  }

  highp float flood = smoothstep(0.84, 0.98, f);
  highp float fe = flood * flood * (3.0 - 2.0 * flood);
  highp float bolts = 0.0;
  highp float flash = 0.0;
  for (int k = 0; k < 4; k++) {
    highp float fk = float(k);
    highp float st = 0.16 + fk * 0.18;
    highp float tk = f - st;
    if (tk < 0.0) continue;
    highp float env = exp(-tk * 26.0);
    highp float bx = 0.14 + 0.72 * vhash(vec2(fk * 3.3 + 1.2, 5.5)) + (fbm2(vec2(vUv.y * 3.5 + fk * 7.7, fk * 13.1)) - 0.5) * 0.35 * uIntensity;
    highp float d = abs(vUv.x - bx);
    bolts += exp(-d * d * 2600.0) * env;
    flash += env * 0.16;
  }
  highp float v = texture(uField, vUv).r * min(1.0, fe + flash * uGlow);
  finalColor = vec4(vec3(v + bolts * uGlow * 1.4 * (1.0 - fe)), 1.0);
}
```

- [ ] Verify: `pir typecheck` + `pir test` green. Commit `feat(engine): turbulence hold phase, harsher glitch, burn/portal/lightning modes`.

---

### Task 3: Hadouken pacing constants

**Files:** `packages/stripes-engine/src/engine.ts` (hadouken branch): replace the chargeEnd/burst lines with

```ts
const chargeEnd = avgTotal + 0.82 * Math.max(spread, 0.2);
const burst = Math.min(1, Math.max(0, (rawProgress - chargeEnd) / 0.26));
```

`packages/stripes-engine/src/shaders/hadoukenCore.frag.ts`: replace the grow/comp pair with

```glsl
  highp float grow = smoothstep(0.0, 0.5, uCharge);
  highp float cs = smoothstep(0.42, 0.82, uCharge);
  highp float comp = cs * cs * (3.0 - 2.0 * cs);
```

(orbR formula keeps using grow/comp unchanged.)

- [ ] Verify: `pir typecheck` + `pir test` green. Commit `feat(engine): hadouken pacing (earlier detonation, slower blast, eased compression)`.

---

### Task 4: Visual verification (main session)

- [ ] All 6 energy types + scatter + wave selectable; per-type controls swap; each energy type starts black and settles exact; turbulence holds its boil mid-timeline; glitch reads harsher/sparser; burn creeps with ember rims; portal opens as a wobbling rift; lightning strikes 4× then floods; hadouken detonates promptly after the visible merge with a slower blast.
