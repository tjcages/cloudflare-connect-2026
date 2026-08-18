import type { TwizzlerSettings } from "@tjcages/connect-twizzler";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AGENDA_TWIZZLER_TARGETS,
  isAgendaTwizzlerTarget,
  loadAgendaTwizzlerControlSettings,
  publishAgendaTwizzlerSettings,
  type AgendaTwizzlerTarget,
} from "../agenda/agenda-twizzler-settings";
import {
  ConnectLevaPanel,
  useLevaTarget,
  type LevaStore,
} from "../panel/ConnectLevaPanel";
import {
  buildRainLevaSchema,
  rainSettingsFromLevaValues,
  toEditableRainStripes,
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

type ShaderTarget = "twizzler" | "rain" | "frames" | AgendaTwizzlerTarget;

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

function useAgendaTarget(id: AgendaTwizzlerTarget): LevaStore {
  const onChange = useCallback(
    (next: TwizzlerControlSettings) => publishAgendaTwizzlerSettings(id, next),
    [id]
  );
  return useLevaTarget(
    () => buildTwizzlerLevaSchema(loadAgendaTwizzlerControlSettings(id)),
    twizzlerSettingsFromLevaValues,
    onChange
  );
}

export default function ConnectTwizzlerControls({
  onSettingsChange,
  onRainChange,
}: Props) {
  const [target, setTarget] = useState<ShaderTarget>(() => {
    const stored = localStorage.getItem(TARGET_STORAGE_KEY);
    if (
      stored === "frames" ||
      stored === "rain" ||
      isAgendaTwizzlerTarget(stored)
    )
      return stored;
    return "twizzler";
  });
  const [open, setOpen] = useState(true);

  // Speaker stripes are edited through the palette table's runtime handlers
  // rather than a leva value, so they live in React state next to the store.
  const [frameSeed] = useState(loadSpeakerFrameSettings);
  const frameValuesRef = useRef<SpeakerFrameSettings>(frameSeed);
  const [stripes, setStripes] = useState<SpeakerStripeControl[]>(
    () => frameSeed.stripes
  );

  // Rain stripes follow the same shape: React state feeding the shared table.
  const [rainSeed] = useState(loadRainControlSettings);
  const rainValuesRef = useRef<RainControlSettings>(rainSeed);
  const [rainStripes, setRainStripes] = useState<RainStripeControl[]>(
    () => rainSeed.stripes
  );

  const publishFrames = useCallback((next: SpeakerFrameSettings) => {
    frameValuesRef.current = next;
    persist(SPEAKER_FRAME_PANEL_ID, next);
    publishSpeakerFrameSettings(next);
  }, []);

  const publishRain = useCallback(
    (next: RainControlSettings) => {
      rainValuesRef.current = next;
      persist(RAIN_PANEL_ID, next);
      onRainChange(resolveConnectHeroRain(next));
    },
    [onRainChange]
  );

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
      rainSettingsFromLevaValues(values, rainValuesRef.current),
    []
  );

  const heroStore = useLevaTarget(
    () => buildTwizzlerLevaSchema(loadHeroControlSettings()),
    twizzlerSettingsFromLevaValues,
    publishHero
  );
  const rainStore = useLevaTarget(
    () => buildRainLevaSchema(rainSeed),
    rainFromValues,
    publishRain
  );
  const agendaMonStore = useAgendaTarget("agenda-mon");
  const agendaTueStore = useAgendaTarget("agenda-tue");
  const agendaWedStore = useAgendaTarget("agenda-wed");
  const framesStore = useLevaTarget(
    () => buildSpeakerFramesLevaSchema(frameSeed),
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
    stripeColorsTableRuntime.stripes = toEditableRainStripes(rainStripes);
    stripeColorsTableRuntime.handlers = stripeRowHandlers(
      setRainStripes,
      (index) => ({
        id: `stripe-${index}`,
        color: "#f46021",
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

  const agendaStores: Record<AgendaTwizzlerTarget, LevaStore> = {
    "agenda-mon": agendaMonStore,
    "agenda-tue": agendaTueStore,
    "agenda-wed": agendaWedStore,
  };
  const activeStore = isAgendaTwizzlerTarget(target)
    ? agendaStores[target]
    : target === "frames"
      ? framesStore
      : target === "rain"
        ? rainStore
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
        <option value="rain">Hero Rain</option>
        <option value="frames">Speaker Frames</option>
        {AGENDA_TWIZZLER_TARGETS.map(({ id, label }) => (
          <option key={id} value={id}>
            {label}
          </option>
        ))}
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
