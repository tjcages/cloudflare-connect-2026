import { FloatingPanel, PanelHeaderSelect } from "@tjcages/panels/dev";
import { useCallback, useState, type ReactNode } from "react";
import {
  CTA_SHADER_PANEL_ID,
  loadCtaShaderSettings,
  publishCtaShaderSettings,
} from "@/components/cta/cta-shader-controls";
import {
  FOOTER_SHADER_PANEL_ID,
  loadFooterShaderSettings,
  publishFooterShaderSettings,
} from "@/components/footer/footer-shader-controls";
import {
  AGENDA_RAIN_PANEL_ID,
  loadAgendaRainSettings,
  publishAgendaRainSettings,
} from "../agenda/agenda-rain-controls";
import {
  agendaRainFromPanelValues,
  buildAgendaRainSections,
  seedAgendaRainPanelValues,
} from "../panel/agendaRainFields";
import { buildCtaShaderSections, ctaShaderFromPanelValues, seedCtaShaderPanelValues } from "../panel/ctaShaderFields";
import {
  buildFooterShaderSections,
  footerShaderFromPanelValues,
  seedFooterShaderPanelValues,
} from "../panel/footerShaderFields";
import { PanelSections, type PanelValues } from "../panel/panelSections";
import { buildRainSections, rainFromPanelValues, seedRainPanelValues } from "../panel/rainFields";
import {
  buildSpeakerFramesSections,
  seedSpeakerFramesPanelValues,
  speakerFramesFromPanelValues,
} from "../panel/speakerFramesFields";
import {
  buildTwizzlerSections,
  seedTwizzlerPanelValues,
  twizzlerSettingsFromPanelValues,
} from "../panel/twizzlerFields";
import {
  loadSpeakerFrameSettings,
  publishSpeakerFrameSettings,
  SPEAKER_FRAME_PANEL_ID,
} from "../speakers/speaker-frame-controls";
import {
  applyRainAppearance,
  loadRainControlSettings,
  RAIN_PANEL_ID,
  resolveConnectHeroRain,
  type ConnectHeroRain,
} from "./rain-control-settings";
import type { ShaderTarget } from "./shader-targets";
import {
  applyTwizzlerAppearance,
  CONNECT_TWIZZLER_CONTROL_DEFAULTS,
  CONNECT_TWIZZLER_PANEL_ID,
  loadConnectTwizzlerControlSettings,
  resolveConnectTwizzlerSettings,
  type ConnectTwizzlerSettings,
} from "./twizzler-control-settings";

export type { ShaderTarget };

const SHADER_TARGET_OPTIONS: {
  value: ShaderTarget;
  label: string;
}[] = [
  { value: "twizzler", label: "Connect Twizzler" },
  { value: "rain", label: "Hero Rain" },
  { value: "frames", label: "Speaker Frames" },
  { value: "agenda-rain", label: "Agenda Rain" },
  { value: "cta", label: "CTA Shader" },
  { value: "footer", label: "Footer Shader" },
];

const TARGET_STORAGE_KEY = "connect:shader-controls-target";
const FLOAT_STORAGE_KEY = "connect-shader-controls";
const DEFAULT_TARGETS: readonly ShaderTarget[] = SHADER_TARGET_OPTIONS.map((option) => option.value);

const isShaderTarget = (value: string): value is ShaderTarget =>
  SHADER_TARGET_OPTIONS.some((option) => option.value === value);

const readStoredTarget = (): ShaderTarget => {
  const stored = localStorage.getItem(TARGET_STORAGE_KEY);
  if (stored && isShaderTarget(stored)) return stored;
  // The retired per-day agenda Twizzler targets collapse into the shared rain.
  if (stored?.startsWith("agenda-")) return "agenda-rain";
  return "twizzler";
};

const resolveTarget = (stored: ShaderTarget, allowed: readonly ShaderTarget[]): ShaderTarget =>
  allowed.includes(stored) ? stored : (allowed[0] ?? "twizzler");

const scrollToTarget = (next: ShaderTarget) => {
  const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ? ("auto" as const)
    : ("smooth" as const);
  switch (next) {
    case "twizzler":
    case "rain":
      window.scrollTo({ top: 0, behavior });
      return;
    case "frames":
      document.querySelector("#speakers")?.scrollIntoView({ behavior, block: "start" });
      return;
    case "agenda-rain":
      document.querySelector("#agenda")?.scrollIntoView({ behavior, block: "start" });
      return;
    case "cta":
      document.querySelector("#register")?.scrollIntoView({ behavior, block: "start" });
      return;
    case "footer":
      document.querySelector("#site-footer")?.scrollIntoView({ behavior, block: "start" });
      return;
    default: {
      const _exhaustive: never = next;
      void _exhaustive;
    }
  }
};

interface Props {
  onClose: () => void;
  onSettingsChange: (settings: ConnectTwizzlerSettings) => void;
  onRainChange: (rain: ConnectHeroRain) => void;
  /** Homepage exposes every shader; login only tunes the hero stack. */
  targets?: readonly ShaderTarget[];
  /** Page-specific tools rendered inside the scrolling panel flow. */
  toolsSlot?: ReactNode;
}

const persist = (id: string, values: unknown) => {
  try {
    localStorage.setItem(`panels:${id}`, JSON.stringify(values));
  } catch {
    // Private-mode / quota failures must not break the panel.
  }
};

const loadHeroControlSettings = () => loadConnectTwizzlerControlSettings() ?? CONNECT_TWIZZLER_CONTROL_DEFAULTS;

export default function ConnectTwizzlerControls({
  onClose,
  onSettingsChange,
  onRainChange,
  targets = DEFAULT_TARGETS,
  toolsSlot,
}: Props) {
  const allowed = targets.length > 0 ? targets : DEFAULT_TARGETS;
  const [target, setTarget] = useState<ShaderTarget>(() => resolveTarget(readStoredTarget(), allowed));

  // One live value record per target, seeded from the persisted blobs. Every
  // edit persists in the target's own JSON shape and publishes to its shader,
  // so switching targets never resets the others.
  const [heroValues, setHeroValues] = useState<PanelValues>(() => seedTwizzlerPanelValues(loadHeroControlSettings()));
  const [heroRainValues, setHeroRainValues] = useState<PanelValues>(() =>
    seedRainPanelValues(loadRainControlSettings()),
  );
  const [frameValues, setFrameValues] = useState<PanelValues>(() =>
    seedSpeakerFramesPanelValues(loadSpeakerFrameSettings()),
  );
  const [rainValues, setRainValues] = useState<PanelValues>(() => seedAgendaRainPanelValues(loadAgendaRainSettings()));
  const [ctaValues, setCtaValues] = useState<PanelValues>(() => seedCtaShaderPanelValues(loadCtaShaderSettings()));
  const [footerValues, setFooterValues] = useState<PanelValues>(() =>
    seedFooterShaderPanelValues(loadFooterShaderSettings()),
  );

  const handleHeroChange = useCallback(
    (next: PanelValues) => {
      const appearanceChanged = next.appearance !== heroValues.appearance;
      const themed = appearanceChanged
        ? applyTwizzlerAppearance(twizzlerSettingsFromPanelValues(next), next.appearance === "dark" ? "dark" : "light")
        : twizzlerSettingsFromPanelValues(next);
      const panelValues = seedTwizzlerPanelValues(themed);
      setHeroValues(panelValues);
      const settings = twizzlerSettingsFromPanelValues(panelValues);
      persist(CONNECT_TWIZZLER_PANEL_ID, settings);
      onSettingsChange(resolveConnectTwizzlerSettings(settings));
    },
    [heroValues.appearance, onSettingsChange],
  );

  const handleHeroRainChange = useCallback(
    (next: PanelValues) => {
      const appearanceChanged = next.appearance !== heroRainValues.appearance;
      const settings = appearanceChanged
        ? applyRainAppearance(rainFromPanelValues(next), next.appearance === "dark" ? "dark" : "light")
        : rainFromPanelValues(next);
      setHeroRainValues(seedRainPanelValues(settings));
      persist(RAIN_PANEL_ID, settings);
      onRainChange(resolveConnectHeroRain(settings));
    },
    [heroRainValues.appearance, onRainChange],
  );

  const handleFramesChange = useCallback((next: PanelValues) => {
    setFrameValues(next);
    const settings = speakerFramesFromPanelValues(next);
    persist(SPEAKER_FRAME_PANEL_ID, settings);
    publishSpeakerFrameSettings(settings);
  }, []);

  const handleRainChange = useCallback((next: PanelValues) => {
    setRainValues(next);
    const settings = agendaRainFromPanelValues(next);
    persist(AGENDA_RAIN_PANEL_ID, settings);
    publishAgendaRainSettings(settings);
  }, []);

  const handleCtaChange = useCallback((next: PanelValues) => {
    setCtaValues(next);
    const settings = ctaShaderFromPanelValues(next);
    persist(CTA_SHADER_PANEL_ID, settings);
    publishCtaShaderSettings(settings);
  }, []);

  const handleFooterChange = useCallback((next: PanelValues) => {
    setFooterValues(next);
    const settings = footerShaderFromPanelValues(next);
    persist(FOOTER_SHADER_PANEL_ID, settings);
    publishFooterShaderSettings(settings);
  }, []);

  const active = (() => {
    switch (target) {
      case "agenda-rain":
        return {
          sections: buildAgendaRainSections(),
          values: rainValues,
          onChange: handleRainChange,
        };
      case "rain":
        return {
          sections: buildRainSections(),
          values: heroRainValues,
          onChange: handleHeroRainChange,
        };
      case "frames":
        return {
          sections: buildSpeakerFramesSections(),
          values: frameValues,
          onChange: handleFramesChange,
        };
      case "cta":
        return {
          sections: buildCtaShaderSections(),
          values: ctaValues,
          onChange: handleCtaChange,
        };
      case "footer":
        return {
          sections: buildFooterShaderSections(),
          values: footerValues,
          onChange: handleFooterChange,
        };
      case "twizzler":
        return {
          sections: buildTwizzlerSections(heroValues),
          values: heroValues,
          onChange: handleHeroChange,
        };
      default: {
        const _exhaustive: never = target;
        throw new Error(`Unhandled shader target: ${_exhaustive}`);
      }
    }
  })();

  const titleSelector = (
    <PanelHeaderSelect
      ariaLabel="Shader controls"
      onChange={(nextValue) => {
        if (!isShaderTarget(nextValue) || !allowed.includes(nextValue)) return;
        setTarget(nextValue);
        localStorage.setItem(TARGET_STORAGE_KEY, nextValue);
        scrollToTarget(nextValue);
      }}
      options={SHADER_TARGET_OPTIONS.filter((option) => allowed.includes(option.value))}
      value={target}
    />
  );

  return (
    <FloatingPanel
      collapsed={false}
      defaultTheme="dark"
      float
      floatStorageKey={FLOAT_STORAGE_KEY}
      onToggle={onClose}
      showThemeToggle={false}
      side="right"
      title=""
      titleSlot={titleSelector}
    >
      <PanelSections onChange={active.onChange} sections={active.sections} values={active.values} />
      {toolsSlot}
    </FloatingPanel>
  );
}
