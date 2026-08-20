import { connectHero, REGISTER_URL } from "../data";

/**
 * Promo overlay uses homepage hero type + CTA, with the shorter dash
 * date line so the pane does not wrap the full hero body.
 */
export const LOGIN_OVERLAY_COPY = {
  eyebrow: connectHero.eyebrow,
  titleLines: connectHero.titleLines,
  bodyDate: "October 19–21, 2026",
  bodyVenue: "Moscone West, San Francisco",
  register: connectHero.primaryCta.text,
  registerHref: REGISTER_URL,
  bannerHref: "https://www.cloudflare.com/connect",
} as const;
