import type { EngineConfig } from "@necatikcl/stripes-engine";
import type { LabSettings } from "../../persistence";
import { buildBackgroundFolder } from "./backgroundSchema";
import { buildGridFolder } from "./gridSchema";
import { buildRevealFolder } from "./revealSchema";
import { buildStripesFolder } from "./stripesSchema";
import { buildBackgroundStarsFolder } from "./starsSchema";
import { buildSparkleFolder } from "./sparkleSchema";
import { buildLettersFolder } from "./lettersSchema";
import { buildClickWaveFolder, buildCursorTrailFolder, buildEdgeMaskFolder, buildFlamesFolder } from "./effectsSchema";

export interface ShaderSchemaArgs {
  d: EngineConfig;
  initialLabSettings: LabSettings;
  backgroundHex: string | null;
  handleBackgroundColorLiveChange: (hex: string | null) => void;
  stripeKey: string;
  shaderControlSetterRef: { current: ((values: Record<string, unknown>) => void) | null };
  onReplay: () => void;
}

export function buildShaderSchema(args: ShaderSchemaArgs) {
  const {
    d,
    initialLabSettings,
    backgroundHex,
    handleBackgroundColorLiveChange,
    stripeKey,
    shaderControlSetterRef,
    onReplay,
  } = args;
  return {
    Background: buildBackgroundFolder({ d, initialLabSettings, backgroundHex, handleBackgroundColorLiveChange }),
    Grid: buildGridFolder({ d, shaderControlSetterRef }),
    Reveal: buildRevealFolder({ d, onReplay }),
    Stripes: buildStripesFolder({ d, stripeKey }),
    "Background Stars": buildBackgroundStarsFolder(d),
    Sparkle: buildSparkleFolder(d),
    Letters: buildLettersFolder(d),
    "Edge Mask": buildEdgeMaskFolder(d),
    "Cursor Trail": buildCursorTrailFolder(d),
    "Click Wave": buildClickWaveFolder(d),
    "Background Flames": buildFlamesFolder(d),
  };
}
