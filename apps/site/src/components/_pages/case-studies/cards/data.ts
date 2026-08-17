import type { StripeColors } from "./texture-config";

export const MONO_STRIPE_COLORS: StripeColors = [
  0x161616, 0x1b1b1b, 0x222222, 0x292929, 0x313131, 0x373737, 0x3b3b3b,
  0x3e3e3e,
];
export const MONO_WHITE_POINT = 0.839;

export interface CaseCardData {
  company: string;
  description: string;
  stripeColors: StripeColors;
  whitePoint: number;
  sparkleStripe?: {
    hueDriftDeg?: number;
    saturationBoost?: number;
    maxBrightness?: number;
  };
  stripeGradient?: readonly number[];
}

/*
 * Figma texture exports — Case Studies page
 * (file pJQJyEIoY0QGdCdy9WEqc7, page "Case Studies" 3890:20590)
 *
 * Left of the page design sits a texture sheet: 13 fresh lab renders
 * ("stripes - <timestamp>" frames, 800x320, dated 2026-07-18) in a column at
 * canvas x=8671, one per card, row-paired by y with the white source frames
 * at x=9571 (src ids below). Rendered stacks read bottom→top, all layers
 * opacity 1: first hex = full-bleed background, then 8 stripes. Exactly two
 * renders are black/white (VSCO, Liveblocks) — identical neutral ramp,
 * different source geometry.
 *
 * Lab configs are posted as Figma comments ("stripes-engine-lab-settings"
 * v2 JSON), pinned just below-right of each texture at canvas x≈9490 —
 * re-fetchable by cfg id via GET /v1/files/pJQJyEIoY0QGdCdy9WEqc7/comments.
 * 7 exist; none yet for Shopify, Uniswap, Discord, Anadolu Efes, Delivery
 * Hero, VSCO (VSCO's ramp is covered anyway — identical to Liveblocks',
 * only the source image differs). The oldest pin holds Skyscanner's config
 * (content-verified by its color stack) but sits beside the Delivery Hero
 * row — the frames were evidently reshuffled after it was pinned.
 *
 * Shared across all 7 configs (only colors, whitePoint, ramp tweaks and
 * source upload differ): lab canvas 800x400, transform fit:width; grid 7x7
 * vertical, overlap 1.2; 8 stripes from palette "Background Ramp" at
 * startFrom 0/.05/.1/.2/.3/.4/.5/.6, widths .5/1/1.5/2/2.5/3/3.5/4; colors
 * mode luminance, blend normal; rampEase custom:0.42,0.258,0.602,0.918;
 * threshold-distribution ease custom:0.487,0.064,0.577,0.864;
 * autoStripeWidths off; reveal wave center 500ms softness .68;
 * sparkle.stripe {coverage .3, maxBrightness .15 (.16 on Skyscanner), speed
 * .4, thickestCount 4, hueDrift/satBoost tracking the ramp settings};
 * sparkle.width {coverage .5, swingPx 2, period .5–1}; sparkle.motion
 * {amplitude 6, stagger 35, maxOffset 128, speed .55, rightToLeft};
 * edgeMask 0→.1 power .6; bg stars on (density 2, 12px, tilt -15°); flames
 * on; renderMode sharp.
 *
 * HighlightGrid (design "Highlight Grid" section 3949:50028, page y=640):
 * - Skyscanner    r1c1 640px — 4226:21013 (y=-4972, src 4181:25681)
 *   #0770e3 | #1275e8 #007bf7 #0083ff #008dff #0097ff #00a0ff #00a7ff #00abff
 *   cfg 1848645452 (misplaced pin): whitePoint .804, ramp {brightness +16,
 *   hue -10°, sat +20}, src upload-e9c28e8b
 * - Shopify       r1c2 440px — 4226:21030 (y=-4552, src 4181:25717) — no cfg
 *   #95bf47 | #9ac44c #a1cb44 #abd33f #b6dc3d #c1e43f #cbeb47 #d3ee51 #d9ef5b
 * - Uniswap       r2c1 440px — 4227:4666 (y=-4132, src 4181:25726) — no cfg
 *   #ff37c7 | #ff3ecc #ff36da #ff38e9 #ff48f7 #ff55ff #ff60ff #ff67ff #ff70ff
 * - Discord       r2c2 640px — 4226:21062 (y=-3712, src 4181:25759) — no cfg
 *   #5865f2 | #5c6af7 #5c6eff #5d75ff #5e7eff #6188ff #6391ff #6599ff #679fff
 * - Anadolu Efes  r3c1 320px — 4227:4698 (y=-3292, src 4181:25771) — no cfg
 *   #004a8c | #074e91 #00549b #005ca7 #0065b2 #006ebb #0076c1 #097bc2 #197ec0
 * - Delivery Hero r3c2 320px — 4227:4719 (y=-2872, src 4181:25786) — no cfg
 *   #d62026 | #db282b #e91e2f #f71736 #ff1a41 #ff274e #ff365b #ff4567 #ff5272
 * - Envato        r3c3 320px — 4227:4740 (y=-2452, src 4181:25800)
 *   #87e64b | #8bea4f #8ff03f #96f72b #9ffe14 #aaff00 #b6ff22 #c6ff59 #d0ff75
 *   cfg 1848648196: whitePoint .816, ramp {brightness +12, hue -10°, sat
 *   +20}, src upload-33bb87fc
 *
 * CardsGrid (design "Grid" section 4003:41801, page y=2560, all 320px):
 * - Canva         r1c1 — 4229:15345 (y=-2032, src 4226:20940)
 *   Gradient render (5291 vectors), light stripes over the gradient —
 *   inverted polarity vs the rest.
 *   cfg 1848662824: bg #712ee3 with background gradient AND stripe-color
 *   gradient enabled, both topToBottom stops #992bff #5a32fa #13a3b5
 *   #93e8f6 (stripe gradient with hue +9°, sat +.2); whitePoint .769, ramp
 *   {brightness +12, hue +9°, sat +20}, src upload-9fb44299
 * - TeamViewer    r1c2 — 4229:25940 (y=-1612, src 4226:20951)
 *   #3056ef | #355cf5 #2a61ff #1969ff #0074ff #0081ff #008dff #0098ff #009fff
 *   cfg 1848663382: whitePoint .769, ramp {brightness +18, hue -16°, sat
 *   +25}, src upload-74ccee66
 * - VSCO [B/W]    r1c3 — 4229:25961 (y=-1192, src 4226:20965) — no cfg
 *   #121212 | #161616 #1b1b1b #222222 #292929 #313131 #373737 #3b3b3b #3e3e3e
 *   (vertical-line halftone of the VSCO chevron mark)
 * - Liveblocks [B/W] r2c1 — 4229:25982 (y=-772, src 4226:20976)
 *   identical stack to VSCO, over the diagonal Liveblocks logo geometry
 *   cfg 1848663867: bg #121212, whitePoint .839, ramp {brightness +18, hue
 *   -16°, sat +25}, src upload-0897d621
 * - Elementor     r2c2 — 4229:26024 (y=-352, src 4226:20990)
 *   #ed01ee | #f218f3 #f52bff #f93cff #ff4bff #ff58ff #ff62ff #ff6aff #ff6fff
 *   cfg 1848664338: whitePoint .765, ramp {brightness +15, hue -16°, sat
 *   +25}, src upload-79e49438
 * - Docker        r2c3 — 4229:26045 (y=68, src 4226:21001)
 *   #2560ff | #2a65ff #0f69ff #0070ff #0079ff #0084ff #0090ff #0099ff #00a1ff
 *   cfg 1848664438: whitePoint .839, ramp {brightness +15, hue -16°, sat
 *   +25}, src upload-c30d4353
 *
 * All renders use the 8-stripe lab ladder above, not the current 7-step
 * LADDER. Most backgrounds match the current baseColor below; Shopify
 * (#95bf47 vs 0x629b3c), VSCO (#121212 vs 0x040404), and Canva (gradient)
 * diverge.
 */
export const CASE_CARDS = {
  skyscanner: {
    company: "Skyscanner",
    description:
      "Skyscanner modernizes its internal access infrastructure with Cloudflare, boosting speed, security, and enhancing developer focus.",
    stripeColors: [
      0x1275e8, 0x007bf7, 0x0083ff, 0x008dff, 0x0097ff, 0x00a0ff, 0x00a7ff,
      0x00abff,
    ],
    whitePoint: 0.804,
    sparkleStripe: {
      hueDriftDeg: -10,
      saturationBoost: 0.2,
      maxBrightness: 0.16,
    },
  },
  shopify: {
    company: "Shopify",
    description:
      "Shopify + Cloudflare: Powering 1,000,000 storefronts on the biggest shopping weekend of the year",
    stripeColors: [
      0x9ac44c, 0xa1cb44, 0xabd33f, 0xb6dc3d, 0xc1e43f, 0xcbeb47, 0xd3ee51,
      0xd9ef5b,
    ],
    whitePoint: 0.8,
  },
  uniswap: {
    company: "Uniswap",
    description:
      "Uniswap Lab uses Cloudflare IPFS Gateway to securely serve their users",
    stripeColors: [
      0xff3ecc, 0xff36da, 0xff38e9, 0xff48f7, 0xff55ff, 0xff60ff, 0xff67ff,
      0xff70ff,
    ],
    whitePoint: 0.8,
  },
  discord: {
    company: "Discord",
    description:
      "As Discord experiences explosive growth, they're thankful Cloudflare helps keep bandwidth & hardware costs down and web performance high.",
    stripeColors: [
      0x5c6af7, 0x5c6eff, 0x5d75ff, 0x5e7eff, 0x6188ff, 0x6391ff, 0x6599ff,
      0x679fff,
    ],
    whitePoint: 0.8,
  },
  "anadolu-efes": {
    company: "Anadolu Efes",
    description:
      "Anadolu Efes centralises security and networking on Cloudflare to improve speed, resilience, and control.",
    stripeColors: [
      0x074e91, 0x00549b, 0x005ca7, 0x0065b2, 0x006ebb, 0x0076c1, 0x097bc2,
      0x197ec0,
    ],
    whitePoint: 0.8,
  },
  "delivery-hero": {
    company: "Delivery Hero",
    description:
      "Using Cloudflare as a single network entry point for its global operations, Delivery Hero reduced complexity, enhanced global network performance, and secured its international workforce and websites",
    stripeColors: [
      0xdb282b, 0xe91e2f, 0xf71736, 0xff1a41, 0xff274e, 0xff365b, 0xff4567,
      0xff5272,
    ],
    whitePoint: 0.8,
  },
  envato: {
    company: "Envato",
    description:
      "Cloudflare Zero Trust and Application Security help Envato eliminate downtime and secure employee access to company tools",
    stripeColors: [
      0x8bea4f, 0x8ff03f, 0x96f72b, 0x9ffe14, 0xaaff00, 0xb6ff22, 0xc6ff59,
      0xd0ff75,
    ],
    whitePoint: 0.816,
    sparkleStripe: { hueDriftDeg: -10, saturationBoost: 0.2 },
  },
  canva: {
    company: "Canva",
    description:
      "Canva connects employees, protects user assets, and builds industry-leading visual communication and content creation in Cloudflare’s connectivity cloud.",
    stripeColors: [
      0x697eed, 0x6e80f9, 0x7483ff, 0x7b87ff, 0x848dff, 0x8b91ff, 0x9295ff,
      0x9798ff,
    ],
    whitePoint: 0.769,
    sparkleStripe: { hueDriftDeg: 9, saturationBoost: 0.2 },
    stripeGradient: [0x992bff, 0x5a32fa, 0x13a3b5, 0x93e8f6],
  },
  teamviewer: {
    company: "TeamViewer",
    description:
      "TeamViewer deploys Cloudflare WAF, Workers, and CDN to decrease latency for its website and downloads and protect against DDoS attacks",
    stripeColors: [
      0x355cf5, 0x2a61ff, 0x1969ff, 0x0074ff, 0x0081ff, 0x008dff, 0x0098ff,
      0x009fff,
    ],
    whitePoint: 0.769,
  },
  vsco: {
    company: "VSCO",
    description:
      "VSCO delivered more responsive user experiences, consolidated app security, and deployed innovative, real‑time AI image generation workflows with Cloudflare.",
    stripeColors: MONO_STRIPE_COLORS,
    whitePoint: MONO_WHITE_POINT,
  },
  liveblocks: {
    company: "Liveblocks",
    description:
      "Liveblocks capitalizes on the Cloudflare Developer Platform to provide developers with pre-built, real-time collaboration features",
    stripeColors: MONO_STRIPE_COLORS,
    whitePoint: MONO_WHITE_POINT,
  },
  elementor: {
    company: "Elementor",
    description:
      "Cloudflare’s connectivity cloud protects hosted sites against cyberattacks, enhances page speed and availability, and reduces manual DevOps management.",
    stripeColors: [
      0xf218f3, 0xf52bff, 0xf93cff, 0xff4bff, 0xff58ff, 0xff62ff, 0xff6aff,
      0xff6fff,
    ],
    whitePoint: 0.765,
  },
  docker: {
    company: "Docker",
    description:
      "With Cloudflare Cache Reserve, Docker ensures swift, reliable, and secure delivery of 500+ million downloads daily",
    stripeColors: [
      0x2a65ff, 0x0f69ff, 0x0070ff, 0x0079ff, 0x0084ff, 0x0090ff, 0x0099ff,
      0x00a1ff,
    ],
    whitePoint: 0.839,
  },
} satisfies Record<string, CaseCardData>;

export type CaseCardName = keyof typeof CASE_CARDS;
