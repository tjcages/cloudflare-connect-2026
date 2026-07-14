import type { EngineConfig } from "@necatikcl/stripes-engine";
import { drawerFolder } from "./drawerFolder";

export function buildLettersFolder(d: EngineConfig) {
  return drawerFolder("Letters", {
    lettersEnabled: { value: d.letters.enabled, label: "Enabled" },
    lettersMode: {
      value: d.letters.mode,
      options: {
        "Random letters": "random",
        Text: "text",
      } as const,
      label: "Mode",
      render: (get) => get("Letters.lettersEnabled") === true,
    },
    lettersFontFamily: {
      value: d.letters.fontFamily,
      options: {
        Monospace: "monospace",
        Sans: "Arial, sans-serif",
        Serif: "Georgia, serif",
        Courier: '"Courier New", monospace',
        "Times New Roman": '"Times New Roman", serif',
        Impact: "Impact, fantasy",
      } as const,
      label: "Font",
      render: (get) => get("Letters.lettersEnabled") === true,
    },
    lettersText: {
      value: d.letters.text,
      label: "Text",
      render: (get) => get("Letters.lettersEnabled") === true && get("Letters.lettersMode") === "text",
    },
    lettersTextCopies: {
      value: d.letters.textCopies,
      min: 1,
      max: 100,
      step: 1,
      label: "Text copies",
      render: (get) => get("Letters.lettersEnabled") === true && get("Letters.lettersMode") === "text",
    },
    coverage: {
      value: d.letters.coverage,
      min: 0,
      max: 1,
      step: 0.01,
      label: "Random density",
      render: (get) => get("Letters.lettersEnabled") === true && get("Letters.lettersMode") === "random",
    },
    lettersPositionX: {
      value: d.letters.positionX,
      min: 0,
      max: 1,
      step: 0.01,
      label: "Position X",
      render: (get) => get("Letters.lettersEnabled") === true && get("Letters.lettersMode") === "random",
    },
    lettersPositionY: {
      value: d.letters.positionY,
      min: 0,
      max: 1,
      step: 0.01,
      label: "Position Y",
      render: (get) => get("Letters.lettersEnabled") === true && get("Letters.lettersMode") === "random",
    },
    lettersAreaWidth: {
      value: d.letters.areaWidth,
      min: 0.01,
      max: 1,
      step: 0.01,
      label: "Random area W",
      render: (get) => get("Letters.lettersEnabled") === true && get("Letters.lettersMode") === "random",
    },
    lettersAreaHeight: {
      value: d.letters.areaHeight,
      min: 0.01,
      max: 1,
      step: 0.01,
      label: "Random area H",
      render: (get) => get("Letters.lettersEnabled") === true && get("Letters.lettersMode") === "random",
    },
    sizeScale: {
      value: d.letters.sizeScale,
      min: 0.1,
      max: 1,
      step: 0.05,
      label: "Font size",
      render: (get) => get("Letters.lettersEnabled") === true,
    },
    shuffleSpeed: {
      value: d.letters.shuffleSpeed,
      min: 0.05,
      max: 3,
      step: 0.05,
      label: "Shuffle speed",
      render: (get) => get("Letters.lettersEnabled") === true,
    },
  });
}
