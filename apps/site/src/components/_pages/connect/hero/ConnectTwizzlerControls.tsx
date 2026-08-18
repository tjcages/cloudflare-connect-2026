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
  toEditableRainStripes,
} from "../panel/agendaRainLevaSchema";
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
  CONNECT_TWIZZLER_CONTROL_DEFAULTS,
  resolveConnectTwizzlerSettings,
  type TwizzlerControlSettings,
} from "./twizzler-control-settings";

interface Props {
  onSettingsChange: (settings: TwizzlerSettings) => void;
}

type ShaderTarget = "twizzler" | "frames" | "agenda-rain";

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

export default function ConnectTwizzlerControls({ onSettingsChange }: Props) {
  const [target, setTarget] = useState<ShaderTarget>(() => {
    const stored = localStorage.getItem(TARGET_STORAGE_KEY);
    if (stored === "frames" || stored === "agenda-rain") return stored;
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

  const [rainSeed] = useState(loadAgendaRainSettings);
  const rainValuesRef = useRef<AgendaRainSettings>(rainSeed);
  const [rainStripes, setRainStripes] = useState<AgendaRainStripeControl[]>(
    () => rainSeed.stripes
  );

  const publishFrames = useCallback((next: SpeakerFrameSettings) => {
    frameValuesRef.current = next;
    persist(SPEAKER_FRAME_PANEL_ID, next);
    publishSpeakerFrameSettings(next);
  }, []);

  const publishRain = useCallback((next: AgendaRainSettings) => {
    rainValuesRef.current = next;
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

  const rainFromValues = useCallback(
    (values: Record<string, unknown>) =>
      agendaRainFromLevaValues(values, rainValuesRef.current),
    []
  );

  const heroStore = useLevaTarget(
    () => buildTwizzlerLevaSchema(loadHeroControlSettings()),
    twizzlerSettingsFromLevaValues,
    publishHero
  );
  const rainStore = useLevaTarget(
    () => buildAgendaRainLevaSchema(rainSeed),
    rainFromValues,
    publishRain
  );
  const framesStore = useLevaTarget(
    () => buildSpeakerFramesLevaSchema(frameSeed),
    framesFromValues,
    publishFrames
  );

  // Feed the palette table its rows and edit handlers. The runtime is a
  // singleton read by whichever store's table is rendered, so it always
  // mirrors the active target.
  const rainTable = target === "agenda-rain";
  stripeColorsTableRuntime.stripes = rainTable
    ? toEditableRainStripes(rainStripes)
    : toEditableStripes(stripes);
  stripeColorsTableRuntime.showRampEasing = false;
  stripeColorsTableRuntime.showSavePalette = false;
  stripeColorsTableRuntime.canUndoShuffle = false;
  const setActiveStripes = rainTable
    ? (setRainStripes as typeof setStripes)
    : setStripes;
  stripeColorsTableRuntime.handlers = {
    ...stripeColorsTableRuntime.handlers,
    onColorChange: (id, hex) =>
      setActiveStripes((rows) =>
        rows.map((row) => (row.id === id ? { ...row, color: hex } : row))
      ),
    onOpacityChange: (id, opacity) =>
      setActiveStripes((rows) =>
        rows.map((row) => (row.id === id ? { ...row, opacity } : row))
      ),
    onThresholdChange: (id, startFrom) =>
      setActiveStripes((rows) =>
        rows.map((row) => (row.id === id ? { ...row, startFrom } : row))
      ),
    onWidthChange: (id, width) =>
      setActiveStripes((rows) =>
        rows.map((row) => (row.id === id ? { ...row, width } : row))
      ),
    onColorReorder: (orderedIds) =>
      setActiveStripes((rows) =>
        orderedIds
          .map((id) => rows.find((row) => row.id === id))
          .filter((row): row is SpeakerStripeControl => Boolean(row))
      ),
    onReverseColorOrder: () => setActiveStripes((rows) => [...rows].reverse()),
    onAdd: () =>
      setActiveStripes((rows) => [
        ...rows,
        {
          id: `stripe-${rows.length + 1}`,
          color: "#ff7a1f",
          startFrom: 0.5,
          width: 1,
          opacity: 1,
        },
      ]),
    onRemove: (id) =>
      setActiveStripes((rows) =>
        rows.length > 1 ? rows.filter((row) => row.id !== id) : rows
      ),
  };

  useEffect(() => {
    publishFrames({ ...frameValuesRef.current, stripes });
  }, [publishFrames, stripes]);

  useEffect(() => {
    publishRain({ ...rainValuesRef.current, stripes: rainStripes });
  }, [publishRain, rainStripes]);

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
      ? rainStore
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
        }}
        value={target}
      >
        <option value="twizzler">Connect Twizzler</option>
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
