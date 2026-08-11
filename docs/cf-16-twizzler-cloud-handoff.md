# CF-16 cloud agent brief — Banner Twizzler visual match

**You are a Cursor Cloud Agent.** Work only in this repo checkout. Do not rely on any host-absolute paths under `/Users/…`.

**Linear:** [CF-16](https://linear.app/off-brand-studio/issue/CF-16/banner-51-marketing-preset) — stay **In Progress** until the human accepts. Comment progress. **Done** only after accept + ship.

---

## Mission (one sentence)

Rebuild the Banner **Twizzler** 2D hairline ribbon until a still on white matches **`apps/lab/src/presets/builtin/handoff/TARGET-twizzler.png`**, not the rejected ghost in **`…/REJECTED-current.png`**. Full rewrite of `apps/lab/src/twizzler.ts` is allowed and expected. Leva-only tweaks are forbidden. Rain stays OFF.

---

## Open these files first (ground truth)

| Role                           | Path                                                         |
| ------------------------------ | ------------------------------------------------------------ |
| **TARGET (match this)**        | `apps/lab/src/presets/builtin/handoff/TARGET-twizzler.png`   |
| **REJECTED (never ship this)** | `apps/lab/src/presets/builtin/handoff/REJECTED-current.png`  |
| Alt target (smooth continuous) | `apps/lab/src/presets/builtin/handoff/TARGET-alt-smooth.png` |
| Alt target (dramatic fan)      | `apps/lab/src/presets/builtin/handoff/TARGET-alt-fan.png`    |
| Builtin ref slot               | `apps/lab/src/presets/builtin/banner-5x1.ref.png`            |
| Preset                         | `apps/lab/src/presets/builtin/banner-5x1.json`               |
| Engine                         | `apps/lab/src/twizzler.ts`                                   |

**Acceptance bar:** Side-by-side TARGET vs your Twizzler-canvas-on-white PNG, a non-designer says “same graphic.” If you must squint, you failed.

---

## Repo / deploy (this cloud checkout)

| Item                    | Value                                                                                           |
| ----------------------- | ----------------------------------------------------------------------------------------------- |
| Branch for this handoff | `ty/cf-16-twizzler-cloud-handoff` (start here; or continue on `sync/connect-shader-preview`)    |
| Deploy remote           | `connect2026` → `tjcages/cloudflare-connect-2026`                                               |
| Ship path               | Commit → push branch → also push to `connect2026` `main` for Workers (same as prior CF-16 flow) |
| Prod URL                | https://connect-shader.off-brand.workers.dev/?factory=1&preset=Banner%205:1                     |
| Package manager         | `pnpm` (or `pi`/`pir` if present)                                                               |
| Last rejected commit    | `4dc4243` feat(lab): rewrite Twizzler as twisted hairline ribbon                                |

**Boundary:** Stay in `apps/lab/` for Twizzler matching. Do not thrash `packages/stripes-engine` to fake the look.

---

## Product vocabulary (do not confuse)

1. **Twizzler** = Canvas2D hairline ribbon from `renderTwizzler` → `canvas.lab-canvas-twizzler`. **This is the hero.**
2. **Twizzler Map** = luminance/source shader for later rain gating. **Not** the match target. Do not “fix” by enabling Connect/Twizzler-Map 3D fills.
3. **Rain** = stripes-engine dashes. **Keep disabled** until human accepts Twizzler.
4. Nickname only — **not** literal Twizzler candy (no glossy red cylinder).

**Layering trap:** `.lab-canvas-output` sits **above** `.lab-canvas-twizzler`. If `background.transparent === false`, opaque white hides the ribbon. Banner must use **transparent WebGL clear** (already intended in preset) so the ribbon shows on the white stage.

---

## Excruciating visual spec — TARGET ribbon

Canvas: **5:1** (e.g. 1600×320). Background: **flat pure white**. No rain, no UI chrome in the still you judge.

### Macro silhouette (left → right)

1. **Far left entry:** Mid / mid-low height. Cohesive **band** of many parallel hairlines (not one thread, not a filled shape).
2. **Left third:** Soft hills/valleys. Bundle **narrow–medium**. Lines mostly parallel with mild braid.
3. **~35–45% X — pinch / twist node:** Fibers **converge, overlap, cross**. Density spikes. Color reads **deeper saturated orange** from stacking.
4. **Right half — rise + fan:** Path sweeps **up to top-right**. Half-width opens wide. Hairlines become **individually readable**; white shows between them. Fan stays **clearly gold/orange/coral**, not washed pink dust.
5. **Far right exit:** Wide fanned exit still readable — **not** invisible mist, **not** a clipped needle tip on the top edge.

### Micro structure

- **~200–400** continuous parametric hairlines.
- Stroke ~**0.25–0.6px**, soft AA, continuous curves.
- Mostly parallel along a shared centerline with **differential phase/shear** so they cross at the pinch (moiré). That crossing **is** the twist.
- Optional _very subtle_ along-stroke grain; **never** a particle cloud or vertical seam ladder.
- Soft “tube” edge bias is OK only if the **core stays tinted** (no white hollow core).

### Color (non-negotiable)

| Region      | Read                                                                    |
| ----------- | ----------------------------------------------------------------------- |
| Left        | Pale gold / apricot (`#ffd89a`–`#ffe6b5`) — translucent but **visible** |
| Mid / pinch | Saturated orange via overlap                                            |
| Right fan   | Coral / `#e8481c`–`#f04a1e` — still readable when sparse                |

**Forbidden failure modes (see REJECTED):**

- Ghost-faint pale pink/salmon nearly invisible on white
- Heat-haze / spaghetti scribble with no ribbon mass
- Density inverting the gradient into “dark slab left / invisible right”
- Uniform washed peach gauze

### Opacity

Many low-alpha strokes accumulate into a **obvious mid-tone structure** on white at 100% zoom. If the screenshot needs exposure boost to see it, fail.

### Not the target

3D candy, solid filled bezier, diagonal rain, Twizzler Map hatch as hero, single thick stroke, sand/stipple cloud, purple glow UI looks.

---

## Current broken code (start point)

- `apps/lab/src/twizzler.ts` — twist-projection model + `source-atop` gold wash (visually rejected)
- `apps/lab/src/presets/builtin/banner-5x1.json` — rain off, transparent bg, high lineCount
- Wiring: `LabApp.tsx`, `playground.css`, `levaSchema.ts`, `defaultLabConfig.ts`, `twizzler.test.ts`

Investigate first if still faint: alpha too low; wash destroying chroma; opaque WebGL covering overlay; fibers too thin/transparent; stipple → dust; factory preset losing to stale state (always test with `?factory=1`).

---

## Required method

1. Open TARGET + REJECTED PNGs in-repo. Lock TARGET as sole success criterion.
2. Rewrite geometry/render until Twizzler-canvas-on-white matches TARGET.
3. Capture: build lab → preview → Playwright; export `canvas.lab-canvas-twizzler` onto `#ffffff`; also capture `.lab-canvas-stack` to prove composite visibility.
4. Engine changes first; Leva only for final trim.
5. Keep rain off.
6. Update `banner-5x1.json`, `banner-5x1.ref.png`, tests; commit with `#CF-16`; push deploy remote `main`; wait Workers green; comment CF-16; ask human to hard-refresh factory URL.
7. After **two** full rewrite attempts that still look like REJECTED, **stop** and report evidence — do not keep shipping faint pink.

### Commands

```bash
cd apps/lab
pnpm exec vitest run src/twizzler.test.ts
pnpm run build
# vite preview + Playwright still vs handoff/TARGET-twizzler.png
```

Prod after deploy:  
https://connect-shader.off-brand.workers.dev/?factory=1&preset=Banner%205:1

---

## Definition of done

- [ ] Twizzler-only white still ~1:1 with `handoff/TARGET-twizzler.png`
- [ ] Stack/composite shows the same ribbon (not hidden)
- [ ] Rain still off
- [ ] Builtin + tests updated
- [ ] Pushed + Workers green
- [ ] Human says it matches

---

## Cloud agent kickoff prompt (paste as task if needed)

```
CF-16: Match Banner Twizzler to apps/lab/src/presets/builtin/handoff/TARGET-twizzler.png.
Read docs/cf-16-twizzler-cloud-handoff.md fully first.
Do NOT match REJECTED-current.png. Full rewrite of apps/lab/src/twizzler.ts allowed; no Leva-only.
Keep rain off. Capture Twizzler canvas on white and iterate until ~1:1 with TARGET.
Ship via connect2026 main when close; leave CF-16 In Progress until human accepts.
```
