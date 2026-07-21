# Experiments Lab — Wave 3 Roster

Wave 3 is **variants of the winners**. Three rounds of user verdicts narrowed the field to five surviving tiles; everything else was deleted. Every new tile must be a sibling of something that already won.

## THE TASTE RULES (read before designing anything — these override instinct)

Learned from what the user explicitly rejected:

1. **Effects are LOCAL EVENTS or OBJECTS — never whole-field material.** A ring, a crack, a streak, a particle, a constellation link: yes. Grabbing the entire stripe field and dragging/combing/warping it like cloth: absolutely never. Two tiles that did this (`stripe-drag`, `vortex-comb`) got "i hate this shit dont ever do smt like this".
2. **Keep the disturbance close to the effect.** Even on a liked tile, "too much pushing effect to env" was a complaint. An effect carves and displaces _near itself_, with a tight falloff; the surrounding field stays calm.
3. **Ambient things must be CALM and RELAXING.** `supernova-pulse` and `star-warp` were rejected as "they dont feel relaxing, but exploded". Aggression, blasts and speed belong to click events ONLY. Anything that runs continuously without user input must be slow, gentle and soothing.
4. **Displacement is still how an effect reads** — the palette is orange-on-orange (#F46021 background under an orange→amber stripe ramp) with almost no luminance range, so brightness alone is invisible. But displacement must be **local and bounded**, never global.
5. **At rest, the tile shows the clean preset render.** No idle disturbance of the base image, ever.
6. **No reveals.** The whole reveal category is dead by user decision. Do not build one.
7. **Never dim the base field toward black and then add your effect on top.** This was the mechanical root cause of the "barely visible" tiles: multiplying the incoming field down (e.g. `ghost = field * 0.12`) and drawing additively onto near-black collapses everything into the single darkest band of the orange ramp, so nothing can read. Pass the base field through at full strength and have your effect modulate it.

## The five survivors (do not break these)

- **detonation-bloom** (click) — the user's favourite. Flash core + refracting shock ring + ballistic debris, now with a lingering crater that relaxes over 3.4s.
- **rift-crack** (click) — "i like how its going!" Branching fault lines that genuinely propagate, stripes wrenched perpendicular, seam knitting closed.
- **constellation-web** (stars) — "i like this!" Small pinprick stars, high-contrast links with dark grooves, activated stars grow up to 2.35x.
- **meteor-shower** (stars) — Poisson arrivals, endless and unbatched, gentle environmental push.
- **comet-embers** (trail) — the shed **particles** are specifically loved; the nucleus now has a path-following tapering tail.

## Wave 3 tiles

### Detonation family (siblings of the favourite)

**chain-detonation** — one click fires a primary blast, which triggers 2-3 smaller secondary detonations at short offsets in rapid succession, each a scaled-down flash/ring/debris event. A chain reaction with staggered timing, not one big blast.

**implosion-collapse** — the inverse event: the field rushes _inward_ toward the click point, compressing into a tight knot, holds for a beat, then releases a single modest rebound puff. All local to the point; the collapse is the drama, not the rebound.

**flak-burst** — a click detonates as an airburst: 5-7 small bursts scattered in a loose arc around the click point, each with its own tiny ring and debris spray, staggered over ~400ms so they crackle rather than fire together.

### Rift family

**spider-glass** — a click fractures the field like impacted glass: radial cracks plus concentric ring cracks forming a spiderweb pattern, with the characteristic dense shatter zone at the impact point. The pattern locks in, then slowly knits closed.

**fault-slip** — a click forms a single long fault line across a region, and the field visibly _slips_ along it — one side shears past the other, offsetting the stripes across the seam — then creeps back into alignment.

### Constellation family

**constellation-drift** — the constellation web, but self-forming and cursor-free: links slowly form and dissolve between drifting stars on their own, at a calm and relaxing pace. This is the calm-ambient variant of a winner. Slow, soothing, never busy.

**pulse-net** — the cursor-driven web, but light pulses travel along the links: when a link forms, a bright pulse runs its length, and hub stars flare briefly as pulses arrive. Data flowing through a network.

### Meteor family

**meteor-depth** — the Poisson meteor stream at three depth layers: distant meteors small, slow, faint and barely disturbing the field; near ones large, fast, with real carving. Depth reads through size, speed and displacement strength together.

**comet-passage** — rare and slow: every 8-15 seconds a single large comet crosses the tile with a long tapering path-following tail (the tech from comet-embers), moving with weight and majesty. Calm and spectacular, not frantic.

### Particle family (the loved embers)

**ember-drift** — an ambient field of the loved ember particles with no cursor at all: embers rise slowly, drift, cool and fade, continuously replenished. Calm and relaxing — this is the ambient variant of the one thing the user singled out as loved. Slow rise, gentle sway, soft cooling. Never busy, never explosive.

## Rules

One agent per tile. An agent touches ONLY its own `<id>.experiment.ts` + `<id>.*.ts` helpers — never the engine, harness, preset, docs, or another tile. `...EXPERIMENT_BASE_CONFIG` (from `./preset`) is always the first spread in `setConfig`. Full disposal in `destroy()`. `replay()` is the tile's scripted self-demo.
