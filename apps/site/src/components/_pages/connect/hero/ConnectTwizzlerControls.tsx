import {
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
  AGENDA_TWIZZLER_CONTROL_DEFAULTS,
  AGENDA_TWIZZLER_TARGETS,
  agendaTwizzlerDefinition,
  isAgendaTwizzlerTarget,
  loadAgendaTwizzlerControlSettings,
  publishAgendaTwizzlerSettings,
  type AgendaTwizzlerTarget,
} from "../agenda/agenda-twizzler-settings";
import {
  loadSpeakerFrameSettings,
  publishSpeakerFrameSettings,
  SPEAKER_FRAME_DEFAULTS,
  SPEAKER_FRAME_PANEL_ID,
  type SpeakerFrameSettings,
  type SpeakerStripeControl,
} from "../speakers/speaker-frame-controls";
import { CONNECT_HERO_TWIZZLER_DEFAULTS } from "./twizzler-defaults";
import {
  CONNECT_TWIZZLER_CONTROL_DEFAULTS,
  resolveConnectTwizzlerSettings,
  type TwizzlerControlSettings,
} from "./twizzler-control-settings";

interface Props {
  onSettingsChange: (settings: TwizzlerSettings) => void;
}

function slider(
  key: keyof TwizzlerControlSettings & string,
  label: string,
  min: number,
  max: number,
  step: number
): PanelSliderField<TwizzlerControlSettings> {
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

const frameToggle = (
  key: keyof SpeakerFrameSettings & string,
  label: string
): PanelField<SpeakerFrameSettings> => ({ type: "toggle", key, label });

const frameColor = (
  key: keyof SpeakerFrameSettings & string,
  label: string
): PanelField<SpeakerFrameSettings> => ({ type: "color", key, label });

const frameSelect = (
  key: keyof SpeakerFrameSettings & string,
  label: string,
  options: ReadonlyArray<{ value: string; label: string }>
): PanelField<SpeakerFrameSettings> => ({
  type: "select",
  key,
  label,
  options,
});

const GRADIENT_STOPS_FIELD: PanelCollectionField<
  TwizzlerControlSettings,
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

const TWIZZLER_FIELDS: PanelField<TwizzlerControlSettings>[] = [
  { type: "section", title: "Appearance" },
  GRADIENT_STOPS_FIELD as PanelField<TwizzlerControlSettings>,
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

const STRIPE_FIELDS: PanelField<SpeakerStripeControl>[] = [
  { type: "color", key: "color", label: "Color" },
  {
    type: "slider",
    key: "startFrom",
    label: "Start threshold",
    min: 0,
    max: 1,
    step: 0.0001,
  },
  {
    type: "slider",
    key: "width",
    label: "Width",
    min: 0.05,
    max: 12,
    step: 0.05,
  },
  {
    type: "slider",
    key: "opacity",
    label: "Opacity",
    min: 0,
    max: 1,
    step: 0.01,
  },
];

const STRIPES_FIELD: PanelCollectionField<
  SpeakerFrameSettings,
  SpeakerStripeControl
> = {
  type: "collection",
  key: "stripes",
  label: "Stripe palette",
  addLabel: "Add stripe",
  min: 1,
  max: 24,
  multiOpen: true,
  itemLabel: (_stripe, index) => `Stripe ${index + 1}`,
  newItem: () => ({
    color: "#ff7a1f",
    startFrom: 0.5,
    width: 1,
    opacity: 1,
  }),
  itemFields: STRIPE_FIELDS,
};

const RENDER_MODES = [
  "sharp",
  "abstract",
  "charcoal",
  "pencil",
  "brush",
  "halftone",
  "risograph",
  "stainedGlass",
  "paperCutout",
  "crt",
  "glitch",
  "vhs",
  "amber",
  "gummy",
].map((value) => ({
  value,
  label: value
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (letter) => letter.toUpperCase()),
}));

const BLEND_MODES = [
  "normal",
  "multiply",
  "screen",
  "overlay",
  "darken",
  "lighten",
  "difference",
  "exclusion",
].map((value) => ({ value, label: value[0].toUpperCase() + value.slice(1) }));

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

  { type: "section", title: "Shader output" },
  frameSlider("shaderOpacity", "Opacity", 0, 1, 0.01),
  frameSelect("renderMode", "Render style", RENDER_MODES),
  frameSlider("renderIntensity", "Render intensity", 0, 2, 0.01),
  frameSlider("renderParamA", "Style parameter A", 0, 1, 0.01),
  frameSlider("renderParamB", "Style parameter B", 0, 1, 0.01),
  frameSlider("renderParamC", "Style parameter C", 0, 1, 0.01),
  frameSlider("renderParamD", "Style parameter D", 0, 1, 0.01),
  frameColor("renderColorA", "Render color A"),
  frameColor("renderColorB", "Render color B"),

  { type: "section", title: "Grid geometry" },
  frameSlider("gridCellWidth", "Cell width", 2, 48, 1),
  frameSlider("gridCellHeight", "Cell height", 2, 48, 1),
  frameSlider("gridGapX", "Horizontal gap", 0, 24, 0.25),
  frameSlider("gridGapY", "Vertical gap", 0, 24, 0.25),
  frameSlider("gridCornerRadius", "Corner radius", 0, 16, 0.25),
  frameSlider("gridOverlap", "Stripe overlap", 0, 4, 0.01),
  frameSelect("gridOrientation", "Orientation", [
    { value: "vertical", label: "Vertical" },
    { value: "horizontal", label: "Horizontal" },
  ]),
  frameSlider("gridAngle", "Grid angle", -180, 180, 1),

  { type: "section", title: "Stripe palette" },
  frameToggle("stripesEnabled", "Stripes enabled"),
  frameSlider("fieldScale", "Field scale", 0.1, 4, 0.01),
  STRIPES_FIELD as PanelField<SpeakerFrameSettings>,

  { type: "section", title: "Tone" },
  frameSlider("brightness", "Brightness", -1, 1, 0.01),
  frameSlider("exposure", "Exposure", -2, 2, 0.01),
  frameSlider("contrast", "Contrast", 0, 3, 0.01),
  frameSlider("blackPoint", "Black point", 0, 1, 0.01),
  frameSlider("whitePoint", "White point", 0, 1, 0.01),
  frameSlider("gamma", "Gamma", 0.1, 4, 0.01),
  frameToggle("invert", "Invert"),
  frameSlider("posterizeLevels", "Posterize levels", 0, 32, 1),
  frameSlider("thresholdBias", "Threshold bias", -1, 1, 0.01),
  frameSlider("noiseAmount", "Noise", 0, 1, 0.01),
  frameSlider("blurRadius", "Blur", 0, 24, 0.25),
  frameSlider("sharpenAmount", "Sharpen", 0, 4, 0.01),

  { type: "section", title: "Stripe sparkle" },
  frameToggle("sparkleWidthEnabled", "Width shimmer"),
  frameSlider("sparkleWidthCoverage", "Width coverage", 0, 1, 0.01),
  frameSlider("sparkleSwing", "Width swing", 0, 12, 0.1),
  frameToggle("sparkleStripeEnabled", "Stripe shimmer"),
  frameSlider("sparkleStripeCoverage", "Stripe coverage", 0, 1, 0.01),
  frameSlider("sparkleBrightness", "Maximum brightness", 0, 2, 0.01),
  frameSlider("sparkleSpeed", "Sparkle speed", 0, 5, 0.01),
  frameSlider("sparkleHueDrift", "Hue drift", -180, 180, 1),
  frameSlider("sparkleSaturation", "Saturation boost", -1, 2, 0.01),

  { type: "section", title: "Stripe detail" },
  frameToggle("dotsEnabled", "Stripe dots"),
  frameSlider("dotsDensity", "Dot density", 0, 1, 0.01),
  frameSlider("dotsVisibility", "Random visibility", 0, 1, 0.01),
  frameSlider("dotsSize", "Dot size", 0.25, 8, 0.05),
  frameSlider("dotsBrightness", "Dot brightness", 0, 2, 0.01),
  frameSlider("dotsHueDrift", "Dot hue drift", -180, 180, 1),
  frameSlider("dotsSaturation", "Dot saturation", -1, 2, 0.01),
  frameToggle("borderEnabled", "Stripe borders"),
  frameSlider("borderMinWidth", "Border minimum width", 0, 24, 0.25),
  frameSlider("borderDensity", "Border density", 0, 1, 0.01),
  frameToggle("gridLinesEnabled", "Grid lines"),
  frameSlider("gridLinesBrightness", "Grid line brightness", -1, 2, 0.01),
  frameSlider("gridLinesDensity", "Grid line density", 0, 1, 0.01),

  { type: "section", title: "Detected frames" },
  frameToggle("engineFramesEnabled", "Detected frame overlay"),
  frameSlider("engineFrameThreshold", "Luminance threshold", 0, 1, 0.01),
  frameSlider("engineFrameStripeCount", "Highlighted stripes", 1, 24, 1),
  frameSlider("engineFrameDistance", "Group distance", 0, 24, 1),
  frameColor("engineFrameColor", "Overlay color"),

  { type: "section", title: "Cursor distortion" },
  frameToggle("trailEnabled", "Shader cursor trail"),
  frameSlider("trailRadius", "Particle radius", 1, 160, 1),
  frameSlider("trailAlpha", "Particle alpha", 0, 1, 0.01),
  frameSlider("trailLife", "Particle life", 50, 4000, 10),
  frameSlider("trailPush", "Push strength", 0, 160, 1),

  { type: "section", title: "Color mapping" },
  frameSelect("colorMode", "Color source", [
    { value: "luminance", label: "Luminance" },
    { value: "colors", label: "Source colors" },
  ]),
  frameSelect("stripeBlendMode", "Stripe blend", BLEND_MODES),
  frameSlider("imageColorLightness", "Source lightness", -1, 1, 0.01),
  frameSlider("imageColorDensity", "Source density", 0, 2, 0.01),
  frameSlider("imageColorRemoveThin", "Remove thin stripes", 0, 1, 0.01),
  frameSlider("imageColorBoostThick", "Boost thick stripes", 0, 2, 0.01),
];

type ShaderTarget = "twizzler" | "frames" | AgendaTwizzlerTarget;

const TWIZZLER_PANEL_ID = "connect-twizzler-hero-v3";
const TARGET_STORAGE_KEY = "connect:shader-controls-target";

export default function ConnectTwizzlerControls({ onSettingsChange }: Props) {
  const [twizzlerValues, setTwizzlerValues] = useState<TwizzlerControlSettings>(
    () =>
      loadPersistedPanelValues(
        TWIZZLER_PANEL_ID,
        CONNECT_TWIZZLER_CONTROL_DEFAULTS
      )
  );
  const [agendaValues, setAgendaValues] = useState<
    Record<AgendaTwizzlerTarget, TwizzlerControlSettings>
  >(
    () =>
      Object.fromEntries(
        AGENDA_TWIZZLER_TARGETS.map(({ id }) => [
          id,
          loadAgendaTwizzlerControlSettings(id),
        ])
      ) as Record<AgendaTwizzlerTarget, TwizzlerControlSettings>
  );
  const [frameValues, setFrameValues] = useState<SpeakerFrameSettings>(() =>
    loadSpeakerFrameSettings()
  );
  const [target, setTarget] = useState<ShaderTarget>(() => {
    const stored = localStorage.getItem(TARGET_STORAGE_KEY);
    if (stored === "frames" || isAgendaTwizzlerTarget(stored)) return stored;
    return "twizzler";
  });
  const [open, setOpen] = useState(true);
  const togglePanel = useCallback(() => setOpen((current) => !current), []);

  usePanelShortcut(togglePanel);

  useEffect(() => {
    onSettingsChange(resolveConnectTwizzlerSettings(twizzlerValues));
  }, [onSettingsChange, twizzlerValues]);

  useEffect(() => {
    for (const { id } of AGENDA_TWIZZLER_TARGETS) {
      publishAgendaTwizzlerSettings(id, agendaValues[id]);
    }
  }, [agendaValues]);

  useEffect(() => {
    publishSpeakerFrameSettings(frameValues);
  }, [frameValues]);

  const titleSelector = (
    <span className="connect-shader-selector">
      <select
        aria-label="Shader controls"
        value={target}
        onChange={(event) => {
          const next = event.target.value as ShaderTarget;
          setTarget(next);
          localStorage.setItem(TARGET_STORAGE_KEY, next);
        }}
      >
        <option value="twizzler">Connect Twizzler</option>
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

  const panelPolish = (
    <style>{`
      .connect-shader-selector {
        position: relative;
        display: inline-flex;
        min-width: 0;
        margin-left: -16px;
        align-items: center;
      }

      .connect-shader-selector select {
        width: auto;
        field-sizing: content;
        appearance: none;
        cursor: pointer;
        border: 0;
        border-radius: 6px;
        background: transparent;
        color: inherit;
        font: inherit;
        font-weight: 600;
        padding: 5px 21px 5px 8px;
        text-align: left;
      }

      .connect-shader-selector select:hover,
      .connect-shader-selector select:focus-visible {
        background: var(--panel-surface-active);
        outline: none;
      }

      .connect-shader-selector svg {
        pointer-events: none;
        position: absolute;
        right: 5px;
        width: 12px;
        height: 12px;
        fill: none;
        stroke: currentColor;
        stroke-linecap: round;
        stroke-linejoin: round;
        stroke-width: 1.5;
      }

      [data-panel] .panel-action-btn,
      [data-panel] .panel-collection-add,
      [data-panel] .panel-prompt-copy {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding-inline: 12px;
        text-align: center;
      }
    `}</style>
  );

  if (target === "frames") {
    return (
      <>
        {panelPolish}
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
      </>
    );
  }

  if (isAgendaTwizzlerTarget(target)) {
    const definition = agendaTwizzlerDefinition(target);
    return (
      <>
        {panelPolish}
        <Panel
          key={definition.panelId}
          id={definition.panelId}
          title=""
          titleSlot={titleSelector}
          open={open}
          onClose={() => setOpen(false)}
          onOpen={() => setOpen(true)}
          values={agendaValues[target]}
          defaults={AGENDA_TWIZZLER_CONTROL_DEFAULTS[target]}
          fields={TWIZZLER_FIELDS}
          onChange={(values) =>
            setAgendaValues((current) => ({
              ...current,
              [target]: values,
            }))
          }
          prompts={[]}
          defaultTheme="dark"
          showThemeToggle={false}
          showAnimation={false}
          showExport={false}
        />
      </>
    );
  }

  return (
    <>
      {panelPolish}
      <Panel
        id={TWIZZLER_PANEL_ID}
        title=""
        titleSlot={titleSelector}
        open={open}
        onClose={() => setOpen(false)}
        onOpen={() => setOpen(true)}
        values={twizzlerValues}
        defaults={CONNECT_TWIZZLER_CONTROL_DEFAULTS}
        fields={TWIZZLER_FIELDS}
        onChange={setTwizzlerValues}
        prompts={[]}
        defaultTheme="dark"
        showThemeToggle={false}
        showAnimation={false}
        showExport={false}
      />
    </>
  );
}
