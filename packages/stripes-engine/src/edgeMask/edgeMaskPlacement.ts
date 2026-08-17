import type { EngineConfig } from "../config/types";

export type EdgeMaskPlacement = "none" | "stripe";

/**
 * One placement for both colour modes.
 *
 * The mask used to branch on `colors.mode`: luminance stepped the field down a
 * chain pass, colours multiplied the composited pixel. Neither was right. The
 * field pass missed every effect registered after it in the chain (cursor trail,
 * comet, meteors), and the output multiply changed no geometry at all — it just
 * washed the artwork toward the background.
 *
 * Both are gone. The ramp now walks the cell down the authored stripe ladder in
 * `stripeCell.glsl`, which sits downstream of the whole field chain: the fade is
 * built out of widths, opacities and colours the config already defines, it is
 * identical in both modes, and it catches every effect without an ordering rule.
 * A brief spell as a continuous width taper in between was rejected — scaling
 * every stripe by the same ramp reads as a uniform thinning of the whole canvas
 * rather than as the artwork dissolving.
 */
export function resolveEdgeMaskPlacement(config: Pick<EngineConfig, "edgeMask">): EdgeMaskPlacement {
  return config.edgeMask.enabled ? "stripe" : "none";
}
