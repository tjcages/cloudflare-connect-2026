import type { TwizzlerSettings } from "@tjcages/connect-twizzler";
import { FloatingPanel } from "@tjcages/panels/dev";
import { useCallback, useMemo, useRef, useState } from "react";
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
import { copyConfigToClipboard } from "../panel/copyConfig";
import { PanelSections, type PanelValues } from "../panel/panelSections";
import {
  buildRainSections,
  rainFromPanelValues,
  seedRainPanelValues,
} from "../panel/rainFields";
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
  loadRainControlSettings,
  RAIN_PANEL_ID,
  resolveConnectHeroRain,
  type ConnectHeroRain,
} from "./rain-control-settings";
import {
  CONNECT_TWIZZLER_CONTROL_DEFAULTS,
  CONNECT_TWIZZLER_PANEL_ID,
  loadConnectTwizzlerControlSettings,
  resolveConnectTwizzlerSettings,
} from "./twizzler-control-settings";

interface Props {
  onClose: () => void;
  onSettingsChange: (settings: TwizzlerSettings) => void;
  onRainChange: (rain: ConnectHeroRain) => void;
}

type ShaderTarget = "twizzler" | "rain" | "frames" | "agenda-rain";

const TARGET_STORAGE_KEY = "connect:shader-controls-target";
const FLOAT_STORAGE_KEY = "connect-shader-controls";

const persist = (id: string, values: unknown) => {
  try {
    localStorage.setItem(`panels:${id}`, JSON.stringify(values));
  } catch {
    // Private-mode / quota failures must not break the panel.
  }
};

const loadHeroControlSettings = () =>
  loadConnectTwizzlerControlSettings() ?? CONNECT_TWIZZLER_CONTROL_DEFAULTS;

export default function ConnectTwizzlerControls({
  onClose,
  onSettingsChange,
  onRainChange,
}: Props) {
  const [target, setTarget] = useState<ShaderTarget>(() => {
    const stored = localStorage.getItem(TARGET_STORAGE_KEY);
    if (stored === "frames" || stored === "rain" || stored === "agenda-rain")
      return stored;
    // The retired per-day agenda Twizzler targets collapse into the shared rain.
    if (stored?.startsWith("agenda-")) return "agenda-rain";
    return "twizzler";
  });

  // One live value record per target, seeded from the persisted blobs. Every
  // edit persists in the target's own JSON shape and publishes to its shader,
  // so switching targets never resets the others.
  const [heroValues, setHeroValues] = useState<PanelValues>(() =>
    seedTwizzlerPanelValues(loadHeroControlSettings())
  );
  const [heroRainValues, setHeroRainValues] = useState<PanelValues>(() =>
    seedRainPanelValues(loadRainControlSettings())
  );
  const [frameValues, setFrameValues] = useState<PanelValues>(() =>
    seedSpeakerFramesPanelValues(loadSpeakerFrameSettings())
  );
  const [rainValues, setRainValues] = useState<PanelValues>(() =>
    seedAgendaRainPanelValues(loadAgendaRainSettings())
  );

  const heroRef = useRef(heroValues);
  heroRef.current = heroValues;
  const heroRainRef = useRef(heroRainValues);
  heroRainRef.current = heroRainValues;
  const framesRef = useRef(frameValues);
  framesRef.current = frameValues;
  const rainRef = useRef(rainValues);
  rainRef.current = rainValues;

  const handleHeroChange = useCallback(
    (next: PanelValues) => {
      setHeroValues(next);
      const settings = twizzlerSettingsFromPanelValues(next);
      persist(CONNECT_TWIZZLER_PANEL_ID, settings);
      onSettingsChange(resolveConnectTwizzlerSettings(settings));
    },
    [onSettingsChange]
  );

  const handleHeroRainChange = useCallback(
    (next: PanelValues) => {
      setHeroRainValues(next);
      const settings = rainFromPanelValues(next);
      persist(RAIN_PANEL_ID, settings);
      onRainChange(resolveConnectHeroRain(settings));
    },
    [onRainChange]
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

  // Copy config snapshots the live values, so the button never captures a
  // stale mount-time seed.
  const heroActions = useMemo(
    () => ({
      copyConfig: () =>
        copyConfigToClipboard(
          "hero twizzler",
          twizzlerSettingsFromPanelValues(heroRef.current)
        ),
    }),
    []
  );
  const heroRainActions = useMemo(
    () => ({
      copyConfig: () =>
        copyConfigToClipboard(
          "hero rain",
          rainFromPanelValues(heroRainRef.current)
        ),
    }),
    []
  );
  const framesActions = useMemo(
    () => ({
      copyConfig: () =>
        copyConfigToClipboard(
          "speaker frames",
          speakerFramesFromPanelValues(framesRef.current)
        ),
    }),
    []
  );
  const rainActions = useMemo(
    () => ({
      copyConfig: () =>
        copyConfigToClipboard(
          "agenda rain",
          agendaRainFromPanelValues(rainRef.current)
        ),
    }),
    []
  );

  const active =
    target === "agenda-rain"
      ? {
          sections: buildAgendaRainSections(),
          values: rainValues,
          onChange: handleRainChange,
          actionHandlers: rainActions,
        }
      : target === "rain"
        ? {
            sections: buildRainSections(),
            values: heroRainValues,
            onChange: handleHeroRainChange,
            actionHandlers: heroRainActions,
          }
        : target === "frames"
          ? {
              sections: buildSpeakerFramesSections(),
              values: frameValues,
              onChange: handleFramesChange,
              actionHandlers: framesActions,
            }
          : {
              sections: buildTwizzlerSections(heroValues),
              values: heroValues,
              onChange: handleHeroChange,
              actionHandlers: heroActions,
            };

  const titleSelector = (
    <select
      aria-label="Shader controls"
      className="panel-switcher"
      onChange={(event) => {
        const next = event.target.value as ShaderTarget;
        setTarget(next);
        localStorage.setItem(TARGET_STORAGE_KEY, next);
        // Bring the section that hosts the selected shader into view.
        const behavior = window.matchMedia("(prefers-reduced-motion: reduce)")
          .matches
          ? ("auto" as const)
          : ("smooth" as const);
        if (next === "twizzler" || next === "rain") {
          window.scrollTo({ top: 0, behavior });
        } else {
          document
            .querySelector(next === "frames" ? "#speakers" : "#agenda")
            ?.scrollIntoView({ behavior, block: "start" });
        }
      }}
      value={target}
    >
      <option value="twizzler">Connect Twizzler</option>
      <option value="rain">Hero Rain</option>
      <option value="frames">Speaker Frames</option>
      <option value="agenda-rain">Agenda Rain</option>
    </select>
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
      <PanelSections
        actionHandlers={active.actionHandlers}
        onChange={active.onChange}
        sections={active.sections}
        values={active.values}
      />
    </FloatingPanel>
  );
}
