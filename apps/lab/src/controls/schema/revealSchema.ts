import { button } from "leva";
import type { EngineConfig } from "@necatikcl/stripes-engine";
import { drawerFolder } from "./drawerFolder";

export function buildRevealFolder(args: { d: EngineConfig; onReplay: () => void }) {
  const { d, onReplay } = args;
  return drawerFolder("Reveal", {
    revealEnabled: { value: true, label: "Enabled" },
    revealType: {
      value: d.reveal.type,
      options: { Wave: "wave", Assembly: "assembly" } as const,
      label: "Type",
    },
    revealPosition: {
      value: d.reveal.wave.position,
      options: {
        Center: "center",
        "Left Top": "left top",
        "Center Top": "center top",
        "Right Top": "right top",
        "Left Center": "left center",
        "Right Center": "right center",
        "Left Bottom": "left bottom",
        "Center Bottom": "center bottom",
        "Right Bottom": "right bottom",
      } as const,
      label: "Position",
      render: (get) => get("Reveal.revealType") === "wave",
    },
    revealDurationMs: {
      value: d.reveal.wave.durationMs,
      min: 100,
      max: 30000,
      step: 50,
      label: "Duration (ms)",
      render: (get) => get("Reveal.revealType") === "wave",
    },
    revealSoftness: {
      value: d.reveal.wave.softness,
      min: 0,
      max: 1,
      step: 0.01,
      label: "Softness",
      render: (get) => get("Reveal.revealType") === "wave",
    },
    revealWaviness: {
      value: d.reveal.wave.waviness,
      min: 0,
      max: 1,
      step: 0.01,
      label: "Waviness",
      render: (get) => get("Reveal.revealType") === "wave",
    },
    revealSliceSizePx: {
      value: d.reveal.assembly.sliceSizePx,
      min: 8,
      max: 200,
      step: 1,
      label: "Slice size (px)",
      render: (get) => get("Reveal.revealType") === "assembly",
    },
    revealSpeedMinMs: {
      value: d.reveal.assembly.speedMinMs,
      min: 100,
      max: 30000,
      step: 50,
      label: "Speed min (ms)",
      render: (get) => get("Reveal.revealType") === "assembly",
    },
    revealSpeedMaxMs: {
      value: d.reveal.assembly.speedMaxMs,
      min: 100,
      max: 30000,
      step: 50,
      label: "Speed max (ms)",
      render: (get) => get("Reveal.revealType") === "assembly",
    },
    revealStaggerMs: {
      value: d.reveal.assembly.staggerMs,
      min: 0,
      max: 30000,
      step: 50,
      label: "Stagger (ms)",
      render: (get) => get("Reveal.revealType") === "assembly",
    },
    revealScatterPx: {
      value: d.reveal.assembly.scatterPx,
      min: 0,
      max: 300,
      step: 1,
      label: "Scatter (px)",
      render: (get) => get("Reveal.revealType") === "assembly",
    },
    revealAngleJitterDeg: {
      value: d.reveal.assembly.angleJitterDeg,
      min: 0,
      max: 90,
      step: 1,
      label: "Angle jitter (°)",
      render: (get) => get("Reveal.revealType") === "assembly",
    },
    Replay: button(() => onReplay()),
  });
}
