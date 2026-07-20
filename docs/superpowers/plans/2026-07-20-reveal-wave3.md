# Reveal Wave 3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Natural slow turbulence settle, longer glitch, slower elliptic-sharp hadouken detonation, swap warptunnel/meteor/beam/plasma for ink/trace/pulse.

**Spec:** `docs/superpowers/specs/2026-07-20-reveal-wave3-design.md` — normative.

## Global Constraints

- All energy types: black at p 0; exact field at rest via early-outs; no springs; no pow(negative) — `x*x`; NO GLSL ES reserved words; coverage floors on mask modes.
- Controller live-loads the lab and cycles all energy types after the shader tasks.
- `pir` only; no code comments; commit per task; never set git identity; never push.

---

### Task 1: Config swap (types/normalize/leva/tests)

Same shape as the previous round's Task 1 (commit a19fb54): `RevealType` swaps warptunnel/meteor/beam/plasma → ink/trace/pulse (8 types total); normalize blocks + defaults per spec (INCLUDING turbulence 400/2600/1400 and glitch 150/900/2400 default changes at BOTH declaration sites); removed strings → assembly fallback (tested); `WARP_MODES = { turbulence: 0, glitch: 1, ink: 2, trace: 3, pulse: 4 }` + `isWarpRevealType`; leva Type dropdown 8 entries (labels Wave/Assembly/Turbulence/Glitch/Hadouken/Ink/Trace/Pulse), delete four removed groups, add `revealInk*`/`revealTrace*`/`revealPulse*` groups (6 controls each, ranges as turbulence); defaultLabConfig + underlayIntro union sync; tests (normalize defaults/fallback, revealMath durations ink 600+2400 / pulse 0+3000, topology ink↔pulse no rebuild).

- [ ] Tests first → implement → full `pir test` + `pir typecheck` green → commit `feat(engine): swap reveal modes to ink/trace/pulse (+slower turbulence, longer glitch defaults)`. Shader untouched (interim fallback expected).

---

### Task 2: energyWarp shader rewrite (5 modes)

Replace `main()` in `packages/stripes-engine/src/shaders/energyWarp.frag.ts` (keep helpers/uniforms):

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
  } else if (uMode == 3) {
    n = clamp(0.1 + 0.75 * (1.0 - texture(uField, vUv).r) + (fbm2(vUv * 6.0 + 1.3) - 0.5) * 0.3, 0.0, 1.0);
  } else {
    n = 0.12;
  }

  highp float f = clamp((p - uSpread * n) / max(uFlight, 1e-4), 0.0, 1.0);
  if (f >= 1.0) {
    finalColor = vec4(vec3(texture(uField, vUv).r), 1.0);
    return;
  }
  highp float ease = 1.0 - pow(1.0 - f, 3.0);

  if (uMode == 0) {
    highp float sOff = (fbm2(vUv * 5.0 + 21.7) - 0.5) * 0.24;
    highp float s = smoothstep(0.5 + sOff, 1.0, f);
    highp float settle = s * s * (3.0 - 2.0 * s);
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
    vec2 wv = vec2(fbm2(vUv * 3.5 + vec2(p * 0.7, 2.2)), fbm2(vUv * 3.5 + vec2(15.3, -p * 0.55))) - 0.5;
    vec2 wuv = vUv + wv * 0.28 * uIntensity;
    highp float dmin = 1e9;
    for (int k = 0; k < 3; k++) {
      highp float fk = float(k);
      vec2 ip = vec2(vhash(vec2(fk * 2.9 + 0.8, 4.1)), vhash(vec2(fk * 4.3 + 2.2, 7.9))) * 0.7 + 0.15;
      dmin = min(dmin, distance(wuv, ip));
    }
    highp float grow = ease * 1.7;
    highp float conc = smoothstep(grow, grow - 0.3, dmin);
    conc *= 0.55 + 0.45 * fbm2(wuv * 7.0 + vec2(p * 1.3, 9.4));
    conc = max(conc, smoothstep(0.93, 1.0, f));
    vec2 su = vUv + wv * 0.1 * uIntensity * (1.0 - conc);
    highp float v = texture(uField, clamp(su, 0.0, 1.0)).r;
    highp float edge = conc * (1.0 - conc) * 4.0;
    finalColor = vec4(vec3(v * conc + edge * edge * uGlow * 0.5 * fbm2(wuv * 9.0 + p)), 1.0);
    return;
  }

  if (uMode == 3) {
    highp float lum = texture(uField, vUv).r;
    highp float emerge = smoothstep(0.0, 0.18, f);
    highp float rim = emerge * (1.0 - emerge) * 4.0;
    highp float flick = 0.75 + 0.25 * sin(p * 40.0 + vhash(floor(vUv * 40.0) * 0.31 + 2.9) * 6.2831853);
    finalColor = vec4(vec3(lum * emerge * (1.0 + uGlow * 0.6 * rim * flick) + rim * rim * lum * uGlow * 1.4 * flick), 1.0);
    return;
  }

  highp float rr = length(vUv - 0.5) * (1.0 + (fbm2(vUv * 4.0 + 6.7) - 0.5) * 0.25);
  highp float mask = smoothstep(0.95, 1.0, f);
  highp float ringG = 0.0;
  for (int k = 0; k < 4; k++) {
    highp float fk = float(k);
    highp float tk = 0.1 + 0.2 * fk;
    highp float sp = mix(0.9, 2.8, fk / 3.0);
    highp float Rk = max(f - tk, 0.0) * sp;
    mask = max(mask, smoothstep(Rk, Rk - 0.07, rr) * step(tk, f));
    highp float rw = (rr - Rk) * 16.0;
    ringG += exp(-rw * rw) * step(tk, f) * (1.0 - smoothstep(tk, tk + 0.28, f)) * (0.5 + 0.3 * fk);
  }
  finalColor = vec4(vec3(texture(uField, vUv).r * mask + ringG * uGlow * 0.9), 1.0);
}
```

- [ ] `pir typecheck` + `pir test` green → commit `feat(engine): ink/trace/pulse modes + natural turbulence settle`.

---

### Task 3: Hadouken elliptic sharp gather + slower burst

**engine.ts** (hadouken branch): burst divisor 0.26 → 0.42.

**hadoukenCore.frag.ts**: replace the radius setup lines

```glsl
  vec2 a = (vUv - 0.5) * vec2(uAspect, 1.0);
  highp float r = length(a);
  vec2 edir = r > 1e-5 ? a / r : vec2(1.0, 0.0);
  highp float maxR = length(vec2(uAspect, 1.0)) * 0.5;
```

with

```glsl
  vec2 a = (vUv - 0.5) * vec2(uAspect, 1.0);
  vec2 ea = a / vec2(1.55, 1.0);
  highp float r = length(ea);
  vec2 edir = r > 1e-5 ? ea / r : vec2(1.0, 0.0);
  highp float maxR = length(vec2(uAspect / 1.55, 1.0)) * 0.5;
```

and replace the orb-noise line

```glsl
  highp float orbN = fbm2(edir * 3.0 + vec2(p * 1.1, 5.3)) - 0.5;
```

with

```glsl
  highp float oraw = fbm2(edir * 3.0 + vec2(p * 1.1, 5.3));
  highp float orbN = (1.0 - abs(2.0 * oraw - 1.0)) - 0.5;
```

and in the `orbRl` line change the `orbN * 0.35` coefficient to `orbN * 0.55`.

**hadoukenParticles.vert.ts**: target spread becomes elliptical — replace

```glsl
  vec2 targetUv = vec2(0.5) + (vec2(hashLane(id, 4u), hashLane(id, 5u)) - 0.5) * 0.05;
```

with

```glsl
  vec2 targetUv = vec2(0.5) + (vec2(hashLane(id, 4u), hashLane(id, 5u)) - 0.5) * vec2(0.1, 0.05);
```

- [ ] `pir typecheck` + `pir test` green → commit `feat(engine): hadouken elliptic sharp gather, slower detonation`.

---

### Task 4: Verification (main session)

- [ ] Live-load, cycle all energy types with error hook, capture turbulence settle / ink / trace / pulse / hadouken, show the user.
