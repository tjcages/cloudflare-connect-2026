import type { RenderMode } from "../../config/types";
import { STYLIZE_COMMON } from "./common";
import { ABSTRACT_FRAG } from "./abstract.frag";

export const PASSTHROUGH_FRAG =
  STYLIZE_COMMON +
  `
void main(){ fragColor = vec4(texture(uTex, vUv).rgb, 1.0); }
`;

export const STYLIZE_FRAGS: Partial<Record<RenderMode, string>> = {
  abstract: ABSTRACT_FRAG,
};
