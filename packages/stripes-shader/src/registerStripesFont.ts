import fontUrl from "./assets/BerkeleyMonoTrial-Regular.otf";
import { STRIPE_LETTER_FONT_FAMILY } from "./stripeLetterFont";

let registered = false;

/** Registers the bundled letter font via the FontFace API and resolves once it's loaded.
 *  Idempotent; SSR/no-FontFace safe (no-op). */
export async function registerStripesFont(): Promise<void> {
  if (typeof document === "undefined" || typeof FontFace === "undefined" || !document.fonts) return;
  try {
    if (!registered) {
      const face = new FontFace(STRIPE_LETTER_FONT_FAMILY, `url(${fontUrl})`, { weight: "400", style: "normal" });
      document.fonts.add(await face.load());
      registered = true;
    }
    await document.fonts.load(`400 12px "${STRIPE_LETTER_FONT_FAMILY}"`);
  } catch {
    /* font load blocked/unavailable — letters fall back to a system monospace */
  }
}
