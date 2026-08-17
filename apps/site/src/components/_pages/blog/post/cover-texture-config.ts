import type { StripesTextureConfig } from "@/components/stripes-texture/config";

const COVER_BACKGROUND = 0x002679;

const COVER_STRIPES = [
  { color: 0x002679, startFrom: 0, width: 0.5 },
  { color: 0x002992, startFrom: 0.0889, width: 0.5 },
  { color: 0x003f96, startFrom: 0.1778, width: 1 },
  { color: 0x004ca4, startFrom: 0.2667, width: 1.5 },
  { color: 0x0058b3, startFrom: 0.3556, width: 1.5 },
  { color: 0x0065c1, startFrom: 0.4444, width: 2 },
  { color: 0x0071d0, startFrom: 0.5333, width: 2.5 },
  { color: 0x008aed, startFrom: 0.6222, width: 3 },
  { color: 0x00b1ff, startFrom: 0.7111, width: 3.5 },
  { color: 0x00c3ff, startFrom: 0.8, width: 4 },
].map((stripe) => ({ ...stripe, opacity: 1 }));

export const COVER_TEXTURE_CONFIG: StripesTextureConfig = {
  transform: { fit: "cover" },
  adjustments: { invert: true },
  background: { color: COVER_BACKGROUND, transparent: false },
  colors: { backgroundColor: COVER_BACKGROUND },
  stripes: COVER_STRIPES,
  frames: {
    enabled: true,
    luminanceThreshold: 0.4,
    highlightedStripeCount: 6,
    groupDistanceCells: 3,
    color: 0xff14ef,
    fontSizePx: 8,
    coordinateColor: 0xff14ef,
  },
};
