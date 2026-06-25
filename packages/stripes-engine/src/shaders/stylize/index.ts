import type { RenderMode } from "../../config/types";
import { STYLIZE_COMMON } from "./common";
import { ABSTRACT_FRAG } from "./abstract.frag";
import { CHARCOAL_FRAG } from "./charcoal.frag";
import { PENCIL_FRAG } from "./pencil.frag";
import { BRUSH_FRAG } from "./brush.frag";
import { HALFTONE_FRAG } from "./halftone.frag";
import { RISOGRAPH_FRAG } from "./risograph.frag";
import { STAINED_GLASS_FRAG } from "./stainedGlass.frag";
import { PAPER_CUTOUT_FRAG } from "./paperCutout.frag";
import { CRT_FRAG } from "./crt.frag";
import { GLITCH_FRAG } from "./glitch.frag";
import { VHS_FRAG } from "./vhs.frag";
import { AMBER_FRAG } from "./amber.frag";
import { GUMMY_FRAG } from "./gummy.frag";

export const PASSTHROUGH_FRAG =
  STYLIZE_COMMON +
  `
void main(){ fragColor = vec4(texture(uTex, vUv).rgb, 1.0); }
`;

export const STYLIZE_FRAGS: Partial<Record<RenderMode, string>> = {
  abstract: ABSTRACT_FRAG,
  charcoal: CHARCOAL_FRAG,
  pencil: PENCIL_FRAG,
  brush: BRUSH_FRAG,
  halftone: HALFTONE_FRAG,
  risograph: RISOGRAPH_FRAG,
  stainedGlass: STAINED_GLASS_FRAG,
  paperCutout: PAPER_CUTOUT_FRAG,
  crt: CRT_FRAG,
  glitch: GLITCH_FRAG,
  vhs: VHS_FRAG,
  amber: AMBER_FRAG,
  gummy: GUMMY_FRAG,
};
