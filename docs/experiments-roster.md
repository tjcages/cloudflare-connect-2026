# Experiments Lab — Wave 1 Roster

One page, many canvases: every experiment renders the SAME shared texture through its own engine instance so variants compare apples-to-apples. Each experiment is ONE self-contained file in the experiments registry (auto-discovered), labeled on the grid. Experiments draw black/white content INTO the field (field-first, R1–R7); stripes remain the terminal post-process. Never relight stripe output.

Quality bar for every experiment: it must feel like a finished demo, not a tech sketch — deliberate easing (standard ease `cubicBezier(0.6, 0.6, 0, 1)` where discrete, organic noise where continuous), no popping, stable at 60fps for a single visible canvas, and it must read clearly at grid-tile size.

## Cursor trails

### T1 · comet-embers

Cursor head is a luminous comet: velocity-stretched core, and on fast motion it sheds ember sparks that detach, drift with slight gravity + drag, and cool white → gray → black. Slow motion = tight glow, fast flicks = spray. Embers live in a sim (ping-pong), not a fixed-length array look.

### T2 · ripple-wake

The field behaves like still water: a moving cursor sheds a V-shaped wake plus ripple rings that expand, interfere, and damp out. Crossing your own wake produces visible interference. No trail "line" — only the physics of the disturbance.

### T3 · magnetic-grain

The field is fine iron-filing grain; grains within a radius align toward the cursor's recent trajectory (not position — direction matters), then relax back with a slight overshoot. Feels like dragging a magnet under paper.

## Cursor clicks

### C1 · detonation-bloom

The unresolved "natural explosion": click = instant flash core, then an expanding shock ring with real thickness/refraction that displaces the field, plus debris particles that arc outward under gravity + drag and die as cooling embers. One clean event, layered timing (flash 80ms, shock ~600ms, debris ~1.2s). Standalone — do NOT couple it to the trail (that coupling was rejected before).

### C2 · sonar-lens

Click emits 2–3 concentric sonar rings; while a ring sweeps a region it momentarily lifts the field there toward the image (a traveling reveal lens), then the region falls back to noise. Echo rings are weaker each time. Feels like pinging the image out of static.

### C3 · gravity-well

Press-and-hold spins up an attractor: field swirls inward toward the press point (angular drag, tightening spiral). Release: elastic snap-back with a damped ripple. Strength builds with hold duration.

## Reveals

### R1 · burn-away

The noise field burns like paper: an irregular ember front (noise-driven, not a circle) eats across the canvas with a glowing rim and brief sooty residue, leaving the image behind. Direction/seed varies per run.

### R2 · print-head

A scanline printer sweeps top→bottom: a bright head line prints the image row by row; each fresh band lands with slight horizontal jitter and settles. Mono/terminal aesthetic. A finished row never changes again.

### R3 · rain-wash

Rain streaks fall and wash the static off the glass: each streak clears a vertical stripe toward the image with trailing drips; coverage accumulates until fully revealed. Streak spawn density ramps over the reveal.

## Background flames (field ambience)

### F1 · aurora-curtains

Slow aurora: 2–3 layered vertical curtains that undulate at different phases/speeds, brightness rippling along their length. Calm, no fire character. Reads as depth.

### F2 · murmuration

A flock of micro-agents flows across the field in murmuration fashion — cohesion/alignment/separation, splitting and merging, gently avoiding the cursor. Ambient, never chaotic.

NOTE: the snake/vortexBits body tech this originally referenced was reverted in commit be5c943 and no longer exists in the tree (reference read-only via `git show be5c943^:packages/stripes-engine/src/flames/flamesSim.ts`). Build this experiment via `hooks.fieldPass` (own agent sim drawn into the field — guide §5/§8), not by extending the flames registry.

### F3 · lava-blobs

Metaball blobs rise slowly from the bottom, merge, split, and dissolve near the top — lava-lamp physics in field space. Blob edges stay soft; motion is buoyant, not bouncy.

## Stars

### S1 · constellation-web

Stars near the cursor link up with faint lines into transient constellations; lines fade in by proximity and dissolve when the cursor leaves. Occasionally a completed triangle/polygon flashes slightly brighter.

### S2 · meteor-shower

Occasional meteors streak across the starfield with tapering trails; they arrive in loose gusts (clustered timing, not a metronome), varied angle/length/speed within a coherent radiant direction.

### S3 · parallax-depth

Three starfield layers with distinct densities/brightness drift at different rates and shift with cursor parallax; per-star twinkle is desynchronized. The field should read as genuinely deep.

## Assignment & isolation rules

- One agent per category (3 experiments each). An agent touches ONLY its own experiment files plus nothing shared.
- Any shared infrastructure (harness page, engine hook API) is built BEFORE fan-out and is frozen during it.
- Every experiment registers `{ id, title, blurb, category, create(ctx) }` via its own file; the harness auto-discovers, labels the tile, and provides the shared texture + lifecycle (mount when visible, destroy when not — browsers cap live WebGL contexts).
