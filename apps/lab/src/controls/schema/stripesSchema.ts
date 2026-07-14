import type { EngineConfig } from "@necatikcl/stripes-engine";
import { grayLevelFromColor } from "../../lib/color";
import { stripeColorsTablePlugin } from "../stripeColorsTablePlugin";
import { drawerFolder } from "./drawerFolder";
import { RENDER_MODE_COLORS, RENDER_MODE_INTENSITY, RENDER_MODE_PARAMS } from "./renderModes";

export type ImageColorWidthSource = "bright" | "dark";

export function initialImageColorWidthSource(colors: EngineConfig["colors"]): ImageColorWidthSource {
  if (!colors.autoDetectBackground && colors.mode === "colors" && grayLevelFromColor(colors.backgroundColor) > 0.5)
    return "dark";
  return "bright";
}

function initialImageColorLevel(colors: EngineConfig["colors"]): number {
  if (!colors.autoDetectBackground && colors.mode === "colors") return grayLevelFromColor(colors.backgroundColor);
  return initialImageColorWidthSource(colors) === "dark" ? 1 : 0;
}

export function buildStripesFolder(args: { d: EngineConfig; stripeKey: string }) {
  const { d, stripeKey } = args;
  return drawerFolder("Stripes", {
    colorsMode: {
      value: d.colors.mode === "colors" ? "colors" : "luminance",
      options: { Luminance: "luminance", "Image colors": "colors" } as const,
      label: "Color mode",
    },
    stripeBlendMode: {
      value: d.colors.stripeBlendMode,
      options: {
        Normal: "normal",
        Multiply: "multiply",
        Screen: "screen",
        Overlay: "overlay",
        Darken: "darken",
        Lighten: "lighten",
        Difference: "difference",
        Exclusion: "exclusion",
      } as const,
      label: "Blend mode",
    },
    renderMode: {
      value: d.renderMode,
      options: {
        Sharp: "sharp",
        Abstract: "abstract",
        Charcoal: "charcoal",
        Pencil: "pencil",
        Brush: "brush",
        Halftone: "halftone",
        Risograph: "risograph",
        "Stained glass": "stainedGlass",
        "Paper cut-out": "paperCutout",
        CRT: "crt",
        Glitch: "glitch",
        VHS: "vhs",
        Amber: "amber",
        Gummy: "gummy",
      } as const,
      label: "Render mode",
    },
    stripeColorsTable: stripeColorsTablePlugin({
      value: stripeKey,
      render: (get) => RENDER_MODE_COLORS[get("Stripes.renderMode") as string] === undefined,
    }),
    imageColorWidthSource: {
      value: initialImageColorWidthSource(d.colors),
      options: { "Brightest thick": "bright", "Darkest thick": "dark" } as const,
      label: "Width from",
      render: (get) => get("Stripes.colorsMode") === "colors",
    },
    imageColorLevel: {
      value: initialImageColorLevel(d.colors),
      min: 0,
      max: 1,
      step: 0.01,
      label: "Level",
      render: (get) => get("Stripes.colorsMode") === "colors",
    },
    imageColorRemoveThin: {
      value: 0,
      min: 0,
      max: 0.95,
      step: 0.01,
      label: "Remove thin",
      render: (get) => get("Stripes.colorsMode") === "colors",
    },
    imageColorBoostThick: {
      value: 0,
      min: 0,
      max: 2,
      step: 0.01,
      label: "Boost thick",
      render: (get) => get("Stripes.colorsMode") === "colors",
    },
    ...Object.fromEntries(
      Object.entries(RENDER_MODE_INTENSITY).map(([mode, def]) => [
        mode + "Intensity",
        {
          value: def,
          min: 0,
          max: 1,
          step: 0.01,
          label: "Intensity",
          render: (get: (path: string) => unknown) => get("Stripes.renderMode") === mode,
        },
      ]),
    ),
    ...Object.fromEntries(
      Object.entries(RENDER_MODE_PARAMS).flatMap(([mode, params]) =>
        params.map((p) => [
          p.key,
          p.px
            ? {
                value: p.def,
                min: p.px.min,
                max: p.px.max,
                step: p.px.step,
                label: p.label,
                render: (get: (path: string) => unknown) => get("Stripes.renderMode") === mode,
              }
            : {
                value: p.def,
                min: 0,
                max: 1,
                step: 0.01,
                label: p.label,
                render: (get: (path: string) => unknown) => get("Stripes.renderMode") === mode,
              },
        ]),
      ),
    ),
    ...Object.fromEntries(
      Object.entries(RENDER_MODE_COLORS).flatMap(([mode, c]) => [
        [
          mode + "ColorA",
          {
            value: c.a.def,
            label: c.a.label,
            render: (get: (path: string) => unknown) => get("Stripes.renderMode") === mode,
          },
        ],
        [
          mode + "ColorB",
          {
            value: c.b.def,
            label: c.b.label,
            render: (get: (path: string) => unknown) => get("Stripes.renderMode") === mode,
          },
        ],
      ]),
    ),
  });
}
