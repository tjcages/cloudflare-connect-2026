# Pixi rendering notes

> **Partly legacy.** Builder/icon-box examples below describe removed code; the general PixiJS v8 constraints still apply to the playground.

This project uses **PixiJS v8** (`pixi.js`). These notes capture constraints that matter when adding particle-style effects or batch rendering.

## `ParticleContainer` (v8)

- **Highly experimental** upstream; APIs may shift between minors — prefer localized wrappers when touching particles.
- **One texture source per container.** Every `Particle` must share the same base texture as the container’s configured `texture`. If you need different artwork (different shapes or atlases), use **another** `ParticleContainer`.
- **Tinting:** Prefer a **neutral white base texture** (this repo uses `Texture.WHITE` for connector hit sparks) and drive color with **`Particle.tint`** / **`Particle.alpha`** (`alpha` folds into the particle `color` uniform channel).
- **`dynamicProperties`:** Controls what is uploaded every frame (`position`, `color`, `rotation`, `vertex`, `uvs`). More dynamic channels → more GPU work; keep static flags false unless you animate those fields.
- **Bounds:** Particle containers **do not compute bounds** for performance. When you rely on culling or filters that need approximate bounds, set a manual **`boundsArea`** on the container (logical canvas rectangle for editor scenes).

## References

- Connector sparks + shared particle plane: [`src/canvas/components/componentLayer.ts`](../src/canvas/components/componentLayer.ts), [`src/canvas/components/connector-line/connectorHitBurst.ts`](../src/canvas/components/connector-line/connectorHitBurst.ts)
- Icon-box cache/filters (orthogonal topic): [`docs/icon-box-pixi-caching.md`](./icon-box-pixi-caching.md)
