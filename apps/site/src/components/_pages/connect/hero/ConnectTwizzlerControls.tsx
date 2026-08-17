import {
  normalizeTwizzlerSettings,
  type TwizzlerGradientStop,
  type TwizzlerSettings,
} from "@tjcages/connect-twizzler";
import {
  loadPersistedPanelValues,
  Panel,
  usePanelShortcut,
  type PanelCollectionField,
  type PanelField,
  type PanelSliderField,
} from "@tjcages/panels/dev";
import { useCallback, useEffect, useState } from "react";
import {
  publishSpeakerFrameSettings,
  SPEAKER_FRAME_DEFAULTS,
  SPEAKER_FRAME_PANEL_ID,
  type SpeakerFrameSettings,
} from "../speakers/speaker-frame-controls";
import { CONNECT_HERO_TWIZZLER_DEFAULTS } from "./twizzler-defaults";

interface Props {
  onSettingsChange: (settings: TwizzlerSettings) => void;
}

// The package also carries legacy and alternate-renderer settings that the
// Connect orange-wave renderer never reads. Keep this panel model intentional.
type TwizzlerHeroSettings = Pick<
  TwizzlerSettings,
  | "gradientStops"
  | "opacity"
  | "scale"
  | "centerY"
  | "amplitude"
  | "lineCount"
  | "lineWidth"
  | "minLineWidth"
  | "maxLineWidth"
  | "pointSpacing"
  | "rotateXDeg"
  | "rotateYDeg"
  | "rotateZDeg"
  | "fov"
  | "camDist"
  | "perspectiveWidth"
  | "panX"
  | "panY"
  | "panZ"
  | "speed"
>;

const TWIZZLER_HERO_DEFAULTS: TwizzlerHeroSettings = {
  gradientStops: CONNECT_HERO_TWIZZLER_DEFAULTS.gradientStops,
  opacity: CONNECT_HERO_TWIZZLER_DEFAULTS.opacity,
  scale: CONNECT_HERO_TWIZZLER_DEFAULTS.scale,
  centerY: CONNECT_HERO_TWIZZLER_DEFAULTS.centerY,
  amplitude: CONNECT_HERO_TWIZZLER_DEFAULTS.amplitude,
  lineCount: CONNECT_HERO_TWIZZLER_DEFAULTS.lineCount,
  lineWidth: CONNECT_HERO_TWIZZLER_DEFAULTS.lineWidth,
  minLineWidth: CONNECT_HERO_TWIZZLER_DEFAULTS.minLineWidth,
  maxLineWidth: CONNECT_HERO_TWIZZLER_DEFAULTS.maxLineWidth,
  pointSpacing: CONNECT_HERO_TWIZZLER_DEFAULTS.pointSpacing,
  rotateXDeg: CONNECT_HERO_TWIZZLER_DEFAULTS.rotateXDeg,
  rotateYDeg: CONNECT_HERO_TWIZZLER_DEFAULTS.rotateYDeg,
  rotateZDeg: CONNECT_HERO_TWIZZLER_DEFAULTS.rotateZDeg,
  fov: CONNECT_HERO_TWIZZLER_DEFAULTS.fov,
  camDist: CONNECT_HERO_TWIZZLER_DEFAULTS.camDist,
  perspectiveWidth: CONNECT_HERO_TWIZZLER_DEFAULTS.perspectiveWidth,
  panX: CONNECT_HERO_TWIZZLER_DEFAULTS.panX,
  panY: CONNECT_HERO_TWIZZLER_DEFAULTS.panY,
  panZ: CONNECT_HERO_TWIZZLER_DEFAULTS.panZ,
  speed: CONNECT_HERO_TWIZZLER_DEFAULTS.speed,
};

function slider(
  key: keyof TwizzlerHeroSettings & string,
  label: string,
  min: number,
  max: number,
  step: number
): PanelSliderField<TwizzlerHeroSettings> {
  return { type: "slider", key, label, min, max, step };
}

function frameSlider(
  key: keyof SpeakerFrameSettings & string,
  label: string,
  min: number,
  max: number,
  step: number
): PanelSliderField<SpeakerFrameSettings> {
  return { type: "slider", key, label, min, max, step };
}

const GRADIENT_STOPS_FIELD: PanelCollectionField<
  TwizzlerHeroSettings,
  TwizzlerGradientStop
> = {
  type: "collection",
  key: "gradientStops",
  label: "Gradient hotspots",
  min: 1,
  max: 16,
  itemLabel: (_stop, index) => `Hotspot ${index + 1}`,
  newItem: () => ({
    x: 0.5,
    y: 0.5,
    offset: 0.5,
    color: CONNECT_HERO_TWIZZLER_DEFAULTS.colorEdge,
  }),
  itemFields: [
    { type: "color", key: "color", label: "Color" },
    {
      type: "slider",
      key: "x",
      label: "Horizontal",
      min: 0,
      max: 1,
      step: 0.01,
    },
    {
      type: "slider",
      key: "y",
      label: "Vertical",
      min: 0,
      max: 1,
      step: 0.01,
    },
  ],
};

const TWIZZLER_FIELDS: PanelField<TwizzlerHeroSettings>[] = [
  { type: "section", title: "Appearance" },
  GRADIENT_STOPS_FIELD as PanelField<TwizzlerHeroSettings>,
  slider("opacity", "Opacity", 0, 1, 0.01),

  { type: "section", title: "Composition" },
  slider("scale", "Scale", 0.01, 50, 0.01),
  slider("centerY", "Vertical center", -2, 3, 0.01),
  slider("amplitude", "Amplitude", 0, 20, 0.01),
  slider("lineCount", "Line count", 1, 800, 1),
  slider("lineWidth", "Line width", 0.01, 80, 0.01),
  slider("minLineWidth", "Minimum line width", 0.01, 40, 0.01),
  slider("maxLineWidth", "Maximum line width", 0.01, 120, 0.01),
  slider("pointSpacing", "Point spacing", 1, 400, 1),

  { type: "section", title: "Camera" },
  slider("rotateXDeg", "Scene rotation X", -720, 720, 0.1),
  slider("rotateYDeg", "Scene rotation Y", -720, 720, 0.1),
  slider("rotateZDeg", "Scene rotation Z", -720, 720, 0.1),
  slider("fov", "Field of view", 0.05, 20, 0.01),
  slider("camDist", "Camera distance", 0.25, 200, 0.01),
  slider("perspectiveWidth", "Perspective width", 0, 40, 0.01),
  slider("panX", "Pan X", -400, 400, 1),
  slider("panY", "Pan Y", -400, 400, 1),
  slider("panZ", "Pan Z", -20, 20, 0.01),

  { type: "section", title: "Motion" },
  slider("speed", "Speed", 0, 40, 0.01),
];

const FRAME_FIELDS: PanelField<SpeakerFrameSettings>[] = [
  { type: "section", title: "Frames" },
  frameSlider("frameCount", "Frame count", 0, 6, 1),
  frameSlider("frameWidth", "Frame width", 0.35, 2, 0.01),
  frameSlider("frameHeight", "Frame height", 0.35, 2, 0.01),

  { type: "section", title: "Frame motion" },
  frameSlider("horizontalSpeed", "Horizontal speed", 0, 4, 0.01),
  frameSlider("verticalSpeed", "Vertical speed", 0, 4, 0.01),

  { type: "section", title: "Pointer frame" },
  frameSlider("cursorWidth", "Pointer width", 0.35, 2, 0.01),
  frameSlider("cursorHeight", "Pointer height", 0.35, 2, 0.01),
  frameSlider("cursorFollow", "Follow", 0.01, 1, 0.01),

  { type: "section", title: "Shader inside frames" },
  frameSlider("shaderOpacity", "Opacity", 0, 1, 0.01),
  frameSlider("cellSize", "Cell size", 3, 24, 1),
  frameSlider("brightness", "Brightness", -1, 1, 0.01),
  frameSlider("contrast", "Contrast", 0, 3, 0.01),
];

type ShaderTarget = "twizzler" | "frames";

const TWIZZLER_PANEL_ID = "connect-twizzler-hero-v3";
const TARGET_STORAGE_KEY = "connect:shader-controls-target";

export default function ConnectTwizzlerControls({ onSettingsChange }: Props) {
  const [twizzlerValues, setTwizzlerValues] = useState<TwizzlerHeroSettings>(
    () => loadPersistedPanelValues(TWIZZLER_PANEL_ID, TWIZZLER_HERO_DEFAULTS)
  );
  const [frameValues, setFrameValues] = useState<SpeakerFrameSettings>(() =>
    loadPersistedPanelValues(SPEAKER_FRAME_PANEL_ID, SPEAKER_FRAME_DEFAULTS)
  );
  const [target, setTarget] = useState<ShaderTarget>(() =>
    localStorage.getItem(TARGET_STORAGE_KEY) === "frames"
      ? "frames"
      : "twizzler"
  );
  const [open, setOpen] = useState(true);
  const togglePanel = useCallback(() => setOpen((current) => !current), []);

  usePanelShortcut(togglePanel);

  useEffect(() => {
    onSettingsChange(
      normalizeTwizzlerSettings({
        ...CONNECT_HERO_TWIZZLER_DEFAULTS,
        ...twizzlerValues,
      })
    );
  }, [onSettingsChange, twizzlerValues]);

  useEffect(() => {
    publishSpeakerFrameSettings(frameValues);
  }, [frameValues]);

  const titleSelector = (
    <select
      aria-label="Shader controls"
      value={target}
      onChange={(event) => {
        const next = event.target.value as ShaderTarget;
        setTarget(next);
        localStorage.setItem(TARGET_STORAGE_KEY, next);
      }}
      style={{
        minWidth: 142,
        border: 0,
        background: "transparent",
        color: "inherit",
        font: "inherit",
        fontWeight: 600,
      }}
    >
      <option value="twizzler">Connect Twizzler</option>
      <option value="frames">Speaker Frames</option>
    </select>
  );

  if (target === "frames") {
    return (
      <Panel
        id={SPEAKER_FRAME_PANEL_ID}
        title=""
        titleSlot={titleSelector}
        open={open}
        onClose={() => setOpen(false)}
        onOpen={() => setOpen(true)}
        values={frameValues}
        defaults={SPEAKER_FRAME_DEFAULTS}
        fields={FRAME_FIELDS}
        onChange={setFrameValues}
        prompts={[]}
        defaultTheme="dark"
        showThemeToggle={false}
        showAnimation={false}
        showExport={false}
      />
    );
  }

  return (
    <Panel
      id={TWIZZLER_PANEL_ID}
      title=""
      titleSlot={titleSelector}
      open={open}
      onClose={() => setOpen(false)}
      onOpen={() => setOpen(true)}
      values={twizzlerValues}
      defaults={TWIZZLER_HERO_DEFAULTS}
      fields={TWIZZLER_FIELDS}
      onChange={setTwizzlerValues}
      prompts={[]}
      defaultTheme="dark"
      showThemeToggle={false}
      showAnimation={false}
      showExport={false}
    />
  );
}
