# Reveal Wave 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Random turbulence reveal order, longer/more varied glitch, natural hadouken arc (triangular spawn, long straight streaks, no rotation), delete burn/portal/lightning, add warptunnel/meteor/beam/plasma.

**Architecture:** `RevealType` swaps three members; energyWarp becomes 6 modes (0 turbulence, 1 glitch, 2 warptunnel, 3 meteor, 4 beam, 5 plasma); hadouken particle vert loses spin/wobble and gains a triangular start-time distribution mirrored by a CPU charge-shaping curve.

**Tech Stack:** TypeScript, WebGL2 (GLSL ES 3.00), vitest, leva. Scripts via `pir` only.

**Spec:** `docs/superpowers/specs/2026-07-20-reveal-wave2-design.md` — normative (defaults, distributions, mode behavior, process rule).

## Global Constraints

- Scatter/wave/hadouken-core render logic untouched (hadouken changes are vert + engine constants only this round).
- All energy types: black at p 0; exact field at rest via the shared `f >= 1` early-out; cubic-out only; no pow(negative-base) — `x*x`; NO GLSL ES reserved words as identifiers (active, filter, input, output, half, fixed, long, short, union, sample, buffer, patch, ...).
- Glitch new defaults: speedMaxMs 600, staggerMs 1100. New blocks per spec defaults.
- After the shader task lands, the CONTROLLER (main session) live-loads the lab and cycles all six warp types before the round is called done — unit tests do not compile GLSL.
- No code comments unless non-obvious constraint. `pir test`/`pir typecheck` at repo root. Commit per task. Never set git identity; never push.

---

### Task 1: Config swap (types/normalize/leva/tests)

**Files:**

- Modify: `packages/stripes-engine/src/config/types.ts` (`RevealType` swaps burn/portal/lightning → warptunnel/meteor/beam/plasma; block fields renamed accordingly), `packages/stripes-engine/src/config/normalize.ts` (delete burn/portal/lightning blocks + defaults; add warptunnel/meteor/beam/plasma per spec defaults; glitch defaults speedMaxMs 600 / staggerMs 1100; migration: the invalid-type fallback already sends removed strings to `"assembly"` — verify), `packages/stripes-engine/src/legacy/migrateLegacyConfig.ts` (+ test), `packages/stripes-engine/src/engine.ts` (`WARP_MODES = { turbulence: 0, glitch: 1, warptunnel: 2, meteor: 3, beam: 4, plasma: 5 }`; `isWarpRevealType` list updated; kind bucketing unchanged), `apps/lab/src/defaultLabConfig.ts`, `apps/lab/src/controls/levaSchema.ts` (Type dropdown: Wave/Assembly/Turbulence/Glitch/Hadouken/Warp Tunnel/Meteor/Beam/Plasma; delete the three removed groups; add `revealWarpTunnel*`/`revealMeteor*`/`revealBeam*`/`revealPlasma*` groups — 6 controls each, ranges as turbulence's; mapping updated), `apps/lab/src/connectShader/underlayIntro.ts` only if it enumerates types (it indexes `reveal[type]` — verify compiles).
- Tests: `normalize.test.ts` (new-block defaults incl. glitch 600/1100; `"burn"`/`"portal"`/`"lightning"` fall back to `"assembly"`), `revealMath.test.ts` (durations: meteor 0+2600, plasma 900+2000), `engine.topology.test.ts` (update any literals naming removed types; warptunnel↔plasma no rebuild).

- [ ] Tests first → FAIL → implement → full `pir test` + `pir typecheck` green → commit `feat(engine): swap reveal modes to warptunnel/meteor/beam/plasma (+longer glitch defaults)`.

Interim note: after this task the shader lacks modes 2–5 behavior for the new types (they hit old branches or fall through) — expected; Task 2 lands next. Do not modify the shader here.

---

### Task 2: energyWarp shader rewrite (6 modes)

**Files:** `packages/stripes-engine/src/shaders/energyWarp.frag.ts` — replace `main()` entirely (keep vhash/vnoise/fbm2 + uniforms):

```glsl
void main() {
  highp float p = max(uProgress, 0.0);
  highp float freq = mix(2.0, 10.0, uDetail);

  highp float n;
  if (uMode == 0) {
    highp float n0 = fbm2(vUv * mix(4.0, 14.0, uDetail) + 7.3);
    highp float n1 = vhash(floor(vUv * mix(8.0, 26.0, uDetail)) * 0.173 + 3.7);
    n = clamp(mix(n0, n1, 0.55), 0.0, 1.0);
  } else if (uMode == 1) {
    highp float rowsC = mix(8.0, 24.0, uDetail);
    highp float rowsF = mix(40.0, 120.0, uDetail);
    n = clamp(vhash(vec2(floor(vUv.y * rowsC) * 0.61, 8.8)) * 0.6 + vhash(vec2(floor(vUv.y * rowsF) * 0.13, 5.2)) * 0.4, 0.0, 1.0);
  } else if (uMode == 2) {
    n = 0.1 + 0.45 * length(vUv - 0.5) * 1.2;
  } else if (uMode == 5) {
    highp float dmin = 1e9;
    for (int k = 0; k < 4; k++) {
      highp float fk = float(k);
      vec2 sd = vec2(vhash(vec2(fk * 2.7 + 0.4, 3.9)), vhash(vec2(fk * 5.1 + 1.8, 8.3))) * 0.8 + 0.1;
      dmin = min(dmin, distance(vUv, sd));
    }
    n = clamp(0.12 + 0.88 * (dmin * 1.35 + (fbm2(vUv * 5.0 + 3.3) - 0.5) * 0.4), 0.0, 1.0);
  } else {
    n = 0.1;
  }

  highp float f = clamp((p - uSpread * n) / max(uFlight, 1e-4), 0.0, 1.0);
  if (f >= 1.0) {
    finalColor = vec4(vec3(texture(uField, vUv).r), 1.0);
    return;
  }
  highp float ease = 1.0 - pow(1.0 - f, 3.0);

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
    highp float decay = 1.0 - ease;
    highp float emerge = smoothstep(0.0, 0.25, f);
    highp float rowsC = mix(8.0, 24.0, uDetail);
    highp float rowsF = mix(40.0, 120.0, uDetail);
    highp float rowC = floor(vUv.y * rowsC);
    highp float rowF = floor(vUv.y * rowsF);
    highp float stp = floor(p * 38.0);
    highp float actC = step(0.6, vhash(vec2(rowC * 0.53 + stp * 1.71, 6.1)));
    highp float actF = step(0.72, vhash(vec2(rowF * 0.41 + stp * 1.29, 3.3)));
    highp float magVar = 0.4 + 0.6 * vhash(vec2(stp * 0.77, 1.9));
    highp float hC = vhash(vec2(rowC * 0.37 + stp * 1.13, 4.2));
    highp float hF = vhash(vec2(rowF * 0.23 + stp * 0.87, 7.6));
    highp float spike = 1.0 + step(0.93, vhash(vec2(rowC * 0.29 + stp * 0.97, 9.4))) * 2.6;
    vec2 disp = vec2((hC - 0.5) * 0.4 * spike * actC + (hF - 0.5) * 0.18 * actF, (vhash(vec2(rowC * 0.71 + stp * 1.31, 2.6)) - 0.5) * 0.08 * actC) * magVar * uIntensity * decay;
    highp float acc = 0.0;
    for (int t = 0; t < 5; t++) {
      highp float w = 0.55 + 0.225 * float(t);
      acc += texture(uField, clamp(vUv + disp * w, 0.0, 1.0)).r;
    }
    highp float v = acc * 0.2;
    highp float gain = 1.0 + uGlow * 0.5 * actC * decay + uGlow * 0.6 * decay * (vhash(vec2(stp, 3.7)) - 0.5) * 2.0 + uGlow * 1.2 * emerge * (1.0 - emerge);
    finalColor = vec4(vec3(v * max(gain, 0.0) * emerge), 1.0);
    return;
  }

  if (uMode == 2) {
    highp float zoom = mix(3.5, 1.0, ease);
    highp float emerge = smoothstep(0.0, 0.15, f);
    highp float acc = 0.0;
    for (int t = 0; t < 7; t++) {
      highp float zt = mix(zoom, 1.0, float(t) / 6.0);
      vec2 su = 0.5 + (vUv - 0.5) / zt;
      acc += texture(uField, clamp(su, 0.0, 1.0)).r;
    }
    highp float v = acc / 7.0;
    highp float gain = 1.0 + uGlow * 0.9 * min(1.0, (zoom - 1.0) * 0.8);
    finalColor = vec4(vec3(v * gain * emerge), 1.0);
    return;
  }

  if (uMode == 3) {
    highp float mask = smoothstep(0.96, 1.0, f);
    highp float glowAcc = 0.0;
    for (int k = 0; k < 5; k++) {
      highp float fk = float(k);
      highp float th = 0.12 + 0.15 * fk;
      vec2 tgt = vec2(0.15 + 0.7 * vhash(vec2(fk * 3.1 + 0.7, 2.3)), 0.2 + 0.6 * vhash(vec2(fk * 4.7 + 1.9, 6.6)));
      highp float ang2 = vhash(vec2(fk * 1.3 + 0.2, 9.1)) * 6.2831853;
      vec2 dk = vec2(cos(ang2), sin(ang2));
      if (f < th) {
        highp float tt = f / th;
        vec2 head = tgt - dk * 0.9 * (1.0 - tt);
        vec2 tail = head - dk * 0.22;
        vec2 pa = vUv - head;
        vec2 ba = tail - head;
        highp float hseg = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
        highp float dseg = length(pa - ba * hseg);
        glowAcc += exp(-dseg * dseg * 4200.0) * tt * 1.2;
      } else {
        highp float tp = (f - th) / max(1.0 - th, 1e-4);
        highp float pe = 1.0 - pow(1.0 - tp, 3.0);
        highp float en = (fbm2(normalize(vUv - tgt + vec2(1e-4)) * 2.5 + fk * 3.7 + vec2(0.0, p * 1.1)) - 0.5) * 0.3;
        highp float Rk = 1.6 * pe * (1.0 + en);
        highp float dd = distance(vUv, tgt);
        mask = max(mask, smoothstep(Rk, Rk - 0.09, dd));
        highp float rw = (dd - Rk) * 14.0;
        glowAcc += exp(-rw * rw) * (1.0 - pe) * 0.8 + exp(-tp * 9.0) * exp(-dd * dd * 60.0) * 1.4;
      }
    }
    finalColor = vec4(vec3(texture(uField, vUv).r * mask + glowAcc * uGlow), 1.0);
    return;
  }

  if (uMode == 4) {
    highp float sweep = smoothstep(0.25, 0.9, f);
    highp float se = 1.0 - pow(1.0 - sweep, 3.0);
    highp float bx = mix(0.06, 1.02, se);
    highp float damp = 1.0 - smoothstep(0.85, 1.0, f);
    highp float behind = smoothstep(bx, bx - 0.05, vUv.x) * smoothstep(0.25, 0.32, f);
    highp float wake = exp(-max(bx - vUv.x, 0.0) * 9.0) * behind * damp;
    vec2 disp = (vec2(fbm2(vUv * 9.0 + vec2(p * 2.4, 3.1)), fbm2(vUv * 9.0 + vec2(17.9, -p * 1.9))) - 0.5) * 0.12 * uIntensity * wake;
    highp float acc = 0.0;
    for (int t = 0; t < 5; t++) {
      highp float w = 0.55 + 0.225 * float(t);
      acc += texture(uField, clamp(vUv + disp * w, 0.0, 1.0)).r;
    }
    highp float v = acc * 0.2 * behind * (1.0 + uGlow * 0.8 * wake);
    highp float db = abs(vUv.x - bx);
    highp float beamAmp = damp * (f < 0.25 ? 0.55 + 0.25 * sin(p * 14.0) : 1.0);
    highp float beamG = (exp(-db * db * 2400.0) * 1.3 + exp(-db * db * 180.0) * 0.5) * uGlow * beamAmp;
    finalColor = vec4(vec3(v + beamG), 1.0);
    return;
  }

  highp float emerge = smoothstep(0.02, 0.45, f);
  highp float rim = emerge * (1.0 - emerge) * 4.0;
  vec2 disp = (vec2(fbm2(vUv * 11.0 + vec2(p * 1.7, 4.4)), fbm2(vUv * 11.0 + vec2(23.1, -p * 1.4))) - 0.5) * 0.12 * uIntensity * rim;
  highp float acc = 0.0;
  for (int t = 0; t < 5; t++) {
    highp float w = 0.55 + 0.225 * float(t);
    acc += texture(uField, clamp(vUv + disp * w, 0.0, 1.0)).r;
  }
  highp float v = acc * 0.2;
  highp float plasmaG = rim * rim * (0.6 + 0.4 * fbm2(vUv * 8.0 + p * 1.9)) * uGlow * 1.6;
  finalColor = vec4(vec3(v * emerge * (1.0 + uGlow * 0.5 * rim) + plasmaG), 1.0);
}
```

- [ ] `pir typecheck` + `pir test` green → commit `feat(engine): warptunnel/meteor/beam/plasma modes, random turbulence order, varied glitch`. The controller performs the mandatory live-load check right after this commit.

---

### Task 3: Hadouken natural arc

**Files:**

- Modify: `packages/stripes-engine/src/shaders/hadoukenParticles.vert.ts` — replace `main()` (keep pcg/hashLane + declarations; `uAspect` stays):

```glsl
void main() {
  highp uint id = uint(gl_InstanceID);
  highp float u0 = hashLane(id, 1u);
  highp float o = u0 < 0.5 ? sqrt(0.5 * u0) : 1.0 - sqrt(0.5 * (1.0 - u0));
  highp float p = max(uProgress, 0.0);
  highp float f = clamp((p - uSpread * o) / max(uFlight, 1e-4), 0.0, 1.0);
  if (f <= 0.0 || f >= 1.0) {
    vQuad = vec2(0.0);
    vVal = 0.0;
    gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
    return;
  }
  vec2 startUv = vec2(hashLane(id, 2u), hashLane(id, 3u)) * 1.3 - 0.15;
  vec2 targetUv = vec2(0.5) + (vec2(hashLane(id, 4u), hashLane(id, 5u)) - 0.5) * 0.05;
  vec2 asp = vec2(uAspect, 1.0);
  vec2 rel = (startUv - targetUv) * asp;
  highp float rad = length(rel);
  vec2 dirN = rad > 1e-5 ? -rel / rad : vec2(1.0, 0.0);
  highp float ease = 1.0 - pow(1.0 - f, 3.0);
  vec2 posA = rel * (1.0 - ease);
  highp float orb = step(hashLane(id, 8u), 0.12);
  highp float speed = 3.0 * (1.0 - f) * (1.0 - f) * rad;
  highp float stretch = mix(1.0 + min(14.0, speed * 34.0), 1.0, orb);
  highp float sizeScale = (0.6 + 0.8 * hashLane(id, 7u)) * (1.0 - 0.55 * ease) * (1.0 + 1.6 * orb);
  highp float sizeA = 0.5 * uSizeUv.y * sizeScale;
  int vid = gl_VertexID;
  highp float qx = (vid == 1 || vid == 2 || vid == 4) ? 1.0 : 0.0;
  highp float qy = (vid == 2 || vid == 4 || vid == 5) ? 1.0 : 0.0;
  vec2 corner0 = (vec2(qx, qy) - 0.5) * 2.0 * sizeA * vec2(stretch, 1.0);
  vec2 rot = vec2(corner0.x * dirN.x - corner0.y * dirN.y, corner0.x * dirN.y + corner0.y * dirN.x);
  vec2 uvPos = targetUv + (posA + rot) / asp;
  vQuad = vec2(qx, qy);
  highp float fadeIn = smoothstep(0.0, 0.12, f);
  highp float fadeOut = 1.0 - smoothstep(0.85, 1.0, f);
  vVal = (0.55 + 0.45 * hashLane(id, 12u)) * fadeIn * fadeOut * (1.0 + 0.3 * orb);
  gl_Position = vec4(uvPos * 2.0 - 1.0, 0.0, 1.0);
}
```

(Lanes 6/9/10/11 — old spin/wobble — become unused; that is fine, do not renumber the others.)

- Modify: `packages/stripes-engine/src/engine.ts` (hadouken branch) — after the existing `lin`-style clamp, shape charge to the triangular arrival CDF. Replace:

```ts
const charge = Math.min(1, Math.max(0, (rawProgress - avgTotal) / Math.max(spread, 0.2)));
```

with:

```ts
const lin = Math.min(1, Math.max(0, (rawProgress - avgTotal) / Math.max(spread, 0.2)));
const charge = lin < 0.5 ? 2 * lin * lin : 1 - 2 * (1 - lin) * (1 - lin);
```

- [ ] `pir typecheck` + `pir test` green → commit `feat(engine): hadouken natural arc (triangular spawn, long straight streaks, no spin)`.

---

### Task 4: Verification (main session)

- [ ] Controller live-loads the lab, cycles all 9 types (esp. the 6 warp modes + hadouken), confirms no crash, black starts, settles exact; captures representative frames; shows the user.
