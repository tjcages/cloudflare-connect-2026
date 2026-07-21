# Experiments Lab — Wave 2 Roster

Wave 1 verdicts (from the user, 2026-07-21): detonation-bloom loved. burn-away liked but only when it reveals diagonally. comet-embers barely visible. gravity-well too wiggly. magnetic-grain malformed the texture even when idle. ripple-wake duplicated the engine's built-in `cursorTrail.type: "wave"`. print-head, rain-wash, aurora-curtains, murmuration, lava-blobs all rejected. Stars need to be far more visible and need more variants.

Removed in wave 2: ripple-wake, magnetic-grain, print-head, rain-wash, aurora-curtains, murmuration, lava-blobs.

## THE PALETTE RULE (read before designing anything)

Every tile now inherits the shared preset (`preset.ts` / `preset.settings.json`): an orange background (#F46021) under an 8-stop orange→amber stripe ramp. There is very little luminance range, so **effects that only add brightness disappear**. This is why comet-embers and the ambience tiles failed and why detonation-bloom succeeded — its shock ring _displaces the stripe geometry_.

Therefore, in priority order, an effect must read through:

1. **Displacement / warp** — push, bend, stretch, tear, swirl the stripe geometry. Strongest signal on this palette.
2. **Density and width change** — make stripes bunch, thin, fatten, or drop out. Second strongest.
3. **Brightness** — only as an accent on top of 1 or 2, never as the sole carrier.

Anything designed as "glowing thing on dark background" will fail. Also: an effect must not disturb the base image when idle (magnetic-grain's fatal flaw) — at rest, the tile shows the clean preset render.

Debug aid: **Shift+S** toggles stripes off page-wide, showing the raw black/white field. Use it to confirm the field content is correct, but always judge the final look with stripes ON.

## Cursor trails

### comet-embers (FIX — barely visible)

Keep the comet concept, make it unmissable: the head must _shove the stripes aside_ (displacement bow-wave), embers must be big enough to bend or break stripe segments as they fly, and the trail must carve a visible wake through the stripe geometry rather than glow over it. Bigger, denser, more forceful.

### stripe-drag (NEW)

The cursor grabs the stripe field like cloth and drags it: stripes near the cursor stretch and lag behind the motion, tearing into elongated ribbons, then snap back elastically with a damped overshoot when released. Pure displacement — no glow at all.

### vortex-comb (NEW)

The cursor combs the stripes into swirling eddies: motion injects vorticity that advects the field, spinning off small vortices that persist and slowly dissipate. Crossing an old eddy disturbs it. Reads entirely through geometry.

## Cursor clicks

### detonation-bloom (KEEP — untouched)

The user loves it. Do not modify this file.

### sonar-lens (KEEP)

Not flagged. Leave as is.

### gravity-well (FIX — too wiggly)

Same press-and-hold attractor, but firm and heavy instead of jittery: remove the high-frequency wobble, tighten the spiral into a smooth continuous inward pull, and make the release a single confident elastic snap with at most one soft overshoot — not a shimmy.

## Reveals

### burn-away (FIX — diagonal only)

The user likes this one _specifically when it burns diagonally_. Lock the burn front to a diagonal sweep every run (vary only the corner it starts from and the noise seed, never the axis). Keep the irregular ember frontier.

### iris-blades (NEW)

A mechanical camera iris: 6-8 hard-edged blades rotate open from the center, each blade's edge cutting cleanly across the stripe geometry, revealing the image in the widening aperture. Precise and mechanical, with weight — accelerate then settle.

### molten-pour (NEW)

The image pours in as molten liquid from one corner: a gravity-driven flow with a bright leading meniscus that bulges and distorts the stripes ahead of it, filling and settling with surface tension. Diagonal flow direction.

### shard-shatter (NEW)

The field cracks into angular shards along propagating fracture lines, and the shards rotate and fall away to reveal the image beneath. The cracks themselves must displace the stripes as they propagate.

## Ambience

All three wave-1 ambience tiles were rejected for being faint haze. These replacements are displacement-first and must be clearly visible at rest with no cursor input.

### heat-shimmer (NEW)

Rising heat distortion, like hot air over asphalt: columns of refraction rise and wobble the stripe geometry, stronger at the bottom, dissipating toward the top. Perfect fit for the warm palette.

### breathing-swell (NEW)

The whole stripe field breathes: slow swells travel across the canvas like wind moving through fabric, bunching stripes at the crest and thinning them in the trough. Calm, continuous, never static.

### dune-drift (NEW)

Sand-dune ridges migrate slowly across the field: stripes bunch into dense ridge lines and thin out in the troughs, with the whole pattern drifting and slowly reshaping.

## Stars

All star tiles were "barely visible" — the fix is size, density, and making stars interact with the stripe geometry instead of sitting on top of it.

### constellation-web (FIX)

Bigger, brighter stars that visibly punch through the stripes; constellation lines must cut or displace the stripe geometry so they read as structure, not faint glow.

### meteor-shower (FIX)

Meteors must be far more frequent and much larger, with streaks that carve a visible channel through the stripes rather than glowing over them.

### parallax-depth (FIX)

Much denser starfield with strongly differentiated layers (size and displacement strength per layer, not just brightness), so depth genuinely reads at tile size.

### supernova-pulse (NEW)

Ambient starfield where, every few seconds, one star detonates: a bright core followed by an expanding shock ring that visibly warps the stripe geometry as it passes, fading to a lingering remnant.

### star-warp (NEW)

Hyperspace jump: stars streak radially outward from a vanishing point, stretching into long lines that shear the stripe field, cycling between calm drift and bursts of warp acceleration.

## Rules (unchanged from wave 1)

One agent per experiment. An agent touches ONLY its own `<id>.experiment.ts` + `<id>.*.ts` helpers — never the engine, harness, preset, docs, or another tile. Every tile inherits `EXPERIMENT_BASE_CONFIG` as the first spread in its `setConfig`. Full disposal in `destroy()`. `replay()` is the tile's scripted self-demo.
