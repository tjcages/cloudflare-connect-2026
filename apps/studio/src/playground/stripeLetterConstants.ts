/** Lightweight stripe-letter constants (no Pixi/DOM) safe to import from config and tests. */

export const STRIPE_LETTER_FONT_SIZE_PX = 6;
/** High-res bake; sprites display at logical {@link STRIPE_LETTER_FONT_SIZE_PX} via width/height. */
export const STRIPE_LETTER_RASTER_SCALE = 8;

/** Printable ASCII except space: A–Z, a–z, 0–9, and symbols. */
export const STRIPE_LETTER_CHARSET: readonly string[] = [
  ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  ..."abcdefghijklmnopqrstuvwxyz",
  ..."0123456789",
  ..."!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~",
];
