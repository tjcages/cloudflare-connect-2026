import type { Application } from "pixi.js";
import { Particle, Texture, type ParticleContainer } from "pixi.js";

/** Spark count per connector hit on an icon-box shadow card (~half prior density). */
export const CONNECTOR_HIT_PARTICLE_COUNT = 12;

/** Nominal drift + fade duration per spark after spawn (ms). Burst compresses wall-clock timing (~56% of this vs exports). */
export const CONNECTOR_HIT_PARTICLE_DURATION_MS = 840;

/**
 * Nominal spawn stagger window (ms). Burst compresses wall-clock timing (~56% of this vs exports).
 */
export const CONNECTOR_HIT_PARTICLE_SPAWN_SPREAD_MS = 200;

/** Raster square side length for one particle circle (anti-alias padding inside edges). */
export const CONNECTOR_HIT_PARTICLE_TEX_SIZE_PX = 16;

/** Rendered diameter on canvas (logical px). */
export const CONNECTOR_HIT_PARTICLE_DIAMETER_PX = 1;

/** Scale sprite so circle diameter matches {@link CONNECTOR_HIT_PARTICLE_DIAMETER_PX}. */
export const CONNECTOR_HIT_PARTICLE_SCALE = CONNECTOR_HIT_PARTICLE_DIAMETER_PX / CONNECTOR_HIT_PARTICLE_TEX_SIZE_PX;

/**
 * Soft white circle on transparent-ish raster — tint with {@link Particle.tint}. Falls back to `Texture.WHITE`
 * when no Canvas 2D (non-browser tests).
 */
export function createConnectorHitParticleCircleTexture(): Texture {
  const size = CONNECTOR_HIT_PARTICLE_TEX_SIZE_PX;
  if (typeof document === "undefined") {
    return Texture.WHITE;
  }
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return Texture.WHITE;
  }
  ctx.beginPath();
  ctx.arc(size * 0.5, size * 0.5, size * 0.5 - 0.25, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  return Texture.from(canvas);
}

/** Travel back along the conductor (logical px); higher floor → farther minimum run toward the wire. */
const CONNECTOR_HIT_BURST_ALONG_MIN_PX = 22;
const CONNECTOR_HIT_BURST_ALONG_SPAN_PX = 12;

/** Random ± offset on each axis (logical px). */
const CONNECTOR_HIT_BURST_SPREAD_HALF_PX = 12;

/** Horizontal drift scales by this (screen-space Δx only). */
const CONNECTOR_HIT_BURST_HORIZONTAL_SCALE = 0.75;

/** `(1−t)^exp` fade vs normalized motion age `t`; exp > 1 fades quicker than linear (~125% feel at 1.25). */
const CONNECTOR_HIT_PARTICLE_FADE_CURVE_EXPONENT = 1.25;

/** Compress drift + fade + spawn stagger vs exported ms constants (~56% of nominal → ~44% shorter wall-clock vs exports). */
const CONNECTOR_HIT_BURST_TIME_SCALE = 0.5625;

/** u∈[0,1) from `crypto` (matches connector animation jitter policy). */
const randomUnitInterval = (): number => {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0]! / 2 ** 32;
};

/** Ease-out for outward travel (spark pop). */
const burstEase = (u: number): number => {
  const t = Math.min(1, Math.max(0, u));
  return t * (2 - t);
};

/**
 * From the live inner-inset hit (`getParticleOrigin`), sparks return toward the wire (−`push`) with spread.
 * Origin is sampled every frame so bursts stay aligned if the icon box moves during the effect.
 * Spawn stagger + drift + fade share the same wall-clock compression (~56% of nominal exported ms).
 */
export const spawnConnectorHitBurst = (
  app: Application,
  particleContainer: ParticleContainer,
  dotTexture: Texture,
  getParticleOrigin: () => { x: number; y: number },
  tint: number,
  /** Unit: pulse **into** shadow at contact; sparks fly **−push** toward the external line. */
  pushIntoBoxX: number,
  pushIntoBoxY: number,
): void => {
  let backX = -pushIntoBoxX;
  let backY = -pushIntoBoxY;
  const backLen = Math.hypot(backX, backY);
  if (backLen < 1e-9) {
    backX = 1;
    backY = 0;
  } else {
    backX /= backLen;
    backY /= backLen;
  }

  const n = CONNECTOR_HIT_PARTICLE_COUNT;

  const spawnSpreadMs = CONNECTOR_HIT_PARTICLE_SPAWN_SPREAD_MS * CONNECTOR_HIT_BURST_TIME_SCALE;

  for (let i = 0; i < n; i += 1) {
    const staggerMs = n <= 1 ? 0 : (i / (n - 1)) * spawnSpreadMs;

    const along = CONNECTOR_HIT_BURST_ALONG_MIN_PX + randomUnitInterval() * CONNECTOR_HIT_BURST_ALONG_SPAN_PX;
    const jx = CONNECTOR_HIT_BURST_SPREAD_HALF_PX * (randomUnitInterval() * 2 - 1);
    const jy = CONNECTOR_HIT_BURST_SPREAD_HALF_PX * (randomUnitInterval() * 2 - 1);
    const dx = (backX * along + jx) * CONNECTOR_HIT_BURST_HORIZONTAL_SCALE;
    const dy = backY * along + jy;

    const o0 = getParticleOrigin();
    const p = new Particle({
      texture: dotTexture,
      x: o0.x,
      y: o0.y,
      anchorX: 0.5,
      anchorY: 0.5,
      scaleX: CONNECTOR_HIT_PARTICLE_SCALE,
      scaleY: CONNECTOR_HIT_PARTICLE_SCALE,
      tint,
      alpha: 0,
    });

    particleContainer.addParticle(p);

    const started = performance.now();

    const tick = () => {
      const elapsed = performance.now() - started;
      const origin = getParticleOrigin();
      if (elapsed < staggerMs) {
        p.x = origin.x;
        p.y = origin.y;
        return;
      }

      const age = elapsed - staggerMs;
      const motionMs = CONNECTOR_HIT_PARTICLE_DURATION_MS * CONNECTOR_HIT_BURST_TIME_SCALE;

      if (age >= motionMs) {
        p.alpha = 0;
        particleContainer.removeParticle(p);
        app.ticker.remove(tick);
        return;
      }

      const tLife = Math.min(1, age / motionMs);
      const eased = burstEase(tLife);
      p.x = origin.x + dx * eased;
      p.y = origin.y + dy * eased;

      p.alpha = Math.pow(Math.max(0, 1 - tLife), CONNECTOR_HIT_PARTICLE_FADE_CURVE_EXPONENT);
    };

    app.ticker.add(tick);
  }
};
