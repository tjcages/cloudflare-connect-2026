import type { TwizzlerSettings } from "@tjcages/connect-twizzler";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AGENDA_RAIN_PANEL_ID,
  loadAgendaRainSettings,
  publishAgendaRainSettings,
  type AgendaRainSettings,
  type AgendaRainStripeControl,
} from "../agenda/agenda-rain-controls";
import { ConnectLevaPanel, useLevaTarget } from "../panel/ConnectLevaPanel";
import {
  agendaRainFromLevaValues,
  buildAgendaRainLevaSchema,
  toEditableRainStripes as toEditableAgendaRainStripes,
} from "../panel/agendaRainLevaSchema";
import { copyConfigToClipboard } from "../panel/copyConfig";
import {
  buildRainLevaSchema,
  rainSettingsFromLevaValues,
  toEditableRainStripes as toEditableHeroRainStripes,
} from "../panel/rainLevaSchema";
import {
  buildSpeakerFramesLevaSchema,
  speakerFramesFromLevaValues,
  toEditableStripes,
} from "../panel/speakerFramesLevaSchema";
import { stripeColorsTableRuntime } from "../panel/stripeColorsTablePlugin";
import {
  buildTwizzlerLevaSchema,
  twizzlerSettingsFromLevaValues,
} from "../panel/twizzlerLevaSchema";
import {
  loadSpeakerFrameSettings,
  publishSpeakerFrameSettings,
  type SpeakerFrameSettings,
  type SpeakerStripeControl,
} from "../speakers/speaker-frame-controls";
import {
  loadRainControlSettings,
  RAIN_PANEL_ID,
  resolveConnectHeroRain,
  type ConnectHeroRain,
  type RainControlSettings,
  type RainStripeControl,
} from "./rain-control-settings";
import {
  CONNECT_TWIZZLER_CONTROL_DEFAULTS,
  resolveConnectTwizzlerSettings,
  type TwizzlerControlSettings,
} from "./twizzler-control-settings";

interface Props {
  onSettingsChange: (settings: TwizzlerSettings) => void;
  onRainChange: (rain: ConnectHeroRain) => void;
}

type ShaderTarget = "twizzler" | "rain" | "frames" | "agenda-rain";

const TWIZZLER_PANEL_ID = "connect-twizzler-hero-v3";
const SPEAKER_FRAME_PANEL_ID = "connect-speaker-frames-v2";
const TARGET_STORAGE_KEY = "connect:shader-controls-target";

const persist = (id: string, values: unknown) => {
  try {
    localStorage.setItem(`panels:${id}`, JSON.stringify(values));
  } catch {
    // Private-mode / quota failures must not break the panel.
  }
};

const loadHeroControlSettings = (): TwizzlerControlSettings => {
  try {
    const raw = localStorage.getItem(`panels:${TWIZZLER_PANEL_ID}`);
    if (!raw) return CONNECT_TWIZZLER_CONTROL_DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<TwizzlerControlSettings>;
    if (!parsed || typeof parsed !== "object") {
      return CONNECT_TWIZZLER_CONTROL_DEFAULTS;
    }
    return { ...CONNECT_TWIZZLER_CONTROL_DEFAULTS, ...parsed };
  } catch {
    return CONNECT_TWIZZLER_CONTROL_DEFAULTS;
  }
};

export default function ConnectTwizzlerControls({
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
  const [open, setOpen] = useState(true);

  // Speaker and rain stripes are edited through the palette table's runtime
  // handlers rather than a leva value, so they live in React state next to
  // their stores.
  const [frameSeed] = useState(loadSpeakerFrameSettings);
  const frameValuesRef = useRef<SpeakerFrameSettings>(frameSeed);
  const [stripes, setStripes] = useState<SpeakerStripeControl[]>(
    () => frameSeed.stripes
  );

  const [heroRainSeed] = useState(loadRainControlSettings);
  const heroRainValuesRef = useRef<RainControlSettings>(heroRainSeed);
  const [heroRainStripes, setHeroRainStripes] = useState<RainStripeControl[]>(
    () => heroRainSeed.stripes
  );

  const [agendaRainSeed] = useState(loadAgendaRainSettings);
  const agendaRainValuesRef = useRef<AgendaRainSettings>(agendaRainSeed);
  const [agendaRainStripes, setAgendaRainStripes] = useState<
    AgendaRainStripeControl[]
  >(() => agendaRainSeed.stripes);

  const publishFrames = useCallback((next: SpeakerFrameSettings) => {
    frameValuesRef.current = next;
    persist(SPEAKER_FRAME_PANEL_ID, next);
    publishSpeakerFrameSettings(next);
  }, []);

  const publishHeroRain = useCallback(
    (next: RainControlSettings) => {
      heroRainValuesRef.current = next;
      persist(RAIN_PANEL_ID, next);
      onRainChange(resolveConnectHeroRain(next));
    },
    [onRainChange]
  );

  const publishAgendaRain = useCallback((next: AgendaRainSettings) => {
    agendaRainValuesRef.current = next;
    persist(AGENDA_RAIN_PANEL_ID, next);
    publishAgendaRainSettings(next);
  }, []);

  const publishHero = useCallback(
    (next: TwizzlerControlSettings) => {
      persist(TWIZZLER_PANEL_ID, next);
      onSettingsChange(resolveConnectTwizzlerSettings(next));
    },
    [onSettingsChange]
  );

  const framesFromValues = useCallback(
    (values: Record<string, unknown>) =>
      speakerFramesFromLevaValues(values, frameValuesRef.current),
    []
  );

  const heroRainFromValues = useCallback(
    (values: Record<string, unknown>) =>
      rainSettingsFromLevaValues(values, heroRainValuesRef.current),
    []
  );

  const agendaRainFromValues = useCallback(
    (values: Record<string, unknown>) =>
      agendaRainFromLevaValues(values, agendaRainValuesRef.current),
    []
  );

  // Copy config reads the persisted blobs / live refs, so the button always
  // snapshots the current values rather than the mount-time seed.
  const heroStore = useLevaTarget(
    () =>
      buildTwizzlerLevaSchema(loadHeroControlSettings(), () =>
        copyConfigToClipboard("hero twizzler", loadHeroControlSettings())
      ),
    twizzlerSettingsFromLevaValues,
    publishHero
  );
  const heroRainStore = useLevaTarget(
    () =>
      buildRainLevaSchema(heroRainSeed, () =>
        copyConfigToClipboard("hero rain", heroRainValuesRef.current)
      ),
    heroRainFromValues,
    publishHeroRain
  );
  const agendaRainStore = useLevaTarget(
    () =>
      buildAgendaRainLevaSchema(agendaRainSeed, () =>
        copyConfigToClipboard("agenda rain", agendaRainValuesRef.current)
      ),
    agendaRainFromValues,
    publishAgendaRain
  );
  const framesStore = useLevaTarget(
    () =>
      buildSpeakerFramesLevaSchema(frameSeed, () =>
        copyConfigToClipboard("speaker frames", frameValuesRef.current)
      ),
    framesFromValues,
    publishFrames
  );

  // Feed the palette table its rows and edit handlers. The table runtime is a
  // module singleton and only the selected target's panel renders it, so the
  // active target decides whose rows and setters it carries.
  type StripeRow = { id: string; color: string };
  const stripeRowHandlers = <T extends StripeRow>(
    setRows: (update: (rows: T[]) => T[]) => void,
    makeRow: (index: number) => T
  ) => ({
    ...stripeColorsTableRuntime.handlers,
    onColorChange: (id: string, hex: string) =>
      setRows((rows) =>
        rows.map((row) => (row.id === id ? { ...row, color: hex } : row))
      ),
    onOpacityChange: (id: string, opacity: number) =>
      setRows((rows) =>
        rows.map((row) => (row.id === id ? { ...row, opacity } : row))
      ),
    onThresholdChange: (id: string, startFrom: number) =>
      setRows((rows) =>
        rows.map((row) => (row.id === id ? { ...row, startFrom } : row))
      ),
    onWidthChange: (id: string, width: number) =>
      setRows((rows) =>
        rows.map((row) => (row.id === id ? { ...row, width } : row))
      ),
    onColorReorder: (orderedIds: string[]) =>
      setRows((rows) =>
        orderedIds
          .map((id) => rows.find((row) => row.id === id))
          .filter((row): row is T => Boolean(row))
      ),
    onReverseColorOrder: () => setRows((rows) => [...rows].reverse()),
    onAdd: () => setRows((rows) => [...rows, makeRow(rows.length + 1)]),
    onRemove: (id: string) =>
      setRows((rows) =>
        rows.length > 1 ? rows.filter((row) => row.id !== id) : rows
      ),
  });

  stripeColorsTableRuntime.showRampEasing = false;
  stripeColorsTableRuntime.showSavePalette = false;
  stripeColorsTableRuntime.canUndoShuffle = false;
  if (target === "rain") {
    stripeColorsTableRuntime.stripes = toEditableHeroRainStripes(
      heroRainStripes
    );
    stripeColorsTableRuntime.handlers = stripeRowHandlers(
      setHeroRainStripes,
      (index) => ({
        id: `stripe-${index}`,
        color: "#f46021",
        startFrom: 0.5,
        width: 1,
        opacity: 1,
      })
    );
  } else if (target === "agenda-rain") {
    stripeColorsTableRuntime.stripes = toEditableAgendaRainStripes(
      agendaRainStripes
    );
    stripeColorsTableRuntime.handlers = stripeRowHandlers(
      setAgendaRainStripes,
      (index) => ({
        id: `stripe-${index}`,
        color: "#ff7a1f",
        startFrom: 0.5,
        width: 1,
        opacity: 1,
      })
    );
  } else {
    stripeColorsTableRuntime.stripes = toEditableStripes(stripes);
    stripeColorsTableRuntime.handlers = stripeRowHandlers(
      setStripes,
      (index) => ({
        id: `stripe-${index}`,
        color: "#ff7a1f",
        startFrom: 0.5,
        width: 1,
        opacity: 1,
      })
    );
  }

  useEffect(() => {
    publishFrames({ ...frameValuesRef.current, stripes });
  }, [publishFrames, stripes]);

  useEffect(() => {
    publishHeroRain({ ...heroRainValuesRef.current, stripes: heroRainStripes });
  }, [publishHeroRain, heroRainStripes]);

  useEffect(() => {
    publishAgendaRain({
      ...agendaRainValuesRef.current,
      stripes: agendaRainStripes,
    });
  }, [publishAgendaRain, agendaRainStripes]);

  const togglePanel = useCallback(() => setOpen((current) => !current), []);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.key.toLowerCase() !== "d" ||
        !event.metaKey ||
        !event.shiftKey ||
        event.altKey
      )
        return;
      event.preventDefault();
      event.stopPropagation();
      togglePanel();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [togglePanel]);

  const activeStore =
    target === "agenda-rain"
      ? agendaRainStore
      : target === "rain"
        ? heroRainStore
        : target === "frames"
          ? framesStore
          : heroStore;

  const titleSelector = (
    <span className="connect-shader-selector">
      <select
        aria-label="Shader controls"
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
      <svg aria-hidden viewBox="0 0 12 12">
        <path d="m2.25 4.25 3.75 3.5 3.75-3.5" />
      </svg>
    </span>
  );

  return open ? (
    <ConnectLevaPanel
      onClose={() => setOpen(false)}
      store={activeStore}
      titleSlot={titleSelector}
    />
  ) : null;
}
