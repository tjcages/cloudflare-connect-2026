# Handoff prompt — CF-16 Banner Twizzler (copy everything below the line into a new agent)

---

## Mission

You are taking over **CF-16: Banner 5:1 marketing preset** for Cloudflare Connect.

**Goal:** Make the lab’s **Twizzler** (2D hairline ribbon overlay) still-frame match the **marketing target image** ~1:1 on a **5:1** canvas (1600×320). Logo/text are out of scope. **Rain/stripes stay OFF** until the user explicitly accepts the Twizzler.

**Do not** ship another faint pink scribble. **Do not** only tweak Leva. You may **fully rewrite** `apps/lab/src/twizzler.ts` (and related wiring). The previous agent’s rewrite was visually rejected.

**Linear:** [CF-16](https://linear.app/off-brand-studio/issue/CF-16/banner-51-marketing-preset) — keep **In Progress**. Mark **Done** only when the user accepts the still.

---

## Repo / branch / deploy

| Item | Value |
|------|--------|
| Worktree | `/Users/ty/Workspace/cloudflare-connect` |
| Branch | `sync/connect-shader-preview` (also push `connect2026` `main` for Workers) |
| Remote (deploy) | `connect2026` → `tjcages/cloudflare-connect-2026` |
| Prod | https://connect-shader.off-brand.workers.dev/?factory=1&preset=Banner%205:1 |
| Package manager | Prefer `pi` / `pir`; this env often uses `pnpm` |
| Boundary | Connect/lab Twizzler work is in `apps/lab/`. Do not thrash `packages/stripes-engine` for this match. |
| Last bad commit | `4dc4243` — `feat(lab): rewrite Twizzler as twisted hairline ribbon (#CF-16)` |

**Hard rule:** After changes, capture a **Twizzler-canvas-only still on white**, compare to the target PNG, then commit + push `connect2026` HEAD and `HEAD:main`, wait for Workers build green, then ask the user to hard-refresh the factory URL.

---

## Reference images (ground truth)

### TARGET (correct) — match this exactly

Path:

`/Users/ty/.cursor/projects/Users-ty-Workspace-connect/assets/image-204ccdac-ef71-435a-ad2b-f5a6ad659c50.png`

Also earlier targets (same family):

- `/Users/ty/.cursor/projects/Users-ty-Workspace-connect/assets/Screenshot_2026-08-11_at_2.35.46_PM-fdd1ec21-7694-45e5-b109-ca0925c625da.png`
- `/Users/ty/.cursor/projects/Users-ty-Workspace-connect/assets/image-857cc51b-1299-4948-9cee-f934b848b922.png`

Builtin ref slot: `apps/lab/src/presets/builtin/banner-5x1.ref.png` (replace with the accepted target when close).

### REJECTED (what NOT to ship) — current prod look

Path:

`/Users/ty/.cursor/projects/Users-ty-Workspace-connect/assets/Screenshot_2026-08-11_at_3.02.30_PM-b6275445-5447-4d31-944a-f0ef5f4d78c2.png`

Symptoms of failure: ghost-faint pale pink/salmon; almost invisible on white; wispy “heat haze” / spaghetti scribble; no readable ribbon mass; no gold→orange→coral presence; no convincing pinch/braid density.

**Acceptance bar:** Side-by-side with the TARGET, a non-designer should say “same graphic.” If someone has to squint to see the ribbon, you failed.

---

## Product vocabulary (do not confuse)

1. **Twizzler** = the **2D Canvas2D hairline ribbon** drawn by `renderTwizzler` onto `canvas.lab-canvas-twizzler`. This is the **hero** for Banner 5:1 matching.
2. **Twizzler Map** = luminance/source shader that can gate rain later. **Not** the look to match. Do not “fix” the match by turning on Connect/Twizzler-Map 3D fills.
3. **Rain** = stripes-engine dashed stripes. **Keep disabled** (near-invisible stripes / transparent clear) until Twizzler is accepted.
4. This is **not** literal Twizzler candy (glossy red cylinder). It is Cloudflare’s marketing **hairline ribbon** nickname.

Layering note that burned the last agent:

- Output WebGL canvas is **above** Twizzler (`z-index`). If `background.transparent === false`, opaque white **hides** the ribbon. Banner preset must keep **transparent WebGL background** (or equivalent) so the ribbon is visible on white stage.

---

## Excruciating visual spec of the CORRECT Twizzler

Aspect: **~5:1** wide banner. Background: **flat pure white**. No rain, no grain cloud, no logo, no UI chrome in the still you judge.

### Macro silhouette (read left → right)

1. **Entry (far left):** Ribbon enters at roughly **mid / mid-low** height — not top, not bottom. Width is a **cohesive band** of many parallel hairlines (not a single thread, not a solid fill).
2. **Left third:** Soft undulation — small hills/valleys. Bundle stays relatively **narrow–medium**, lines mostly parallel with mild braid.
3. **Center / center-left (~35–45% X):** **Pinch / twist node.** Lines **converge**, overlap, and cross. Density spikes. Color reads **darker / more saturated orange** because of stacking, not because you painted a blob.
4. **Rise + fan (right half):** After the pinch, the path **sweeps up** toward the **top-right**. Half-width **opens dramatically**. Individual hairlines become **clearly separable**; white shows between them. The fan is airy but still **clearly orange/coral**, not washed-out pink dust.
5. **Exit (far right):** Bundle remains a readable ribbon exit — wide, fanned, still colored — **not** dissolving into invisible mist and **not** collapsing to a needle tip against the top edge.

Centerline feel (normalize Y, 0=top): low-left → gentle waves → valley/pinch → steep rise to top-right. Keep the whole fan **on-canvas**; do not clip the fan into a fake point.

### Micro structure (what “hairline ribbon” means)

- **Count:** On the order of **hundreds** of fibers (marketing looks dense; ~200–400 is a sane range), each a continuous parametric stroke.
- **Stroke:** ~**0.25–0.6 CSS/px** hairlines. Soft AA. Continuous curves (splines / dense polylines). Optional *very subtle* stipple/grain along the stroke if it matches the target; **never** a particle cloud or vertical seam ladder.
- **Parallelism with braid:** Fibers are **mostly parallel** along a shared centerline, but **not** perfectly offset clones. Mild differential phase / shear so they **cross** at the pinch (moiré / mesh). That crossing is the “twist,” not a 3D candy helix.
- **Width modulation:** Intrinsic half-width grows left→right; **visible pinch** comes from fibers packing + mild edge-on collapse, **not** from deleting the ribbon.
- **Hollow / tube cue (subtle):** When face-on (fan), slight bias of mass toward the **outer edges** of the bundle can read as a soft tube — but the **core must stay tinted**. Previous failure modes: hollow → white core glow, or over-hollow → empty gauze.

### Color (non-negotiable)

Warm Cloudflare marketing oranges — **high key but present**.

| Region | Color read |
|--------|------------|
| Far left | **Pale gold / warm apricot** (`~#ffd89a`–`#ffe6b5` family) — translucent but **visible** |
| Mid / pinch | **Saturated orange** builds via overlap |
| Right fan | **Coral / international orange** (`~#e8481c`–`#f04a1e`) — still readable when sparse |

Rules that previous attempts violated:

- Density must **not** invert the gradient (dense left ≠ “dark left forever,” sparse right ≠ “invisible pink”).
- If stacking darkens the left, **compensate** (lower left alpha, gold wash on ribbon pixels only, stronger right alpha, etc.).
- **Never** end up with a uniform faint salmon ghost on white.
- Edge fibers may pick up a touch of brighter gold (`colorEdge`), but do not bleach the fan.

Suggested anchors (tune against the PNG, not dogma):

- `colorFar` ≈ `#ffd89a`
- `colorNear` ≈ `#e8481c`
- `colorEdge` ≈ `#ffc857` / `#ffe08a`

### Density / opacity

- Accumulation does the work: many low-alpha strokes → rich mass where they pack.
- On white, the ribbon must have **clear presence** in a screenshot at 100% zoom without boosting exposure.
- Target contrast: if you flatten the image to grayscale, the ribbon is an obvious mid-tone structure, not a 5% noise floor.

### What the target is NOT

- Not a 3D Twizzler candy
- Not a solid filled bezier ribbon
- Not diagonal rain slabs
- Not Twizzler Map hatch fill as the hero
- Not a single thick stroked path
- Not stipple dots / sand
- Not purple/glow UI aesthetics

---

## Current broken implementation (start here)

Primary file: **`apps/lab/src/twizzler.ts`**

Recent approach (failed):

- Marketing centerline / width / twist helpers (`twizzlerMarketingCenterY`, `twizzlerMarketingWidth`, `twizzlerMarketingTwist`)
- Fibers projected with `across * halfW * cos(θ)` style face amount
- Continuous strokes + `source-atop` pale-gold wash
- Banner preset: rain off, transparent background, high lineCount, etc. in `apps/lab/src/presets/builtin/banner-5x1.json`

**Why it still looks wrong (from user reject still):**

- Final composite reads as **ultra-faint pink gauze**, not the bold gold→orange ribbon
- Likely causes to investigate first: alpha too low after wash; wash/composite destroying chroma; wrong layer visibility; fibers too thin + too transparent; path/width too anemic; stipple making it dust-like; Leva/localStorage fighting builtin factory values

Related files:

- `apps/lab/src/LabApp.tsx` — `renderTwizzler` tick, canvas stack
- `apps/lab/src/playground.css` — `.lab-canvas-twizzler` under `.lab-canvas-output`
- `apps/lab/src/controls/levaSchema.ts`, `apps/lab/src/defaultLabConfig.ts`
- `apps/lab/src/twizzler.test.ts`, `apps/lab/src/presets.test.ts`
- `apps/lab/src/twizzlerVisibility.ts`

---

## Required working method

1. Open TARGET and REJECTED side by side. Lock the TARGET as the only success criterion.
2. Rewrite geometry/render until a **canvas-only PNG on white** matches TARGET silhouette, density, and color.
3. Capture method that worked before:
   - Build lab, `vite preview`, Playwright
   - `factory=1&preset=Banner%205:1`
   - Export `canvas.lab-canvas-twizzler` composited onto `#ffffff` (not a full UI screenshot)
   - Also capture `.lab-canvas-stack` to verify the user-visible composite isn’t hiding the ribbon under opaque WebGL
4. Iterate on **engine code**. Leva is for fine trim after the model is right.
5. Keep rain off. Do not “fix” emptiness by enabling stripes.
6. When close: update `banner-5x1.json` + `banner-5x1.ref.png`, tests, commit with `#CF-16`, push `connect2026` branch + `main`, confirm Workers build success, comment CF-16, ask user for visual accept.
7. **Stop and ask** if two full rewrite attempts still look like the rejected ghost still — do not burn the user’s patience with more faint pink.

### Verification commands

```bash
cd /Users/ty/Workspace/cloudflare-connect/apps/lab
pnpm exec vitest run src/twizzler.test.ts
pnpm run build
# preview + Playwright still on white, compare to target PNG
```

Prod check after deploy:

https://connect-shader.off-brand.workers.dev/?factory=1&preset=Banner%205:1  

Must use **factory=1** (or Factory reset) so builtin preset wins over stale localStorage.

---

## Definition of done

- [ ] Twizzler-only still on white is visually ~1:1 with TARGET PNG (path, pinch, fan, hairlines, gold→coral)
- [ ] Stack/composite view shows the same ribbon (not hidden under opaque WebGL)
- [ ] Rain still off
- [ ] Builtin Banner 5:1 + tests updated
- [ ] Pushed + Workers green
- [ ] User says it matches

Until then, CF-16 stays **In Progress**.

---

## One-line summary for the agent

**Rebuild the Banner Twizzler until it looks like the bold gold-to-coral hairline ribbon in `image-204ccdac-…png`, not the faint pink scribble in `Screenshot_2026-08-11_at_3.02.30_PM-….png` — full shader rewrite allowed; rain stays off; Leva-only is forbidden.**
