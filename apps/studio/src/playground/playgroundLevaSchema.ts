import { button, folder } from "leva";
import type { FolderSettings } from "leva/dist/declarations/src/types/public";
import { PLAYGROUND_CONTROL_RANGES } from "./playgroundControlRanges";
import { PLAYGROUND_FIELD_HELP } from "./playgroundFieldHelp";
import type { PlaygroundTextureId } from "./playgroundTextures";
import {
  PLAYGROUND_DISPLAY_MAX_PX,
  type Stripe,
  type TextureLuminanceMode,
  type TextureLuminanceSettings,
  type PlaygroundGridConfig,
  type PlaygroundFlamesConfig,
  type PlaygroundEdgeMaskConfig,
  type PlaygroundFlamesDirection,
  type PlaygroundCursorTrailConfig,
  type PlaygroundClickWaveConfig,
  type PlaygroundRevealConfig,
  type PlaygroundAssemblyRevealConfig,
  type PlaygroundAssemblyRevealOrder,
  type PlaygroundRevealType,
  type PlaygroundWaveRevealConfig,
  type PlaygroundWaveRevealPosition,
  type PlaygroundSourceFit,
  type PlaygroundSourceTransform,
  type PlaygroundTextureAdjustments,
  type StripesSceneConfig,
} from "@necatikcl/stripes-shader";

type PlaygroundDebugStage = StripesSceneConfig["debugStage"];
import { stripeColorsTablePlugin, stripeSyncKey } from "./stripeColorsTablePlugin";

type LevaChangeContext = {
  initial: boolean;
};

type LevaOnChangeHandler = (value: unknown, path: string, context: LevaChangeContext) => void;

function skipInitial(handler: (value: number) => void): LevaOnChangeHandler {
  return (value, _path, context) => {
    if (context.initial) {
      return;
    }
    handler(value as number);
  };
}

function skipInitialBool(handler: (value: boolean) => void): LevaOnChangeHandler {
  return (value, _path, context) => {
    if (context.initial) {
      return;
    }
    handler(value as boolean);
  };
}

function skipInitialString(handler: (value: string) => void): LevaOnChangeHandler {
  return (value, _path, context) => {
    if (context.initial) {
      return;
    }
    handler(String(value));
  };
}

function levaFolder(schema: Record<string, unknown>, settings?: FolderSettings) {
  return folder(schema as never, settings);
}

function numControl(
  value: number,
  min: number,
  max: number,
  step: number,
  options: {
    label?: string;
    hint?: string;
    disabled?: boolean;
    onLive: (value: number) => void;
    onCommit: (value: number) => void;
  },
) {
  return {
    value,
    min,
    max,
    step,
    label: options.label,
    hint: options.hint,
    disabled: options.disabled,
    transient: true as const,
    onChange: skipInitial(options.onLive),
    onEditEnd: skipInitial(options.onCommit),
  };
}

function boolControl(
  value: boolean,
  options: {
    label?: string;
    hint?: string;
    disabled?: boolean;
    onChange: (value: boolean) => void;
  },
) {
  return {
    value,
    label: options.label,
    hint: options.hint,
    disabled: options.disabled,
    onChange: skipInitialBool(options.onChange),
  };
}

function selectControl<T extends string>(
  value: T,
  options: Record<string, T>,
  settings: {
    label?: string;
    hint?: string;
    disabled?: boolean;
    onChange: (value: T) => void;
  },
) {
  return {
    value,
    options,
    label: settings.label,
    hint: settings.hint,
    disabled: settings.disabled,
    onChange: skipInitialString((next) => settings.onChange(next as T)),
  };
}

function resetButton(onClick: () => void, disabled: boolean) {
  return { ...button(onClick, { disabled }), label: "Reset" };
}

function actionButton(onClick: () => void, disabled = false) {
  return button(onClick, { disabled });
}

function folderColor(modified: boolean): string | undefined {
  return modified ? "#c45c26" : undefined;
}

function intToHex(value: number): string {
  return `#${(value & 0xffffff).toString(16).padStart(6, "0")}`;
}

function hexToInt(hex: string): number {
  const parsed = Number.parseInt(hex.replace(/^#/, ""), 16);
  return Number.isFinite(parsed) ? parsed & 0xffffff : 0;
}

const WAVE_POSITION_OPTIONS: Record<string, PlaygroundWaveRevealPosition> = {
  "Left top": "left top",
  "Center top": "center top",
  "Right top": "right top",
  "Left center": "left center",
  Center: "center",
  "Right center": "right center",
  "Left bottom": "left bottom",
  "Center bottom": "center bottom",
  "Right bottom": "right bottom",
};

const REVEAL_TYPE_OPTIONS: Record<string, PlaygroundRevealType> = { Wave: "wave", Assembly: "assembly" };
const ASSEMBLY_ORDER_OPTIONS: Record<string, PlaygroundAssemblyRevealOrder> = {
  "Center → out": "center",
  "Edges → in": "edges",
  "Sweep L → R": "sweep",
  Random: "random",
};
const DEBUG_STAGE_OPTIONS: Record<string, PlaygroundDebugStage> = {
  Normal: "normal",
  Source: "source",
  Field: "processed",
};

export type PlaygroundCanvasLevaSnapshot = {
  selectedTextureId: PlaygroundTextureId;
  textureOptions: Record<string, PlaygroundTextureId>;
  displayWidth: number;
  displayHeight: number;
  workflowDisabled: boolean;
};

export type PlaygroundCanvasLevaHandlers = {
  onTextureSelect: (value: PlaygroundTextureId) => void;
  setDisplayWidth: (value: number) => void;
  setDisplayHeight: (value: number) => void;
};

export function buildPlaygroundCanvasLevaSchema(
  snapshot: PlaygroundCanvasLevaSnapshot,
  handlers: PlaygroundCanvasLevaHandlers,
): Record<string, unknown> {
  const workflowDisabled = snapshot.workflowDisabled;

  return {
    texture: selectControl(snapshot.selectedTextureId, snapshot.textureOptions, {
      label: "Texture",
      hint: PLAYGROUND_FIELD_HELP.texture,
      disabled: workflowDisabled,
      onChange: handlers.onTextureSelect,
    }),
    canvasWidth: numControl(Math.max(snapshot.displayWidth, 1), 1, PLAYGROUND_DISPLAY_MAX_PX, 1, {
      label: "Width",
      hint: PLAYGROUND_FIELD_HELP.canvasWidth,
      disabled: workflowDisabled,
      onLive: handlers.setDisplayWidth,
      onCommit: handlers.setDisplayWidth,
    }),
    canvasHeight: numControl(Math.max(snapshot.displayHeight, 1), 1, PLAYGROUND_DISPLAY_MAX_PX, 1, {
      label: "Height",
      hint: PLAYGROUND_FIELD_HELP.canvasHeight,
      disabled: workflowDisabled,
      onLive: handlers.setDisplayHeight,
      onCommit: handlers.setDisplayHeight,
    }),
  };
}

export function buildPlaygroundCanvasLevaSyncValues(snapshot: PlaygroundCanvasLevaSnapshot): Record<string, unknown> {
  return {
    texture: snapshot.selectedTextureId,
    canvasWidth: Math.max(snapshot.displayWidth, 1),
    canvasHeight: Math.max(snapshot.displayHeight, 1),
  };
}

export type PlaygroundWorkflowLevaSnapshot = {
  importText: string;
  workflowDisabled: boolean;
};

export type PlaygroundWorkflowLevaHandlers = {
  setImportText: (value: string) => void;
};

export function buildPlaygroundWorkflowLevaSchema(
  snapshot: PlaygroundWorkflowLevaSnapshot,
  handlers: PlaygroundWorkflowLevaHandlers,
): Record<string, unknown> {
  return {
    importJson: {
      value: snapshot.importText,
      label: " ",
      rows: 4 as const,
      disabled: snapshot.workflowDisabled,
      onChange: skipInitialString(handlers.setImportText),
    },
  };
}

export function buildPlaygroundWorkflowLevaSyncValues(
  snapshot: PlaygroundWorkflowLevaSnapshot,
): Record<string, unknown> {
  return {
    importJson: snapshot.importText,
  };
}

export type PlaygroundLevaSnapshot = {
  duotoneEnabled: boolean;
  duotoneControlsDisabled: boolean;
  backgroundCssActive: boolean;
  stripeControlsDisabled: boolean;
  sparkleGapsSpeedDisabled: boolean;
  sparkleWidthSpeedDisabled: boolean;
  flamesFieldsDisabled: boolean;
  edgeMaskFieldsDisabled: boolean;
  cursorTrailFieldsDisabled: boolean;
  cursorClickFieldsDisabled: boolean;
  revealFieldsDisabled: boolean;
  textureAdjustments: PlaygroundTextureAdjustments;
  sourceTransform: PlaygroundSourceTransform;
  backgroundColor: number;
  backgroundCss: string;
  gridConfig: PlaygroundGridConfig;
  stripes: readonly Stripe[];
  stripesEnabled: boolean;
  textureLuminanceSettings: TextureLuminanceSettings;
  sparkleGapsActivePercent: number;
  sparkleGapsSpeed: number;
  sparkleWidthActivePercent: number;
  sparkleWidthSpeed: number;
  flamesConfig: PlaygroundFlamesConfig;
  edgeMaskConfig: PlaygroundEdgeMaskConfig;
  cursorTrailConfig: PlaygroundCursorTrailConfig;
  clickWaveConfig: PlaygroundClickWaveConfig;
  revealConfig: PlaygroundRevealConfig;
  generalModified: boolean;
  toneModified: boolean;
  effectsModified: boolean;
  sourceModified: boolean;
  backgroundModified: boolean;
  gridModified: boolean;
  lettersModified: boolean;
  stripesModified: boolean;
  sparkleGapsModified: boolean;
  sparkleWidthModified: boolean;
  flamesModified: boolean;
  edgeMaskModified: boolean;
  cursorTrailModified: boolean;
  cursorClickModified: boolean;
  revealModified: boolean;
  debugStage: PlaygroundDebugStage;
};

export type PlaygroundLevaHandlers = {
  setDuotoneEnabled: (value: boolean) => void;
  resetGeneral: () => void;
  onAdjustmentsLive: (patch: Partial<PlaygroundTextureAdjustments>) => void;
  onAdjustmentsCommit: (patch: Partial<PlaygroundTextureAdjustments>) => void;
  resetTone: () => void;
  resetEffects: () => void;
  onSourceLive: (patch: Partial<PlaygroundSourceTransform>) => void;
  onSourceCommit: (patch: Partial<PlaygroundSourceTransform>) => void;
  resetSource: () => void;
  setBackgroundColor: (value: number) => void;
  setBackgroundCss: (value: string) => void;
  resetBackground: () => void;
  onGridLive: (patch: Partial<PlaygroundGridConfig>) => void;
  onGridCommit: (patch: Partial<PlaygroundGridConfig>) => void;
  resetGrid: () => void;
  resetLetters: () => void;
  setStripesEnabled: (value: boolean) => void;
  setTextureLuminanceSettings: (patch: Partial<TextureLuminanceSettings>) => void;
  onStripeColorChange: (id: string, hex: string) => void;
  onStripeStartFromCommit: (id: string, value: number) => void;
  onStripeWidthCommit: (id: string, value: number) => void;
  resetStripes: () => void;
  setSparkleGapsActivePercentLive: (value: number) => void;
  commitSparkleGapsActivePercent: (value: number) => void;
  setSparkleGapsSpeedLive: (value: number) => void;
  commitSparkleGapsSpeed: (value: number) => void;
  resetSparkleGaps: () => void;
  setSparkleWidthActivePercentLive: (value: number) => void;
  commitSparkleWidthActivePercent: (value: number) => void;
  setSparkleWidthSpeedLive: (value: number) => void;
  commitSparkleWidthSpeed: (value: number) => void;
  resetSparkleWidth: () => void;
  onFlamesLive: (patch: Partial<PlaygroundFlamesConfig>) => void;
  onFlamesCommit: (patch: Partial<PlaygroundFlamesConfig>) => void;
  resetFlames: () => void;
  onEdgeMaskLive: (patch: Partial<PlaygroundEdgeMaskConfig>) => void;
  onEdgeMaskCommit: (patch: Partial<PlaygroundEdgeMaskConfig>) => void;
  resetEdgeMask: () => void;
  onCursorTrailLive: (patch: Partial<PlaygroundCursorTrailConfig>) => void;
  onCursorTrailCommit: (patch: Partial<PlaygroundCursorTrailConfig>) => void;
  resetCursorTrail: () => void;
  onClickWaveLive: (patch: Partial<PlaygroundClickWaveConfig>) => void;
  onClickWaveCommit: (patch: Partial<PlaygroundClickWaveConfig>) => void;
  resetClickWave: () => void;
  onRevealLive: (patch: Partial<PlaygroundRevealConfig>) => void;
  onRevealCommit: (patch: Partial<PlaygroundRevealConfig>) => void;
  onRevealWaveLive: (patch: Partial<PlaygroundWaveRevealConfig>) => void;
  onRevealWaveCommit: (patch: Partial<PlaygroundWaveRevealConfig>) => void;
  onRevealAssemblyLive: (patch: Partial<PlaygroundAssemblyRevealConfig>) => void;
  onRevealAssemblyCommit: (patch: Partial<PlaygroundAssemblyRevealConfig>) => void;
  resetReveal: () => void;
  replayReveal: () => void;
  onDebugStageChange: (value: PlaygroundDebugStage) => void;
};

export function buildPlaygroundLevaSchema(
  snapshot: PlaygroundLevaSnapshot,
  handlers: PlaygroundLevaHandlers,
): Record<string, unknown> {
  const disabled = snapshot.duotoneControlsDisabled;
  const stripeDisabled = snapshot.stripeControlsDisabled;
  const flamesDisabled = snapshot.flamesFieldsDisabled;
  const ratio = PLAYGROUND_CONTROL_RANGES.flamesSizeRatio;
  const acrossMax = Math.max(snapshot.gridConfig.cellWidth, snapshot.gridConfig.cellHeight);
  const adjustments = snapshot.textureAdjustments;
  const source = snapshot.sourceTransform;
  const grid = snapshot.gridConfig;
  const flames = snapshot.flamesConfig;
  const edgeMask = snapshot.edgeMaskConfig;
  const edgeMaskDisabled = snapshot.edgeMaskFieldsDisabled;
  const cursorTrail = snapshot.cursorTrailConfig;
  const cursorTrailDisabled = snapshot.cursorTrailFieldsDisabled;
  const clickWave = snapshot.clickWaveConfig;
  const clickWaveDisabled = snapshot.cursorClickFieldsDisabled;
  const reveal = snapshot.revealConfig;
  const revealDisabled = snapshot.revealFieldsDisabled;
  const waveDisabled = revealDisabled || reveal.type !== "wave";
  const assemblyDisabled = revealDisabled || reveal.type !== "assembly";

  return {
    General: levaFolder(
      {
        generalReset: resetButton(() => handlers.resetGeneral(), !snapshot.generalModified),
        shaderEnabled: boolControl(snapshot.duotoneEnabled, {
          label: "Shader enabled",
          hint: PLAYGROUND_FIELD_HELP.shaderEnabled,
          onChange: handlers.setDuotoneEnabled,
        }),
      },
      { color: folderColor(snapshot.generalModified) },
    ),
    Reveal: levaFolder(
      {
        revealReset: resetButton(() => handlers.resetReveal(), !snapshot.revealModified),
        revealEnabled: boolControl(reveal.enabled, {
          label: "Reveal enabled",
          hint: PLAYGROUND_FIELD_HELP.revealEnabled,
          disabled,
          onChange: (value) => {
            handlers.onRevealLive({ enabled: value });
            handlers.onRevealCommit({ enabled: value });
          },
        }),
        Replay: actionButton(() => handlers.replayReveal(), revealDisabled),
        revealType: selectControl<PlaygroundRevealType>(reveal.type, REVEAL_TYPE_OPTIONS, {
          label: "Reveal type",
          hint: PLAYGROUND_FIELD_HELP.revealType,
          disabled: revealDisabled,
          onChange: (type) => handlers.onRevealCommit({ type }),
        }),
        ...(reveal.type === "wave"
          ? {
              revealPosition: selectControl<PlaygroundWaveRevealPosition>(reveal.wave.position, WAVE_POSITION_OPTIONS, {
                label: "Position",
                hint: PLAYGROUND_FIELD_HELP.revealPosition,
                disabled: waveDisabled,
                onChange: (position) => handlers.onRevealWaveCommit({ position }),
              }),
              revealWaveDuration: numControl(
                reveal.wave.durationMs,
                PLAYGROUND_CONTROL_RANGES.revealDurationMs.min,
                PLAYGROUND_CONTROL_RANGES.revealDurationMs.max,
                PLAYGROUND_CONTROL_RANGES.revealDurationMs.step,
                {
                  label: "Duration",
                  hint: PLAYGROUND_FIELD_HELP.revealDuration,
                  disabled: waveDisabled,
                  onLive: (value) => handlers.onRevealWaveLive({ durationMs: value }),
                  onCommit: (value) => handlers.onRevealWaveCommit({ durationMs: value }),
                },
              ),
              revealSoftness: numControl(
                reveal.wave.softness,
                PLAYGROUND_CONTROL_RANGES.revealSoftness.min,
                PLAYGROUND_CONTROL_RANGES.revealSoftness.max,
                PLAYGROUND_CONTROL_RANGES.revealSoftness.step,
                {
                  label: "Softness",
                  hint: PLAYGROUND_FIELD_HELP.revealSoftness,
                  disabled: waveDisabled,
                  onLive: (value) => handlers.onRevealWaveLive({ softness: value }),
                  onCommit: (value) => handlers.onRevealWaveCommit({ softness: value }),
                },
              ),
              revealWaviness: numControl(
                reveal.wave.waviness,
                PLAYGROUND_CONTROL_RANGES.revealWaviness.min,
                PLAYGROUND_CONTROL_RANGES.revealWaviness.max,
                PLAYGROUND_CONTROL_RANGES.revealWaviness.step,
                {
                  label: "Waviness",
                  hint: PLAYGROUND_FIELD_HELP.revealWaviness,
                  disabled: waveDisabled,
                  onLive: (value) => handlers.onRevealWaveLive({ waviness: value }),
                  onCommit: (value) => handlers.onRevealWaveCommit({ waviness: value }),
                },
              ),
              revealNoiseScale: numControl(
                reveal.wave.noiseScale,
                PLAYGROUND_CONTROL_RANGES.revealNoiseScale.min,
                PLAYGROUND_CONTROL_RANGES.revealNoiseScale.max,
                PLAYGROUND_CONTROL_RANGES.revealNoiseScale.step,
                {
                  label: "Noise scale",
                  hint: PLAYGROUND_FIELD_HELP.revealNoiseScale,
                  disabled: waveDisabled,
                  onLive: (value) => handlers.onRevealWaveLive({ noiseScale: value }),
                  onCommit: (value) => handlers.onRevealWaveCommit({ noiseScale: value }),
                },
              ),
            }
          : {
              revealAssemblyOrder: selectControl<PlaygroundAssemblyRevealOrder>(
                reveal.assembly.order,
                ASSEMBLY_ORDER_OPTIONS,
                {
                  label: "Order",
                  hint: PLAYGROUND_FIELD_HELP.revealAssemblyOrder,
                  disabled: assemblyDisabled,
                  onChange: (order) => handlers.onRevealAssemblyCommit({ order }),
                },
              ),
              revealAssemblyDuration: numControl(
                reveal.assembly.durationMs,
                PLAYGROUND_CONTROL_RANGES.revealDurationMs.min,
                PLAYGROUND_CONTROL_RANGES.revealDurationMs.max,
                PLAYGROUND_CONTROL_RANGES.revealDurationMs.step,
                {
                  label: "Duration (ms)",
                  hint: PLAYGROUND_FIELD_HELP.revealDuration,
                  disabled: assemblyDisabled,
                  onLive: (value) => handlers.onRevealAssemblyLive({ durationMs: value }),
                  onCommit: (value) => handlers.onRevealAssemblyCommit({ durationMs: value }),
                },
              ),
              revealAssemblySpread: numControl(
                reveal.assembly.spread,
                PLAYGROUND_CONTROL_RANGES.revealSpread.min,
                PLAYGROUND_CONTROL_RANGES.revealSpread.max,
                PLAYGROUND_CONTROL_RANGES.revealSpread.step,
                {
                  label: "Stagger spread",
                  hint: PLAYGROUND_FIELD_HELP.revealSpread,
                  disabled: assemblyDisabled,
                  onLive: (value) => handlers.onRevealAssemblyLive({ spread: value }),
                  onCommit: (value) => handlers.onRevealAssemblyCommit({ spread: value }),
                },
              ),
              revealAssemblySpeedMin: numControl(
                reveal.assembly.speedMinMs,
                PLAYGROUND_CONTROL_RANGES.revealSpeedMs.min,
                PLAYGROUND_CONTROL_RANGES.revealSpeedMs.max,
                PLAYGROUND_CONTROL_RANGES.revealSpeedMs.step,
                {
                  label: "Speed min (ms)",
                  hint: PLAYGROUND_FIELD_HELP.revealSpeedMin,
                  disabled: assemblyDisabled,
                  onLive: (value) => handlers.onRevealAssemblyLive({ speedMinMs: value }),
                  onCommit: (value) => handlers.onRevealAssemblyCommit({ speedMinMs: value }),
                },
              ),
              revealAssemblySpeedMax: numControl(
                reveal.assembly.speedMaxMs,
                PLAYGROUND_CONTROL_RANGES.revealSpeedMs.min,
                PLAYGROUND_CONTROL_RANGES.revealSpeedMs.max,
                PLAYGROUND_CONTROL_RANGES.revealSpeedMs.step,
                {
                  label: "Speed max (ms)",
                  hint: PLAYGROUND_FIELD_HELP.revealSpeedMax,
                  disabled: assemblyDisabled,
                  onLive: (value) => handlers.onRevealAssemblyLive({ speedMaxMs: value }),
                  onCommit: (value) => handlers.onRevealAssemblyCommit({ speedMaxMs: value }),
                },
              ),
            }),
      },
      { color: folderColor(snapshot.revealModified) },
    ),
    "Texture Tone": levaFolder(
      {
        textureToneReset: resetButton(() => handlers.resetTone(), !snapshot.toneModified),
        exposure: numControl(adjustments.exposure, -2, 2, 0.05, {
          label: "Exposure",
          hint: PLAYGROUND_FIELD_HELP.exposure,
          disabled,
          onLive: (value) => handlers.onAdjustmentsLive({ exposure: value }),
          onCommit: (value) => handlers.onAdjustmentsCommit({ exposure: value }),
        }),
        brightness: numControl(adjustments.brightness, -0.5, 0.5, 0.01, {
          label: "Brightness",
          hint: PLAYGROUND_FIELD_HELP.brightness,
          disabled,
          onLive: (value) => handlers.onAdjustmentsLive({ brightness: value }),
          onCommit: (value) => handlers.onAdjustmentsCommit({ brightness: value }),
        }),
        contrast: numControl(adjustments.contrast, 0, 2, 0.01, {
          label: "Contrast",
          hint: PLAYGROUND_FIELD_HELP.contrast,
          disabled,
          onLive: (value) => handlers.onAdjustmentsLive({ contrast: value }),
          onCommit: (value) => handlers.onAdjustmentsCommit({ contrast: value }),
        }),
        gamma: numControl(adjustments.gamma, 0.05, 5, 0.05, {
          label: "Gamma",
          hint: PLAYGROUND_FIELD_HELP.gamma,
          disabled,
          onLive: (value) => handlers.onAdjustmentsLive({ gamma: value }),
          onCommit: (value) => handlers.onAdjustmentsCommit({ gamma: value }),
        }),
        invert: boolControl(adjustments.invert, {
          label: "Invert luminance",
          hint: PLAYGROUND_FIELD_HELP.invertLuminance,
          disabled,
          onChange: (value) => {
            handlers.onAdjustmentsLive({ invert: value });
            handlers.onAdjustmentsCommit({ invert: value });
          },
        }),
      },
      { color: folderColor(snapshot.toneModified) },
    ),
    "Texture Levels": levaFolder(
      {
        textureLevelsReset: resetButton(() => handlers.resetEffects(), !snapshot.effectsModified),
        blackPoint: numControl(adjustments.blackPoint, 0, 1, 0.01, {
          label: "Black point",
          hint: PLAYGROUND_FIELD_HELP.blackPoint,
          disabled,
          onLive: (value) => handlers.onAdjustmentsLive({ blackPoint: value }),
          onCommit: (value) => handlers.onAdjustmentsCommit({ blackPoint: value }),
        }),
        whitePoint: numControl(adjustments.whitePoint, 0, 1, 0.01, {
          label: "White point",
          hint: PLAYGROUND_FIELD_HELP.whitePoint,
          disabled,
          onLive: (value) => handlers.onAdjustmentsLive({ whitePoint: value }),
          onCommit: (value) => handlers.onAdjustmentsCommit({ whitePoint: value }),
        }),
        thresholdBias: numControl(adjustments.thresholdBias, -0.5, 0.5, 0.01, {
          label: "Threshold bias",
          hint: PLAYGROUND_FIELD_HELP.thresholdBias,
          disabled,
          onLive: (value) => handlers.onAdjustmentsLive({ thresholdBias: value }),
          onCommit: (value) => handlers.onAdjustmentsCommit({ thresholdBias: value }),
        }),
        posterizeLevels: numControl(adjustments.posterizeLevels, 0, 16, 1, {
          label: "Posterize",
          hint: PLAYGROUND_FIELD_HELP.posterize,
          disabled,
          onLive: (value) => handlers.onAdjustmentsLive({ posterizeLevels: value }),
          onCommit: (value) => handlers.onAdjustmentsCommit({ posterizeLevels: value }),
        }),
        noiseAmount: numControl(adjustments.noiseAmount, 0, 0.5, 0.01, {
          label: "Noise",
          hint: PLAYGROUND_FIELD_HELP.noise,
          disabled,
          onLive: (value) => handlers.onAdjustmentsLive({ noiseAmount: value }),
          onCommit: (value) => handlers.onAdjustmentsCommit({ noiseAmount: value }),
        }),
        blurRadius: numControl(adjustments.blurRadius, 0, 4, 1, {
          label: "Blur",
          hint: PLAYGROUND_FIELD_HELP.blur,
          disabled,
          onLive: (value) => handlers.onAdjustmentsLive({ blurRadius: value }),
          onCommit: (value) => handlers.onAdjustmentsCommit({ blurRadius: value }),
        }),
        sharpenAmount: numControl(adjustments.sharpenAmount, 0, 4, 0.1, {
          label: "Sharpen",
          hint: PLAYGROUND_FIELD_HELP.sharpen,
          disabled,
          onLive: (value) => handlers.onAdjustmentsLive({ sharpenAmount: value }),
          onCommit: (value) => handlers.onAdjustmentsCommit({ sharpenAmount: value }),
        }),
      },
      { color: folderColor(snapshot.effectsModified) },
    ),
    "Texture Source": levaFolder(
      {
        textureSourceReset: resetButton(() => handlers.resetSource(), !snapshot.sourceModified),
        fit: selectControl<PlaygroundSourceFit>(
          source.fit,
          { Stretch: "stretch", Cover: "cover", Contain: "contain" },
          {
            label: "Fit",
            hint: PLAYGROUND_FIELD_HELP.fit,
            disabled,
            onChange: (value) => {
              handlers.onSourceLive({ fit: value });
              handlers.onSourceCommit({ fit: value });
            },
          },
        ),
        zoom: numControl(source.zoom, 0.5, 4, 0.01, {
          label: "Zoom",
          hint: PLAYGROUND_FIELD_HELP.zoom,
          disabled,
          onLive: (value) => handlers.onSourceLive({ zoom: value }),
          onCommit: (value) => handlers.onSourceCommit({ zoom: value }),
        }),
        panX: numControl(source.panX, -1, 1, 0.01, {
          label: "Pan X",
          hint: PLAYGROUND_FIELD_HELP.panX,
          disabled,
          onLive: (value) => handlers.onSourceLive({ panX: value }),
          onCommit: (value) => handlers.onSourceCommit({ panX: value }),
        }),
        panY: numControl(source.panY, -1, 1, 0.01, {
          label: "Pan Y",
          hint: PLAYGROUND_FIELD_HELP.panY,
          disabled,
          onLive: (value) => handlers.onSourceLive({ panY: value }),
          onCommit: (value) => handlers.onSourceCommit({ panY: value }),
        }),
      },
      { color: folderColor(snapshot.sourceModified) },
    ),
    Background: levaFolder(
      {
        backgroundReset: resetButton(() => handlers.resetBackground(), !snapshot.backgroundModified),
        backgroundColor: {
          value: intToHex(snapshot.backgroundColor),
          label: "Color",
          hint: PLAYGROUND_FIELD_HELP.backgroundColor,
          disabled: snapshot.backgroundCssActive,
          onChange: skipInitialString((hex) => handlers.setBackgroundColor(hexToInt(hex))),
        },
        backgroundCss: {
          value: snapshot.backgroundCss,
          rows: 5,
          label: "Canvas CSS",
          hint: PLAYGROUND_FIELD_HELP.canvasCss,
          onChange: skipInitialString(handlers.setBackgroundCss),
        },
      },
      { color: folderColor(snapshot.backgroundModified) },
    ),
    Grid: levaFolder(
      {
        gridReset: resetButton(() => handlers.resetGrid(), !snapshot.gridModified),
        cellWidth: numControl(grid.cellWidth, 1, 24, 1, {
          label: "Cell width",
          hint: PLAYGROUND_FIELD_HELP.cellWidth,
          disabled,
          onLive: (value) => handlers.onGridLive({ cellWidth: value }),
          onCommit: (value) => handlers.onGridCommit({ cellWidth: value }),
        }),
        cellHeight: numControl(grid.cellHeight, 1, 24, 1, {
          label: "Cell height",
          hint: PLAYGROUND_FIELD_HELP.cellHeight,
          disabled,
          onLive: (value) => handlers.onGridLive({ cellHeight: value }),
          onCommit: (value) => handlers.onGridCommit({ cellHeight: value }),
        }),
        gapX: numControl(grid.gapX, 0, grid.cellWidth, 0.5, {
          label: "Gap X",
          hint: PLAYGROUND_FIELD_HELP.gapX,
          disabled,
          onLive: (value) => handlers.onGridLive({ gapX: value }),
          onCommit: (value) => handlers.onGridCommit({ gapX: value }),
        }),
        gapY: numControl(grid.gapY, 0, grid.cellHeight, 0.5, {
          label: "Gap Y",
          hint: PLAYGROUND_FIELD_HELP.gapY,
          disabled,
          onLive: (value) => handlers.onGridLive({ gapY: value }),
          onCommit: (value) => handlers.onGridCommit({ gapY: value }),
        }),
        cornerRadius: numControl(grid.cornerRadius, 0, acrossMax / 2, 0.5, {
          label: "Corner radius",
          hint: PLAYGROUND_FIELD_HELP.cornerRadius,
          disabled,
          onLive: (value) => handlers.onGridLive({ cornerRadius: value }),
          onCommit: (value) => handlers.onGridCommit({ cornerRadius: value }),
        }),
        orientation: selectControl(
          grid.orientation,
          { Vertical: "vertical", Horizontal: "horizontal" },
          {
            label: "Orientation",
            hint: PLAYGROUND_FIELD_HELP.orientation,
            disabled,
            onChange: (value) => {
              handlers.onGridLive({ orientation: value });
              handlers.onGridCommit({ orientation: value });
            },
          },
        ),
      },
      { color: folderColor(snapshot.gridModified) },
    ),
    Letters: levaFolder(
      {
        lettersReset: resetButton(() => handlers.resetLetters(), !snapshot.lettersModified),
        letterSize: numControl(grid.letterSize, 2, 24, 1, {
          label: "Size",
          hint: PLAYGROUND_FIELD_HELP.letterSize,
          disabled,
          onLive: (value) => handlers.onGridLive({ letterSize: value }),
          onCommit: (value) => handlers.onGridCommit({ letterSize: value }),
        }),
        letterRatio: numControl(grid.letterRatio, 0, 1, 0.01, {
          label: "Ratio",
          hint: PLAYGROUND_FIELD_HELP.letterRatio,
          disabled,
          onLive: (value) => handlers.onGridLive({ letterRatio: value }),
          onCommit: (value) => handlers.onGridCommit({ letterRatio: value }),
        }),
        letterCharset: {
          value: grid.letterCharset,
          label: "Charset",
          hint: PLAYGROUND_FIELD_HELP.letterCharset,
          disabled,
          onChange: skipInitialString((value) => {
            handlers.onGridLive({ letterCharset: value });
            handlers.onGridCommit({ letterCharset: value });
          }),
        },
        letterColor: {
          value: intToHex(grid.letterColor),
          label: "Color",
          hint: PLAYGROUND_FIELD_HELP.letterColor,
          disabled,
          onChange: skipInitialString((hex) => {
            const value = hexToInt(hex);
            handlers.onGridLive({ letterColor: value });
            handlers.onGridCommit({ letterColor: value });
          }),
        },
        letterShuffleSpeed: numControl(grid.letterShuffleSpeed, 0.25, 4, 0.05, {
          label: "Shuffle speed",
          hint: PLAYGROUND_FIELD_HELP.letterShuffleSpeed,
          disabled,
          onLive: (value) => handlers.onGridLive({ letterShuffleSpeed: value }),
          onCommit: (value) => handlers.onGridCommit({ letterShuffleSpeed: value }),
        }),
      },
      { color: folderColor(snapshot.lettersModified) },
    ),
    Stripes: levaFolder(
      {
        stripesReset: resetButton(() => handlers.resetStripes(), !snapshot.stripesModified),
        stripesEnabled: boolControl(snapshot.stripesEnabled, {
          label: "Stripes enabled",
          hint: PLAYGROUND_FIELD_HELP.stripesEnabled,
          disabled,
          onChange: handlers.setStripesEnabled,
        }),
        textureLuminanceMode: selectControl<TextureLuminanceMode>(
          snapshot.textureLuminanceSettings.mode,
          { Luminance: "luminance", Overlay: "overlay", Colors: "colors" },
          {
            label: "Luminance handling",
            hint: PLAYGROUND_FIELD_HELP.textureLuminanceMode,
            disabled: stripeDisabled,
            onChange: (mode) => handlers.setTextureLuminanceSettings({ mode }),
          },
        ),
        ...(snapshot.textureLuminanceSettings.mode === "luminance" ||
        snapshot.textureLuminanceSettings.mode === "overlay"
          ? {
              stripeColorsTable: stripeColorsTablePlugin({
                value: stripeSyncKey(snapshot.stripes),
              }),
            }
          : {}),
        gridUpdateIntervalMs: numControl(grid.gridUpdateIntervalMs, 0, 300, 1, {
          label: "Processing interval",
          hint: PLAYGROUND_FIELD_HELP.processingInterval,
          disabled: stripeDisabled,
          onLive: (value) => handlers.onGridLive({ gridUpdateIntervalMs: value }),
          onCommit: (value) => handlers.onGridCommit({ gridUpdateIntervalMs: value }),
        }),
      },
      { color: folderColor(snapshot.stripesModified) },
    ),
    "Sparkle Gaps": levaFolder(
      {
        sparkleGapsReset: resetButton(() => handlers.resetSparkleGaps(), !snapshot.sparkleGapsModified),
        sparkleGapsActivePercent: numControl(
          snapshot.sparkleGapsActivePercent,
          PLAYGROUND_CONTROL_RANGES.sparkleGapsActivePercent.min,
          PLAYGROUND_CONTROL_RANGES.sparkleGapsActivePercent.max,
          PLAYGROUND_CONTROL_RANGES.sparkleGapsActivePercent.step,
          {
            label: "Active ratio",
            hint: PLAYGROUND_FIELD_HELP.sparkleGapsActiveRatio,
            disabled,
            onLive: handlers.setSparkleGapsActivePercentLive,
            onCommit: handlers.commitSparkleGapsActivePercent,
          },
        ),
        sparkleGapsSpeed: numControl(
          snapshot.sparkleGapsSpeed,
          PLAYGROUND_CONTROL_RANGES.sparkleGapsSpeed.min,
          PLAYGROUND_CONTROL_RANGES.sparkleGapsSpeed.max,
          PLAYGROUND_CONTROL_RANGES.sparkleGapsSpeed.step,
          {
            label: "Speed",
            hint: PLAYGROUND_FIELD_HELP.sparkleGapsSpeed,
            disabled: disabled || snapshot.sparkleGapsSpeedDisabled,
            onLive: handlers.setSparkleGapsSpeedLive,
            onCommit: handlers.commitSparkleGapsSpeed,
          },
        ),
        sparkleGapsPeriodMinSec: numControl(grid.sparkleGapsPeriodMinSec, 0.05, 2, 0.01, {
          label: "Gap period min",
          hint: PLAYGROUND_FIELD_HELP.gapPeriodMin,
          disabled,
          onLive: (value) => handlers.onGridLive({ sparkleGapsPeriodMinSec: value }),
          onCommit: (value) => handlers.onGridCommit({ sparkleGapsPeriodMinSec: value }),
        }),
        sparkleGapsPeriodMaxSec: numControl(grid.sparkleGapsPeriodMaxSec, 0.05, 2, 0.01, {
          label: "Gap period max",
          hint: PLAYGROUND_FIELD_HELP.gapPeriodMax,
          disabled,
          onLive: (value) => handlers.onGridLive({ sparkleGapsPeriodMaxSec: value }),
          onCommit: (value) => handlers.onGridCommit({ sparkleGapsPeriodMaxSec: value }),
        }),
      },
      { color: folderColor(snapshot.sparkleGapsModified) },
    ),
    "Sparkle Width": levaFolder(
      {
        sparkleWidthReset: resetButton(() => handlers.resetSparkleWidth(), !snapshot.sparkleWidthModified),
        sparkleWidthActivePercent: numControl(
          snapshot.sparkleWidthActivePercent,
          PLAYGROUND_CONTROL_RANGES.sparkleWidthActivePercent.min,
          PLAYGROUND_CONTROL_RANGES.sparkleWidthActivePercent.max,
          PLAYGROUND_CONTROL_RANGES.sparkleWidthActivePercent.step,
          {
            label: "Active ratio",
            hint: PLAYGROUND_FIELD_HELP.sparkleWidthActiveRatio,
            disabled,
            onLive: handlers.setSparkleWidthActivePercentLive,
            onCommit: handlers.commitSparkleWidthActivePercent,
          },
        ),
        sparkleWidthSpeed: numControl(
          snapshot.sparkleWidthSpeed,
          PLAYGROUND_CONTROL_RANGES.sparkleWidthSpeed.min,
          PLAYGROUND_CONTROL_RANGES.sparkleWidthSpeed.max,
          PLAYGROUND_CONTROL_RANGES.sparkleWidthSpeed.step,
          {
            label: "Speed",
            hint: PLAYGROUND_FIELD_HELP.sparkleWidthSpeed,
            disabled: disabled || snapshot.sparkleWidthSpeedDisabled,
            onLive: handlers.setSparkleWidthSpeedLive,
            onCommit: handlers.commitSparkleWidthSpeed,
          },
        ),
        widthShuffleSwing: numControl(grid.widthShuffleSwing, 0, 8, 0.05, {
          label: "Width swing",
          hint: PLAYGROUND_FIELD_HELP.widthSwing,
          disabled,
          onLive: (value) => handlers.onGridLive({ widthShuffleSwing: value }),
          onCommit: (value) => handlers.onGridCommit({ widthShuffleSwing: value }),
        }),
        sparkleWidthPeriodMinSec: numControl(grid.sparkleWidthPeriodMinSec, 0.05, 2, 0.01, {
          label: "Width period min",
          hint: PLAYGROUND_FIELD_HELP.widthPeriodMin,
          disabled,
          onLive: (value) => handlers.onGridLive({ sparkleWidthPeriodMinSec: value }),
          onCommit: (value) => handlers.onGridCommit({ sparkleWidthPeriodMinSec: value }),
        }),
        sparkleWidthPeriodMaxSec: numControl(grid.sparkleWidthPeriodMaxSec, 0.05, 2, 0.01, {
          label: "Width period max",
          hint: PLAYGROUND_FIELD_HELP.widthPeriodMax,
          disabled,
          onLive: (value) => handlers.onGridLive({ sparkleWidthPeriodMaxSec: value }),
          onCommit: (value) => handlers.onGridCommit({ sparkleWidthPeriodMaxSec: value }),
        }),
      },
      { color: folderColor(snapshot.sparkleWidthModified) },
    ),
    "Background Flames": levaFolder(
      {
        backgroundFlamesReset: resetButton(() => handlers.resetFlames(), !snapshot.flamesModified),
        flamesEnabled: boolControl(flames.enabled, {
          label: "Enabled",
          hint: PLAYGROUND_FIELD_HELP.flamesEnabled,
          disabled,
          onChange: (value) => {
            handlers.onFlamesLive({ enabled: value });
            handlers.onFlamesCommit({ enabled: value });
          },
        }),
        direction: selectControl<PlaygroundFlamesDirection>(
          flames.direction,
          { Up: "up", Down: "down", Left: "left", Right: "right" },
          {
            label: "Direction",
            hint: PLAYGROUND_FIELD_HELP.flamesDirection,
            disabled: flamesDisabled,
            onChange: (value) => {
              handlers.onFlamesLive({ direction: value });
              handlers.onFlamesCommit({ direction: value });
            },
          },
        ),
        minWidthRatio: numControl(flames.minWidthRatio * 100, ratio.min * 100, ratio.max * 100, ratio.step * 100, {
          label: "Width min",
          hint: PLAYGROUND_FIELD_HELP.flamesWidthMin,
          disabled: flamesDisabled,
          onLive: (value) => handlers.onFlamesLive({ minWidthRatio: value / 100 }),
          onCommit: (value) => handlers.onFlamesCommit({ minWidthRatio: value / 100 }),
        }),
        maxWidthRatio: numControl(flames.maxWidthRatio * 100, ratio.min * 100, ratio.max * 100, ratio.step * 100, {
          label: "Width max",
          hint: PLAYGROUND_FIELD_HELP.flamesWidthMax,
          disabled: flamesDisabled,
          onLive: (value) => handlers.onFlamesLive({ maxWidthRatio: value / 100 }),
          onCommit: (value) => handlers.onFlamesCommit({ maxWidthRatio: value / 100 }),
        }),
        minHeightRatio: numControl(flames.minHeightRatio * 100, ratio.min * 100, ratio.max * 100, ratio.step * 100, {
          label: "Height min",
          hint: PLAYGROUND_FIELD_HELP.flamesHeightMin,
          disabled: flamesDisabled,
          onLive: (value) => handlers.onFlamesLive({ minHeightRatio: value / 100 }),
          onCommit: (value) => handlers.onFlamesCommit({ minHeightRatio: value / 100 }),
        }),
        maxHeightRatio: numControl(flames.maxHeightRatio * 100, ratio.min * 100, ratio.max * 100, ratio.step * 100, {
          label: "Height max",
          hint: PLAYGROUND_FIELD_HELP.flamesHeightMax,
          disabled: flamesDisabled,
          onLive: (value) => handlers.onFlamesLive({ maxHeightRatio: value / 100 }),
          onCommit: (value) => handlers.onFlamesCommit({ maxHeightRatio: value / 100 }),
        }),
        baseSpeedPxPerSec: numControl(
          flames.baseSpeedPxPerSec,
          PLAYGROUND_CONTROL_RANGES.flamesSpeed.min,
          PLAYGROUND_CONTROL_RANGES.flamesSpeed.max,
          PLAYGROUND_CONTROL_RANGES.flamesSpeed.step,
          {
            label: "Speed",
            hint: PLAYGROUND_FIELD_HELP.flamesSpeed,
            disabled: flamesDisabled,
            onLive: (value) => handlers.onFlamesLive({ baseSpeedPxPerSec: value }),
            onCommit: (value) => handlers.onFlamesCommit({ baseSpeedPxPerSec: value }),
          },
        ),
        speedVariation: numControl(
          flames.speedVariation,
          PLAYGROUND_CONTROL_RANGES.flamesSpeedVariation.min,
          PLAYGROUND_CONTROL_RANGES.flamesSpeedVariation.max,
          PLAYGROUND_CONTROL_RANGES.flamesSpeedVariation.step,
          {
            label: "Speed variation",
            hint: PLAYGROUND_FIELD_HELP.flamesSpeedVariation,
            disabled: flamesDisabled,
            onLive: (value) => handlers.onFlamesLive({ speedVariation: value }),
            onCommit: (value) => handlers.onFlamesCommit({ speedVariation: value }),
          },
        ),
        spawnIntervalMs: numControl(
          flames.spawnIntervalMs,
          PLAYGROUND_CONTROL_RANGES.flamesSpawnIntervalMs.min,
          PLAYGROUND_CONTROL_RANGES.flamesSpawnIntervalMs.max,
          PLAYGROUND_CONTROL_RANGES.flamesSpawnIntervalMs.step,
          {
            label: "Spawn interval",
            hint: PLAYGROUND_FIELD_HELP.flamesSpawnInterval,
            disabled: flamesDisabled,
            onLive: (value) => handlers.onFlamesLive({ spawnIntervalMs: value }),
            onCommit: (value) => handlers.onFlamesCommit({ spawnIntervalMs: value }),
          },
        ),
        spawnJitterMs: numControl(
          flames.spawnJitterMs,
          PLAYGROUND_CONTROL_RANGES.flamesSpawnJitterMs.min,
          PLAYGROUND_CONTROL_RANGES.flamesSpawnJitterMs.max,
          PLAYGROUND_CONTROL_RANGES.flamesSpawnJitterMs.step,
          {
            label: "Spawn jitter",
            hint: PLAYGROUND_FIELD_HELP.flamesSpawnJitter,
            disabled: flamesDisabled,
            onLive: (value) => handlers.onFlamesLive({ spawnJitterMs: value }),
            onCommit: (value) => handlers.onFlamesCommit({ spawnJitterMs: value }),
          },
        ),
        maxActive: numControl(
          flames.maxActive,
          PLAYGROUND_CONTROL_RANGES.flamesMaxActive.min,
          PLAYGROUND_CONTROL_RANGES.flamesMaxActive.max,
          PLAYGROUND_CONTROL_RANGES.flamesMaxActive.step,
          {
            label: "Max active",
            hint: PLAYGROUND_FIELD_HELP.flamesMaxActive,
            disabled: flamesDisabled,
            onLive: (value) => handlers.onFlamesLive({ maxActive: value }),
            onCommit: (value) => handlers.onFlamesCommit({ maxActive: value }),
          },
        ),
        edgeSharpness: numControl(
          flames.edgeSharpness,
          PLAYGROUND_CONTROL_RANGES.flamesEdgeSharpness.min,
          PLAYGROUND_CONTROL_RANGES.flamesEdgeSharpness.max,
          PLAYGROUND_CONTROL_RANGES.flamesEdgeSharpness.step,
          {
            label: "Edge sharpness",
            hint: PLAYGROUND_FIELD_HELP.flamesEdgeSharpness,
            disabled: flamesDisabled,
            onLive: (value) => handlers.onFlamesLive({ edgeSharpness: value }),
            onCommit: (value) => handlers.onFlamesCommit({ edgeSharpness: value }),
          },
        ),
        opacityMin: numControl(
          flames.opacityMin,
          PLAYGROUND_CONTROL_RANGES.flamesOpacity.min,
          PLAYGROUND_CONTROL_RANGES.flamesOpacity.max,
          PLAYGROUND_CONTROL_RANGES.flamesOpacity.step,
          {
            label: "Opacity min",
            hint: PLAYGROUND_FIELD_HELP.flamesOpacityMin,
            disabled: flamesDisabled,
            onLive: (value) => handlers.onFlamesLive({ opacityMin: value }),
            onCommit: (value) => handlers.onFlamesCommit({ opacityMin: value }),
          },
        ),
        opacityMax: numControl(
          flames.opacityMax,
          PLAYGROUND_CONTROL_RANGES.flamesOpacity.min,
          PLAYGROUND_CONTROL_RANGES.flamesOpacity.max,
          PLAYGROUND_CONTROL_RANGES.flamesOpacity.step,
          {
            label: "Opacity max",
            hint: PLAYGROUND_FIELD_HELP.flamesOpacityMax,
            disabled: flamesDisabled,
            onLive: (value) => handlers.onFlamesLive({ opacityMax: value }),
            onCommit: (value) => handlers.onFlamesCommit({ opacityMax: value }),
          },
        ),
      },
      { color: folderColor(snapshot.flamesModified) },
    ),
    "Edge Mask": levaFolder(
      {
        edgeMaskReset: resetButton(() => handlers.resetEdgeMask(), !snapshot.edgeMaskModified),
        edgeMaskEnabled: boolControl(edgeMask.enabled, {
          label: "Enabled",
          hint: PLAYGROUND_FIELD_HELP.edgeMaskEnabled,
          disabled,
          onChange: (value) => {
            handlers.onEdgeMaskLive({ enabled: value });
            handlers.onEdgeMaskCommit({ enabled: value });
          },
        }),
        edgeMaskStart: numControl(
          edgeMask.start * 100,
          PLAYGROUND_CONTROL_RANGES.edgeMaskInset.min,
          PLAYGROUND_CONTROL_RANGES.edgeMaskInset.max,
          PLAYGROUND_CONTROL_RANGES.edgeMaskInset.step,
          {
            label: "Mask start",
            hint: PLAYGROUND_FIELD_HELP.edgeMaskStart,
            disabled: edgeMaskDisabled,
            onLive: (value) => handlers.onEdgeMaskLive({ start: value / 100 }),
            onCommit: (value) => handlers.onEdgeMaskCommit({ start: value / 100 }),
          },
        ),
        edgeMaskEnd: numControl(
          edgeMask.end * 100,
          PLAYGROUND_CONTROL_RANGES.edgeMaskInset.min,
          PLAYGROUND_CONTROL_RANGES.edgeMaskInset.max,
          PLAYGROUND_CONTROL_RANGES.edgeMaskInset.step,
          {
            label: "Mask end",
            hint: PLAYGROUND_FIELD_HELP.edgeMaskEnd,
            disabled: edgeMaskDisabled,
            onLive: (value) => handlers.onEdgeMaskLive({ end: value / 100 }),
            onCommit: (value) => handlers.onEdgeMaskCommit({ end: value / 100 }),
          },
        ),
        edgeMaskPower: numControl(
          edgeMask.power,
          PLAYGROUND_CONTROL_RANGES.edgeMaskPower.min,
          PLAYGROUND_CONTROL_RANGES.edgeMaskPower.max,
          PLAYGROUND_CONTROL_RANGES.edgeMaskPower.step,
          {
            label: "Mask power",
            hint: PLAYGROUND_FIELD_HELP.edgeMaskPower,
            disabled: edgeMaskDisabled,
            onLive: (value) => handlers.onEdgeMaskLive({ power: value }),
            onCommit: (value) => handlers.onEdgeMaskCommit({ power: value }),
          },
        ),
      },
      { color: folderColor(snapshot.edgeMaskModified) },
    ),
    "Cursor Trail": levaFolder(
      {
        cursorTrailReset: resetButton(() => handlers.resetCursorTrail(), !snapshot.cursorTrailModified),
        cursorTrailEnabled: boolControl(cursorTrail.enabled, {
          label: "Enabled",
          hint: PLAYGROUND_FIELD_HELP.cursorTrailEnabled,
          disabled,
          onChange: (value) => {
            handlers.onCursorTrailLive({ enabled: value });
            handlers.onCursorTrailCommit({ enabled: value });
          },
        }),
        particleRadius: numControl(
          cursorTrail.particleRadius,
          PLAYGROUND_CONTROL_RANGES.cursorTrailParticleRadius.min,
          PLAYGROUND_CONTROL_RANGES.cursorTrailParticleRadius.max,
          PLAYGROUND_CONTROL_RANGES.cursorTrailParticleRadius.step,
          {
            label: "Radius",
            hint: PLAYGROUND_FIELD_HELP.cursorTrailParticleRadius,
            disabled: cursorTrailDisabled,
            onLive: (value) => handlers.onCursorTrailLive({ particleRadius: value }),
            onCommit: (value) => handlers.onCursorTrailCommit({ particleRadius: value }),
          },
        ),
        particleAlpha: numControl(
          cursorTrail.particleAlpha,
          PLAYGROUND_CONTROL_RANGES.cursorTrailParticleAlpha.min,
          PLAYGROUND_CONTROL_RANGES.cursorTrailParticleAlpha.max,
          PLAYGROUND_CONTROL_RANGES.cursorTrailParticleAlpha.step,
          {
            label: "Alpha",
            hint: PLAYGROUND_FIELD_HELP.cursorTrailParticleAlpha,
            disabled: cursorTrailDisabled,
            onLive: (value) => handlers.onCursorTrailLive({ particleAlpha: value }),
            onCommit: (value) => handlers.onCursorTrailCommit({ particleAlpha: value }),
          },
        ),
        particleLifeMs: numControl(
          cursorTrail.particleLifeMs,
          PLAYGROUND_CONTROL_RANGES.cursorTrailParticleLife.min,
          PLAYGROUND_CONTROL_RANGES.cursorTrailParticleLife.max,
          PLAYGROUND_CONTROL_RANGES.cursorTrailParticleLife.step,
          {
            label: "Life",
            hint: PLAYGROUND_FIELD_HELP.cursorTrailParticleLife,
            disabled: cursorTrailDisabled,
            onLive: (value) => handlers.onCursorTrailLive({ particleLifeMs: value }),
            onCommit: (value) => handlers.onCursorTrailCommit({ particleLifeMs: value }),
          },
        ),
        particleLifeJitterMs: numControl(
          cursorTrail.particleLifeJitterMs,
          PLAYGROUND_CONTROL_RANGES.cursorTrailParticleLifeJitter.min,
          PLAYGROUND_CONTROL_RANGES.cursorTrailParticleLifeJitter.max,
          PLAYGROUND_CONTROL_RANGES.cursorTrailParticleLifeJitter.step,
          {
            label: "Life jitter",
            hint: PLAYGROUND_FIELD_HELP.cursorTrailParticleLifeJitter,
            disabled: cursorTrailDisabled,
            onLive: (value) => handlers.onCursorTrailLive({ particleLifeJitterMs: value }),
            onCommit: (value) => handlers.onCursorTrailCommit({ particleLifeJitterMs: value }),
          },
        ),
        particleSpacingPx: numControl(
          cursorTrail.particleSpacingPx,
          PLAYGROUND_CONTROL_RANGES.cursorTrailSpacing.min,
          PLAYGROUND_CONTROL_RANGES.cursorTrailSpacing.max,
          PLAYGROUND_CONTROL_RANGES.cursorTrailSpacing.step,
          {
            label: "Spacing",
            hint: PLAYGROUND_FIELD_HELP.cursorTrailSpacing,
            disabled: cursorTrailDisabled,
            onLive: (value) => handlers.onCursorTrailLive({ particleSpacingPx: value }),
            onCommit: (value) => handlers.onCursorTrailCommit({ particleSpacingPx: value }),
          },
        ),
        maxEmitPerTick: numControl(
          cursorTrail.maxEmitPerTick,
          PLAYGROUND_CONTROL_RANGES.cursorTrailMaxEmit.min,
          PLAYGROUND_CONTROL_RANGES.cursorTrailMaxEmit.max,
          PLAYGROUND_CONTROL_RANGES.cursorTrailMaxEmit.step,
          {
            label: "Max emit",
            hint: PLAYGROUND_FIELD_HELP.cursorTrailMaxEmit,
            disabled: cursorTrailDisabled,
            onLive: (value) => handlers.onCursorTrailLive({ maxEmitPerTick: value }),
            onCommit: (value) => handlers.onCursorTrailCommit({ maxEmitPerTick: value }),
          },
        ),
        emitterVelocitySmoothing: numControl(
          cursorTrail.emitterVelocitySmoothing,
          PLAYGROUND_CONTROL_RANGES.cursorTrailVelocitySmoothing.min,
          PLAYGROUND_CONTROL_RANGES.cursorTrailVelocitySmoothing.max,
          PLAYGROUND_CONTROL_RANGES.cursorTrailVelocitySmoothing.step,
          {
            label: "Velocity smoothing",
            hint: PLAYGROUND_FIELD_HELP.cursorTrailVelocitySmoothing,
            disabled: cursorTrailDisabled,
            onLive: (value) => handlers.onCursorTrailLive({ emitterVelocitySmoothing: value }),
            onCommit: (value) => handlers.onCursorTrailCommit({ emitterVelocitySmoothing: value }),
          },
        ),
        particleVelocityScale: numControl(
          cursorTrail.particleVelocityScale,
          PLAYGROUND_CONTROL_RANGES.cursorTrailVelocityScale.min,
          PLAYGROUND_CONTROL_RANGES.cursorTrailVelocityScale.max,
          PLAYGROUND_CONTROL_RANGES.cursorTrailVelocityScale.step,
          {
            label: "Velocity scale",
            hint: PLAYGROUND_FIELD_HELP.cursorTrailVelocityScale,
            disabled: cursorTrailDisabled,
            onLive: (value) => handlers.onCursorTrailLive({ particleVelocityScale: value }),
            onCommit: (value) => handlers.onCursorTrailCommit({ particleVelocityScale: value }),
          },
        ),
        particleTangentVelocity: numControl(
          cursorTrail.particleTangentVelocity,
          PLAYGROUND_CONTROL_RANGES.cursorTrailTangentVelocity.min,
          PLAYGROUND_CONTROL_RANGES.cursorTrailTangentVelocity.max,
          PLAYGROUND_CONTROL_RANGES.cursorTrailTangentVelocity.step,
          {
            label: "Tangent velocity",
            hint: PLAYGROUND_FIELD_HELP.cursorTrailTangentVelocity,
            disabled: cursorTrailDisabled,
            onLive: (value) => handlers.onCursorTrailLive({ particleTangentVelocity: value }),
            onCommit: (value) => handlers.onCursorTrailCommit({ particleTangentVelocity: value }),
          },
        ),
        particleDamping: numControl(
          cursorTrail.particleDamping,
          PLAYGROUND_CONTROL_RANGES.cursorTrailDamping.min,
          PLAYGROUND_CONTROL_RANGES.cursorTrailDamping.max,
          PLAYGROUND_CONTROL_RANGES.cursorTrailDamping.step,
          {
            label: "Damping",
            hint: PLAYGROUND_FIELD_HELP.cursorTrailDamping,
            disabled: cursorTrailDisabled,
            onLive: (value) => handlers.onCursorTrailLive({ particleDamping: value }),
            onCommit: (value) => handlers.onCursorTrailCommit({ particleDamping: value }),
          },
        ),
        spreadMinPx: numControl(
          cursorTrail.spreadMinPx,
          PLAYGROUND_CONTROL_RANGES.cursorTrailSpreadMin.min,
          PLAYGROUND_CONTROL_RANGES.cursorTrailSpreadMin.max,
          PLAYGROUND_CONTROL_RANGES.cursorTrailSpreadMin.step,
          {
            label: "Spread min",
            hint: PLAYGROUND_FIELD_HELP.cursorTrailSpreadMin,
            disabled: cursorTrailDisabled,
            onLive: (value) => handlers.onCursorTrailLive({ spreadMinPx: value }),
            onCommit: (value) => handlers.onCursorTrailCommit({ spreadMinPx: value }),
          },
        ),
        spreadMaxPx: numControl(
          cursorTrail.spreadMaxPx,
          PLAYGROUND_CONTROL_RANGES.cursorTrailSpreadMax.min,
          PLAYGROUND_CONTROL_RANGES.cursorTrailSpreadMax.max,
          PLAYGROUND_CONTROL_RANGES.cursorTrailSpreadMax.step,
          {
            label: "Spread max",
            hint: PLAYGROUND_FIELD_HELP.cursorTrailSpreadMax,
            disabled: cursorTrailDisabled,
            onLive: (value) => handlers.onCursorTrailLive({ spreadMaxPx: value }),
            onCommit: (value) => handlers.onCursorTrailCommit({ spreadMaxPx: value }),
          },
        ),
        spinStrength: numControl(
          cursorTrail.spinStrength,
          PLAYGROUND_CONTROL_RANGES.cursorTrailSpin.min,
          PLAYGROUND_CONTROL_RANGES.cursorTrailSpin.max,
          PLAYGROUND_CONTROL_RANGES.cursorTrailSpin.step,
          {
            label: "Spin",
            hint: PLAYGROUND_FIELD_HELP.cursorTrailSpin,
            disabled: cursorTrailDisabled,
            onLive: (value) => handlers.onCursorTrailLive({ spinStrength: value }),
            onCommit: (value) => handlers.onCursorTrailCommit({ spinStrength: value }),
          },
        ),
        densityRadiusMinScale: numControl(
          cursorTrail.densityRadiusMinScale,
          PLAYGROUND_CONTROL_RANGES.cursorTrailDensityRadiusMin.min,
          PLAYGROUND_CONTROL_RANGES.cursorTrailDensityRadiusMin.max,
          PLAYGROUND_CONTROL_RANGES.cursorTrailDensityRadiusMin.step,
          {
            label: "Density radius min",
            hint: PLAYGROUND_FIELD_HELP.cursorTrailDensityRadiusMin,
            disabled: cursorTrailDisabled,
            onLive: (value) => handlers.onCursorTrailLive({ densityRadiusMinScale: value }),
            onCommit: (value) => handlers.onCursorTrailCommit({ densityRadiusMinScale: value }),
          },
        ),
        densityRadiusLifeScale: numControl(
          cursorTrail.densityRadiusLifeScale,
          PLAYGROUND_CONTROL_RANGES.cursorTrailDensityRadiusLife.min,
          PLAYGROUND_CONTROL_RANGES.cursorTrailDensityRadiusLife.max,
          PLAYGROUND_CONTROL_RANGES.cursorTrailDensityRadiusLife.step,
          {
            label: "Density radius life",
            hint: PLAYGROUND_FIELD_HELP.cursorTrailDensityRadiusLife,
            disabled: cursorTrailDisabled,
            onLive: (value) => handlers.onCursorTrailLive({ densityRadiusLifeScale: value }),
            onCommit: (value) => handlers.onCursorTrailCommit({ densityRadiusLifeScale: value }),
          },
        ),
        pushStrengthPx: numControl(
          cursorTrail.pushStrengthPx,
          PLAYGROUND_CONTROL_RANGES.cursorTrailPushStrength.min,
          PLAYGROUND_CONTROL_RANGES.cursorTrailPushStrength.max,
          PLAYGROUND_CONTROL_RANGES.cursorTrailPushStrength.step,
          {
            label: "Push strength",
            hint: PLAYGROUND_FIELD_HELP.cursorTrailPushStrength,
            disabled: cursorTrailDisabled,
            onLive: (value) => handlers.onCursorTrailLive({ pushStrengthPx: value }),
            onCommit: (value) => handlers.onCursorTrailCommit({ pushStrengthPx: value }),
          },
        ),
        pushRadiusScale: numControl(
          cursorTrail.pushRadiusScale,
          PLAYGROUND_CONTROL_RANGES.cursorTrailPushRadius.min,
          PLAYGROUND_CONTROL_RANGES.cursorTrailPushRadius.max,
          PLAYGROUND_CONTROL_RANGES.cursorTrailPushRadius.step,
          {
            label: "Push radius",
            hint: PLAYGROUND_FIELD_HELP.cursorTrailPushRadius,
            disabled: cursorTrailDisabled,
            onLive: (value) => handlers.onCursorTrailLive({ pushRadiusScale: value }),
            onCommit: (value) => handlers.onCursorTrailCommit({ pushRadiusScale: value }),
          },
        ),
        pushLagPx: numControl(
          cursorTrail.pushLagPx,
          PLAYGROUND_CONTROL_RANGES.cursorTrailPushLag.min,
          PLAYGROUND_CONTROL_RANGES.cursorTrailPushLag.max,
          PLAYGROUND_CONTROL_RANGES.cursorTrailPushLag.step,
          {
            label: "Push lag",
            hint: PLAYGROUND_FIELD_HELP.cursorTrailPushLag,
            disabled: cursorTrailDisabled,
            onLive: (value) => handlers.onCursorTrailLive({ pushLagPx: value }),
            onCommit: (value) => handlers.onCursorTrailCommit({ pushLagPx: value }),
          },
        ),
        pushWobblePx: numControl(
          cursorTrail.pushWobblePx,
          PLAYGROUND_CONTROL_RANGES.cursorTrailPushWobble.min,
          PLAYGROUND_CONTROL_RANGES.cursorTrailPushWobble.max,
          PLAYGROUND_CONTROL_RANGES.cursorTrailPushWobble.step,
          {
            label: "Push wobble",
            hint: PLAYGROUND_FIELD_HELP.cursorTrailPushWobble,
            disabled: cursorTrailDisabled,
            onLive: (value) => handlers.onCursorTrailLive({ pushWobblePx: value }),
            onCommit: (value) => handlers.onCursorTrailCommit({ pushWobblePx: value }),
          },
        ),
      },
      { color: folderColor(snapshot.cursorTrailModified) },
    ),
    "Cursor Click": levaFolder(
      {
        cursorClickReset: resetButton(() => handlers.resetClickWave(), !snapshot.cursorClickModified),
        cursorClickEnabled: boolControl(clickWave.enabled, {
          label: "Enabled",
          hint: PLAYGROUND_FIELD_HELP.cursorClickEnabled,
          disabled,
          onChange: (value) => {
            handlers.onClickWaveLive({ enabled: value });
            handlers.onClickWaveCommit({ enabled: value });
          },
        }),
        clickWaveLifeMs: numControl(
          clickWave.lifeMs,
          PLAYGROUND_CONTROL_RANGES.clickWaveLifeMs.min,
          PLAYGROUND_CONTROL_RANGES.clickWaveLifeMs.max,
          PLAYGROUND_CONTROL_RANGES.clickWaveLifeMs.step,
          {
            label: "Life",
            hint: PLAYGROUND_FIELD_HELP.cursorClickLife,
            disabled: clickWaveDisabled,
            onLive: (value) => handlers.onClickWaveLive({ lifeMs: value }),
            onCommit: (value) => handlers.onClickWaveCommit({ lifeMs: value }),
          },
        ),
        clickWaveStartRadius: numControl(
          clickWave.startRadiusPx,
          PLAYGROUND_CONTROL_RANGES.clickWaveStartRadius.min,
          PLAYGROUND_CONTROL_RANGES.clickWaveStartRadius.max,
          PLAYGROUND_CONTROL_RANGES.clickWaveStartRadius.step,
          {
            label: "Start radius",
            hint: PLAYGROUND_FIELD_HELP.cursorClickStartRadius,
            disabled: clickWaveDisabled,
            onLive: (value) => handlers.onClickWaveLive({ startRadiusPx: value }),
            onCommit: (value) => handlers.onClickWaveCommit({ startRadiusPx: value }),
          },
        ),
        clickWaveMaxRadius: numControl(
          clickWave.maxRadiusPx,
          PLAYGROUND_CONTROL_RANGES.clickWaveMaxRadius.min,
          PLAYGROUND_CONTROL_RANGES.clickWaveMaxRadius.max,
          PLAYGROUND_CONTROL_RANGES.clickWaveMaxRadius.step,
          {
            label: "Max radius",
            hint: PLAYGROUND_FIELD_HELP.cursorClickMaxRadius,
            disabled: clickWaveDisabled,
            onLive: (value) => handlers.onClickWaveLive({ maxRadiusPx: value }),
            onCommit: (value) => handlers.onClickWaveCommit({ maxRadiusPx: value }),
          },
        ),
        clickWaveStartStroke: numControl(
          clickWave.startStrokeWidthPx,
          PLAYGROUND_CONTROL_RANGES.clickWaveStartStroke.min,
          PLAYGROUND_CONTROL_RANGES.clickWaveStartStroke.max,
          PLAYGROUND_CONTROL_RANGES.clickWaveStartStroke.step,
          {
            label: "Start stroke",
            hint: PLAYGROUND_FIELD_HELP.cursorClickStartStroke,
            disabled: clickWaveDisabled,
            onLive: (value) => handlers.onClickWaveLive({ startStrokeWidthPx: value }),
            onCommit: (value) => handlers.onClickWaveCommit({ startStrokeWidthPx: value }),
          },
        ),
        clickWaveEndStroke: numControl(
          clickWave.endStrokeWidthPx,
          PLAYGROUND_CONTROL_RANGES.clickWaveEndStroke.min,
          PLAYGROUND_CONTROL_RANGES.clickWaveEndStroke.max,
          PLAYGROUND_CONTROL_RANGES.clickWaveEndStroke.step,
          {
            label: "End stroke",
            hint: PLAYGROUND_FIELD_HELP.cursorClickEndStroke,
            disabled: clickWaveDisabled,
            onLive: (value) => handlers.onClickWaveLive({ endStrokeWidthPx: value }),
            onCommit: (value) => handlers.onClickWaveCommit({ endStrokeWidthPx: value }),
          },
        ),
        clickWaveMaxWaves: numControl(
          clickWave.maxWaves,
          PLAYGROUND_CONTROL_RANGES.clickWaveMaxWaves.min,
          PLAYGROUND_CONTROL_RANGES.clickWaveMaxWaves.max,
          PLAYGROUND_CONTROL_RANGES.clickWaveMaxWaves.step,
          {
            label: "Max waves",
            hint: PLAYGROUND_FIELD_HELP.cursorClickMaxWaves,
            disabled: clickWaveDisabled,
            onLive: (value) => handlers.onClickWaveLive({ maxWaves: value }),
            onCommit: (value) => handlers.onClickWaveCommit({ maxWaves: value }),
          },
        ),
        clickWavePushStrength: numControl(
          clickWave.pushStrengthPx,
          PLAYGROUND_CONTROL_RANGES.clickWavePushStrength.min,
          PLAYGROUND_CONTROL_RANGES.clickWavePushStrength.max,
          PLAYGROUND_CONTROL_RANGES.clickWavePushStrength.step,
          {
            label: "Push strength",
            hint: PLAYGROUND_FIELD_HELP.cursorClickPushStrength,
            disabled: clickWaveDisabled,
            onLive: (value) => handlers.onClickWaveLive({ pushStrengthPx: value }),
            onCommit: (value) => handlers.onClickWaveCommit({ pushStrengthPx: value }),
          },
        ),
        clickWavePushBandScale: numControl(
          clickWave.pushBandScale,
          PLAYGROUND_CONTROL_RANGES.clickWavePushBandScale.min,
          PLAYGROUND_CONTROL_RANGES.clickWavePushBandScale.max,
          PLAYGROUND_CONTROL_RANGES.clickWavePushBandScale.step,
          {
            label: "Push band",
            hint: PLAYGROUND_FIELD_HELP.cursorClickPushBandScale,
            disabled: clickWaveDisabled,
            onLive: (value) => handlers.onClickWaveLive({ pushBandScale: value }),
            onCommit: (value) => handlers.onClickWaveCommit({ pushBandScale: value }),
          },
        ),
        clickWaveRingWhite: numControl(
          clickWave.stripeWhiteAlpha,
          PLAYGROUND_CONTROL_RANGES.clickWaveRingWhite.min,
          PLAYGROUND_CONTROL_RANGES.clickWaveRingWhite.max,
          PLAYGROUND_CONTROL_RANGES.clickWaveRingWhite.step,
          {
            label: "Ring white",
            hint: PLAYGROUND_FIELD_HELP.cursorClickRingWhite,
            disabled: clickWaveDisabled,
            onLive: (value) => handlers.onClickWaveLive({ stripeWhiteAlpha: value }),
            onCommit: (value) => handlers.onClickWaveCommit({ stripeWhiteAlpha: value }),
          },
        ),
      },
      { color: folderColor(snapshot.cursorClickModified) },
    ),
    Debug: levaFolder({
      debugStage: selectControl<PlaygroundDebugStage>(snapshot.debugStage, DEBUG_STAGE_OPTIONS, {
        label: "Debug view",
        hint: PLAYGROUND_FIELD_HELP.debugStage,
        onChange: (value) => handlers.onDebugStageChange(value),
      }),
    }),
  } as Record<string, unknown>;
}

function intToHexSync(value: number): string {
  return `#${(value & 0xffffff).toString(16).padStart(6, "0")}`;
}

/** Flat values for syncing external React state into the Leva store without firing onChange. */
export function buildPlaygroundLevaSyncValues(snapshot: PlaygroundLevaSnapshot): Record<string, unknown> {
  const adjustments = snapshot.textureAdjustments;
  const source = snapshot.sourceTransform;
  const grid = snapshot.gridConfig;
  const flames = snapshot.flamesConfig;
  const edgeMask = snapshot.edgeMaskConfig;
  const cursorTrail = snapshot.cursorTrailConfig;
  const clickWave = snapshot.clickWaveConfig;
  const reveal = snapshot.revealConfig;

  const values: Record<string, unknown> = {
    shaderEnabled: snapshot.duotoneEnabled,
    revealEnabled: reveal.enabled,
    exposure: adjustments.exposure,
    brightness: adjustments.brightness,
    contrast: adjustments.contrast,
    gamma: adjustments.gamma,
    invert: adjustments.invert,
    blackPoint: adjustments.blackPoint,
    whitePoint: adjustments.whitePoint,
    thresholdBias: adjustments.thresholdBias,
    posterizeLevels: adjustments.posterizeLevels,
    noiseAmount: adjustments.noiseAmount,
    blurRadius: adjustments.blurRadius,
    sharpenAmount: adjustments.sharpenAmount,
    fit: source.fit,
    zoom: source.zoom,
    panX: source.panX,
    panY: source.panY,
    backgroundColor: intToHexSync(snapshot.backgroundColor),
    backgroundCss: snapshot.backgroundCss,
    cellWidth: grid.cellWidth,
    cellHeight: grid.cellHeight,
    gapX: grid.gapX,
    gapY: grid.gapY,
    cornerRadius: grid.cornerRadius,
    orientation: grid.orientation,
    letterSize: grid.letterSize,
    letterRatio: grid.letterRatio,
    letterCharset: grid.letterCharset,
    letterColor: intToHexSync(grid.letterColor),
    letterShuffleSpeed: grid.letterShuffleSpeed,
    stripesEnabled: snapshot.stripesEnabled,
    textureLuminanceMode: snapshot.textureLuminanceSettings.mode,
    gridUpdateIntervalMs: grid.gridUpdateIntervalMs,
    sparkleGapsActivePercent: snapshot.sparkleGapsActivePercent,
    sparkleGapsSpeed: snapshot.sparkleGapsSpeed,
    sparkleGapsPeriodMinSec: grid.sparkleGapsPeriodMinSec,
    sparkleGapsPeriodMaxSec: grid.sparkleGapsPeriodMaxSec,
    sparkleWidthActivePercent: snapshot.sparkleWidthActivePercent,
    sparkleWidthSpeed: snapshot.sparkleWidthSpeed,
    widthShuffleSwing: grid.widthShuffleSwing,
    sparkleWidthPeriodMinSec: grid.sparkleWidthPeriodMinSec,
    sparkleWidthPeriodMaxSec: grid.sparkleWidthPeriodMaxSec,
    flamesEnabled: flames.enabled,
    direction: flames.direction,
    minWidthRatio: flames.minWidthRatio * 100,
    maxWidthRatio: flames.maxWidthRatio * 100,
    minHeightRatio: flames.minHeightRatio * 100,
    maxHeightRatio: flames.maxHeightRatio * 100,
    baseSpeedPxPerSec: flames.baseSpeedPxPerSec,
    speedVariation: flames.speedVariation,
    spawnIntervalMs: flames.spawnIntervalMs,
    spawnJitterMs: flames.spawnJitterMs,
    maxActive: flames.maxActive,
    edgeSharpness: flames.edgeSharpness,
    opacityMin: flames.opacityMin,
    opacityMax: flames.opacityMax,
    edgeMaskEnabled: edgeMask.enabled,
    edgeMaskStart: edgeMask.start * 100,
    edgeMaskEnd: edgeMask.end * 100,
    edgeMaskPower: edgeMask.power,
    cursorTrailEnabled: cursorTrail.enabled,
    particleRadius: cursorTrail.particleRadius,
    particleAlpha: cursorTrail.particleAlpha,
    particleLifeMs: cursorTrail.particleLifeMs,
    particleLifeJitterMs: cursorTrail.particleLifeJitterMs,
    particleSpacingPx: cursorTrail.particleSpacingPx,
    maxEmitPerTick: cursorTrail.maxEmitPerTick,
    emitterVelocitySmoothing: cursorTrail.emitterVelocitySmoothing,
    particleVelocityScale: cursorTrail.particleVelocityScale,
    particleTangentVelocity: cursorTrail.particleTangentVelocity,
    particleDamping: cursorTrail.particleDamping,
    spreadMinPx: cursorTrail.spreadMinPx,
    spreadMaxPx: cursorTrail.spreadMaxPx,
    spinStrength: cursorTrail.spinStrength,
    densityRadiusMinScale: cursorTrail.densityRadiusMinScale,
    densityRadiusLifeScale: cursorTrail.densityRadiusLifeScale,
    pushStrengthPx: cursorTrail.pushStrengthPx,
    pushRadiusScale: cursorTrail.pushRadiusScale,
    pushLagPx: cursorTrail.pushLagPx,
    pushWobblePx: cursorTrail.pushWobblePx,
    cursorClickEnabled: clickWave.enabled,
    clickWaveLifeMs: clickWave.lifeMs,
    clickWaveStartRadius: clickWave.startRadiusPx,
    clickWaveMaxRadius: clickWave.maxRadiusPx,
    clickWaveStartStroke: clickWave.startStrokeWidthPx,
    clickWaveEndStroke: clickWave.endStrokeWidthPx,
    clickWaveMaxWaves: clickWave.maxWaves,
    clickWavePushStrength: clickWave.pushStrengthPx,
    clickWavePushBandScale: clickWave.pushBandScale,
    clickWaveRingWhite: clickWave.stripeWhiteAlpha,
  };

  values.revealType = reveal.type;
  if (reveal.type === "wave") {
    values.revealPosition = reveal.wave.position;
    values.revealWaveDuration = reveal.wave.durationMs;
    values.revealSoftness = reveal.wave.softness;
    values.revealWaviness = reveal.wave.waviness;
    values.revealNoiseScale = reveal.wave.noiseScale;
  } else {
    values.revealAssemblyOrder = reveal.assembly.order;
    values.revealAssemblyDuration = reveal.assembly.durationMs;
    values.revealAssemblySpread = reveal.assembly.spread;
    values.revealAssemblySpeedMin = reveal.assembly.speedMinMs;
    values.revealAssemblySpeedMax = reveal.assembly.speedMaxMs;
  }

  if (snapshot.textureLuminanceSettings.mode === "luminance" || snapshot.textureLuminanceSettings.mode === "overlay") {
    values.stripeColorsTable = stripeSyncKey(snapshot.stripes);
  }

  values.debugStage = snapshot.debugStage;

  return values;
}
