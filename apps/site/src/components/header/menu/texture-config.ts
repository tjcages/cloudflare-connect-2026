import { CTA_TEXTURE_CONFIG } from "@/components/cta/texture-config";
import type { StripesTextureConfig } from "@/components/stripes-texture/config";

export const MENU_BANNER_TEXTURE_CONFIG: StripesTextureConfig = {
  ...CTA_TEXTURE_CONFIG,
  reveal: {
    ...CTA_TEXTURE_CONFIG.reveal,
    wave: { durationMs: 150 },
  },
  adjustments: {
    ...CTA_TEXTURE_CONFIG.adjustments,
    exposure: 0.8,
  },
};
