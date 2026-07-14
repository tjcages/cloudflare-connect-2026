import type { EngineConfig } from "@necatikcl/stripes-engine";
import { intToHex } from "../../lib/color";
import { colorLibraryInputPlugin } from "../colorLibraryInputPlugin";
import { drawerFolder } from "./drawerFolder";

export function buildBackgroundStarsFolder(d: EngineConfig) {
  return drawerFolder("Background Stars", {
    backgroundStarsEnabled: { value: d.background.stars.enabled, label: "Enabled" },
    backgroundStarsDensity: {
      value: d.background.stars.density,
      min: 0,
      max: 100,
      step: 1,
      label: "Sparkle %",
      render: (get) => !!get("Background Stars.backgroundStarsEnabled"),
    },
    backgroundStarsSizePx: {
      value: d.background.stars.sizePx,
      min: 0.25,
      max: 64,
      step: 0.25,
      label: "Star size",
      render: (get) => !!get("Background Stars.backgroundStarsEnabled"),
    },
    backgroundStarsSizeRandomness: {
      value: d.background.stars.sizeRandomness,
      min: 0,
      max: 1,
      step: 0.01,
      label: "Random size",
      render: (get) => !!get("Background Stars.backgroundStarsEnabled"),
    },
    backgroundStarsTiltAngleDeg: {
      value: d.background.stars.tiltAngleDeg,
      min: -89,
      max: 89,
      step: 1,
      label: "Tilt angle",
      render: (get) => !!get("Background Stars.backgroundStarsEnabled"),
    },
    backgroundStarsTwinkleSpeed: {
      value: d.background.stars.twinkleSpeed,
      min: 0,
      max: 10,
      step: 0.05,
      label: "Twinkle speed",
      render: (get) => !!get("Background Stars.backgroundStarsEnabled"),
    },
    backgroundStarsTwinkleAmount: {
      value: d.background.stars.twinkleAmount,
      min: 0,
      max: 1,
      step: 0.01,
      label: "Twinkle amount",
      render: (get) => !!get("Background Stars.backgroundStarsEnabled"),
    },
    backgroundStarsOpacity: {
      value: d.background.stars.opacity,
      min: 0,
      max: 1,
      step: 0.01,
      label: "Star opacity",
      render: (get) => !!get("Background Stars.backgroundStarsEnabled"),
    },
    backgroundStarsColor: {
      ...colorLibraryInputPlugin({ value: intToHex(d.background.stars.color), label: "Star color" }),
      label: "Star color",
      render: (get) => !!get("Background Stars.backgroundStarsEnabled"),
    },
  });
}
