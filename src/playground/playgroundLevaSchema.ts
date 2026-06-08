import { button, folder } from "leva";
import type { FolderSettings } from "leva/dist/declarations/src/types/public";
import { PLAYGROUND_CONTROL_RANGES } from "./playgroundControlRanges";
import { PLAYGROUND_FIELD_HELP } from "./playgroundFieldHelp";
import type { PlaygroundGridConfig } from "./playgroundGridConfig";
import type { PlaygroundFlamesConfig, PlaygroundFlamesDirection } from "./playgroundFlamesConfig";
import type {
  PlaygroundRandomColumnsRevealConfig,
  PlaygroundRevealConfig,
  PlaygroundRevealPreset,
  PlaygroundWaveRevealConfig,
  PlaygroundWaveRevealPosition,
} from "./playgroundRevealConfig";
import type { PlaygroundSourceFit, PlaygroundSourceTransform } from "./playgroundSourceTransform";
import type { PlaygroundTextureAdjustments } from "./playgroundTextureAdjustments";
import type { PlaygroundTextureId } from "./playgroundTextures";
import { PLAYGROUND_DISPLAY_MAX_PX } from "./setupTextureShaderScene";
import type { Stripe } from "./stripeColors";
import {
  STRIPE_START_FROM_MAX,
  STRIPE_START_FROM_MIN,
  STRIPE_WIDTH_MIN,
  STRIPE_WIDTH_STORAGE_MAX,
} from "./stripeColors";
import {
  normalizeTextureLuminanceBackgroundColor,
  type TextureLuminanceMode,
  type TextureLuminanceSettings,
} from "./colorWhiteness";

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
  return button(onClick, { disabled });
}

function actionButton(onClick: () => void, disabled = false) {
  return button(onClick, { disabled });
}

function readOnlyString(value: string, label: string) {
  return {
    value,
    label,
    disabled: true,
    editable: false as const,
  };
}

function readOnlyStatusValue(value: string) {
  return {
    value,
    label: " ",
    disabled: true,
    editable: false as const,
    render: () => value.length > 0,
  };
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

const REVEAL_PRESET_OPTIONS: Record<string, PlaygroundRevealPreset> = {
  Wave: "wave",
  "Random columns": "randomColumns",
};

export type PlaygroundLevaSnapshot = {
  selectedTextureId: PlaygroundTextureId;
  textureOptions: Record<string, PlaygroundTextureId>;
  displayWidth: number;
  displayHeight: number;
  importText: string;
  uploadError: string;
  importStatus: string;
  workflowDisabled: boolean;
  matchSourceDisabled: boolean;
  loadError: string;
  fallbackTextureAvailable: boolean;
  duotoneEnabled: boolean;
  duotoneControlsDisabled: boolean;
  backgroundCssActive: boolean;
  stripeControlsDisabled: boolean;
  sparkleGapsSpeedDisabled: boolean;
  sparkleWidthSpeedDisabled: boolean;
  flamesFieldsDisabled: boolean;
  flamesMaskDisabled: boolean;
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
  revealModified: boolean;
};

export type PlaygroundLevaHandlers = {
  onTextureSelect: (value: PlaygroundTextureId) => void;
  setDisplayWidth: (value: number) => void;
  setDisplayHeight: (value: number) => void;
  matchSourceDisplaySize: () => void;
  onUploadClick: () => void;
  onCopyState: () => void;
  setImportText: (value: string) => void;
  onImportState: () => void;
  loadFallbackTexture: () => void;
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
  onRevealCommit: (patch: Partial<PlaygroundRevealConfig>) => void;
  onRevealWaveLive: (patch: Partial<PlaygroundWaveRevealConfig>) => void;
  onRevealWaveCommit: (patch: Partial<PlaygroundWaveRevealConfig>) => void;
  onRevealRandomColumnsLive: (patch: Partial<PlaygroundRandomColumnsRevealConfig>) => void;
  onRevealRandomColumnsCommit: (patch: Partial<PlaygroundRandomColumnsRevealConfig>) => void;
  resetReveal: () => void;
  replayReveal: () => void;
};

export function buildPlaygroundLevaSchema(
  snapshot: PlaygroundLevaSnapshot,
  handlers: PlaygroundLevaHandlers,
): Record<string, unknown> {
  const disabled = snapshot.duotoneControlsDisabled;
  const stripeDisabled = snapshot.stripeControlsDisabled;
  const flamesDisabled = snapshot.flamesFieldsDisabled;
  const flamesMaskDisabled = snapshot.flamesMaskDisabled;
  const ratio = PLAYGROUND_CONTROL_RANGES.flamesSizeRatio;
  const acrossMax = Math.max(snapshot.gridConfig.cellWidth, snapshot.gridConfig.cellHeight);
  const adjustments = snapshot.textureAdjustments;
  const source = snapshot.sourceTransform;
  const grid = snapshot.gridConfig;
  const flames = snapshot.flamesConfig;
  const reveal = snapshot.revealConfig;

  const stripeFields: Record<string, unknown> = Object.fromEntries(
    snapshot.stripes.flatMap((stripe) => {
      const labelPrefix = stripe.id.charAt(0).toUpperCase() + stripe.id.slice(1);
      return [
        [
          `stripe_${stripe.id}_color`,
          {
            value: stripe.hex,
            label: `${labelPrefix} color`,
            hint: PLAYGROUND_FIELD_HELP.stripeColor,
            disabled: stripeDisabled,
            onChange: skipInitialString((hex) => handlers.onStripeColorChange(stripe.id, hex)),
          },
        ],
        [
          `stripe_${stripe.id}_startFrom`,
          numControl(stripe.startFrom, STRIPE_START_FROM_MIN, STRIPE_START_FROM_MAX, 0.01, {
            label: `${labelPrefix} threshold`,
            hint: PLAYGROUND_FIELD_HELP.stripeThreshold,
            disabled: stripeDisabled,
            onLive: (value) => handlers.onStripeStartFromCommit(stripe.id, value),
            onCommit: (value) => handlers.onStripeStartFromCommit(stripe.id, value),
          }),
        ],
        [
          `stripe_${stripe.id}_width`,
          numControl(stripe.width, STRIPE_WIDTH_MIN, STRIPE_WIDTH_STORAGE_MAX, 1, {
            label: `${labelPrefix} width`,
            hint: PLAYGROUND_FIELD_HELP.stripeWidth,
            disabled: stripeDisabled,
            onLive: (value) => handlers.onStripeWidthCommit(stripe.id, value),
            onCommit: (value) => handlers.onStripeWidthCommit(stripe.id, value),
          }),
        ],
      ];
    }),
  );

  const workflowDisabled = snapshot.workflowDisabled;

  return {
    Workflow: levaFolder(
      {
        ...(snapshot.loadError
          ? {
              loadError: readOnlyString(snapshot.loadError, "Load error"),
              "Load fallback texture": actionButton(
                () => handlers.loadFallbackTexture(),
                !snapshot.fallbackTextureAvailable || workflowDisabled,
              ),
            }
          : {}),
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
        "Match source size": actionButton(
          () => handlers.matchSourceDisplaySize(),
          snapshot.matchSourceDisabled || workflowDisabled,
        ),
        "Upload texture": actionButton(() => handlers.onUploadClick(), workflowDisabled),
        uploadStatus: readOnlyStatusValue(snapshot.uploadError),
        "Copy state": actionButton(() => void handlers.onCopyState(), workflowDisabled),
        importJson: {
          value: snapshot.importText,
          label: " ",
          rows: 4 as const,
          disabled: workflowDisabled,
          onChange: skipInitialString(handlers.setImportText),
        },
        "Import state": actionButton(() => handlers.onImportState(), workflowDisabled),
        importStatus: readOnlyStatusValue(snapshot.importStatus),
      },
      { order: -100 },
    ),
    General: levaFolder(
      {
        Reset: resetButton(() => handlers.resetGeneral(), !snapshot.generalModified),
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
        Reset: resetButton(() => handlers.resetReveal(), !snapshot.revealModified),
        Replay: actionButton(() => handlers.replayReveal(), disabled),
        preset: selectControl<PlaygroundRevealPreset>(reveal.preset, REVEAL_PRESET_OPTIONS, {
          label: "Preset",
          hint: PLAYGROUND_FIELD_HELP.revealPreset,
          disabled,
          onChange: (preset) => handlers.onRevealCommit({ preset }),
        }),
        ...(reveal.preset === "wave"
          ? {
              revealPosition: selectControl<PlaygroundWaveRevealPosition>(
                reveal.wave.position,
                WAVE_POSITION_OPTIONS,
                {
                  label: "Position",
                  hint: PLAYGROUND_FIELD_HELP.revealPosition,
                  disabled,
                  onChange: (position) => handlers.onRevealWaveCommit({ position }),
                },
              ),
              revealWaveDuration: numControl(
                reveal.wave.durationMs,
                PLAYGROUND_CONTROL_RANGES.revealDurationMs.min,
                PLAYGROUND_CONTROL_RANGES.revealDurationMs.max,
                PLAYGROUND_CONTROL_RANGES.revealDurationMs.step,
                {
                  label: "Duration",
                  hint: PLAYGROUND_FIELD_HELP.revealDuration,
                  disabled,
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
                  disabled,
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
                  disabled,
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
                  disabled,
                  onLive: (value) => handlers.onRevealWaveLive({ noiseScale: value }),
                  onCommit: (value) => handlers.onRevealWaveCommit({ noiseScale: value }),
                },
              ),
            }
          : {
              revealColumnDuration: numControl(
                reveal.randomColumns.durationMs,
                PLAYGROUND_CONTROL_RANGES.revealDurationMs.min,
                PLAYGROUND_CONTROL_RANGES.revealDurationMs.max,
                PLAYGROUND_CONTROL_RANGES.revealDurationMs.step,
                {
                  label: "Duration",
                  hint: PLAYGROUND_FIELD_HELP.revealDuration,
                  disabled,
                  onLive: (value) => handlers.onRevealRandomColumnsLive({ durationMs: value }),
                  onCommit: (value) => handlers.onRevealRandomColumnsCommit({ durationMs: value }),
                },
              ),
              revealColumnStagger: numControl(
                reveal.randomColumns.stagger,
                PLAYGROUND_CONTROL_RANGES.revealColumnStagger.min,
                PLAYGROUND_CONTROL_RANGES.revealColumnStagger.max,
                PLAYGROUND_CONTROL_RANGES.revealColumnStagger.step,
                {
                  label: "Stagger",
                  hint: PLAYGROUND_FIELD_HELP.revealColumnStagger,
                  disabled,
                  onLive: (value) => handlers.onRevealRandomColumnsLive({ stagger: value }),
                  onCommit: (value) => handlers.onRevealRandomColumnsCommit({ stagger: value }),
                },
              ),
              revealColumnYShift: numControl(
                reveal.randomColumns.yShift,
                PLAYGROUND_CONTROL_RANGES.revealColumnYShift.min,
                PLAYGROUND_CONTROL_RANGES.revealColumnYShift.max,
                PLAYGROUND_CONTROL_RANGES.revealColumnYShift.step,
                {
                  label: "Y shift",
                  hint: PLAYGROUND_FIELD_HELP.revealColumnYShift,
                  disabled,
                  onLive: (value) => handlers.onRevealRandomColumnsLive({ yShift: value }),
                  onCommit: (value) => handlers.onRevealRandomColumnsCommit({ yShift: value }),
                },
              ),
            }),
      },
      { color: folderColor(snapshot.revealModified) },
    ),
    "Texture Tone": levaFolder(
      {
        Reset: resetButton(() => handlers.resetTone(), !snapshot.toneModified),
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
        Reset: resetButton(() => handlers.resetEffects(), !snapshot.effectsModified),
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
        Reset: resetButton(() => handlers.resetSource(), !snapshot.sourceModified),
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
        Reset: resetButton(() => handlers.resetBackground(), !snapshot.backgroundModified),
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
        Reset: resetButton(() => handlers.resetGrid(), !snapshot.gridModified),
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
        Reset: resetButton(() => handlers.resetLetters(), !snapshot.lettersModified),
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
        Reset: resetButton(() => handlers.resetStripes(), !snapshot.stripesModified),
        stripesEnabled: boolControl(snapshot.stripesEnabled, {
          label: "Stripes enabled",
          hint: PLAYGROUND_FIELD_HELP.stripesEnabled,
          disabled,
          onChange: handlers.setStripesEnabled,
        }),
        textureLuminanceMode: selectControl<TextureLuminanceMode>(
          snapshot.textureLuminanceSettings.mode,
          { Luminance: "luminance", Colors: "colors" },
          {
            label: "Luminance handling",
            hint: PLAYGROUND_FIELD_HELP.textureLuminanceMode,
            disabled: stripeDisabled,
            onChange: (mode) => handlers.setTextureLuminanceSettings({ mode }),
          },
        ),
        ...(snapshot.textureLuminanceSettings.mode === "colors"
          ? {
              textureLuminanceBackgroundColor: {
                value: intToHex(snapshot.textureLuminanceSettings.backgroundColor),
                label: "Texture background color",
                hint: PLAYGROUND_FIELD_HELP.textureBackgroundColor,
                disabled: stripeDisabled,
                onChange: skipInitialString((hex) =>
                  handlers.setTextureLuminanceSettings({
                    backgroundColor: normalizeTextureLuminanceBackgroundColor(hex),
                  }),
                ),
              },
            }
          : stripeFields),
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
        Reset: resetButton(() => handlers.resetSparkleGaps(), !snapshot.sparkleGapsModified),
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
        Reset: resetButton(() => handlers.resetSparkleWidth(), !snapshot.sparkleWidthModified),
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
        Reset: resetButton(() => handlers.resetFlames(), !snapshot.flamesModified),
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
        edgeMaskEnabled: boolControl(flames.edgeMaskEnabled, {
          label: "Edge mask",
          hint: PLAYGROUND_FIELD_HELP.flamesEdgeMaskEnabled,
          disabled: flamesDisabled,
          onChange: (value) => {
            handlers.onFlamesLive({ edgeMaskEnabled: value });
            handlers.onFlamesCommit({ edgeMaskEnabled: value });
          },
        }),
        edgeMaskStart: numControl(
          flames.edgeMaskStart * 100,
          PLAYGROUND_CONTROL_RANGES.flamesEdgeMaskInset.min,
          PLAYGROUND_CONTROL_RANGES.flamesEdgeMaskInset.max,
          PLAYGROUND_CONTROL_RANGES.flamesEdgeMaskInset.step,
          {
            label: "Mask start",
            hint: PLAYGROUND_FIELD_HELP.flamesEdgeMaskStart,
            disabled: flamesMaskDisabled,
            onLive: (value) => handlers.onFlamesLive({ edgeMaskStart: value / 100 }),
            onCommit: (value) => handlers.onFlamesCommit({ edgeMaskStart: value / 100 }),
          },
        ),
        edgeMaskEnd: numControl(
          flames.edgeMaskEnd * 100,
          PLAYGROUND_CONTROL_RANGES.flamesEdgeMaskInset.min,
          PLAYGROUND_CONTROL_RANGES.flamesEdgeMaskInset.max,
          PLAYGROUND_CONTROL_RANGES.flamesEdgeMaskInset.step,
          {
            label: "Mask end",
            hint: PLAYGROUND_FIELD_HELP.flamesEdgeMaskEnd,
            disabled: flamesMaskDisabled,
            onLive: (value) => handlers.onFlamesLive({ edgeMaskEnd: value / 100 }),
            onCommit: (value) => handlers.onFlamesCommit({ edgeMaskEnd: value / 100 }),
          },
        ),
        edgeMaskPower: numControl(
          flames.edgeMaskPower,
          PLAYGROUND_CONTROL_RANGES.flamesEdgeMaskPower.min,
          PLAYGROUND_CONTROL_RANGES.flamesEdgeMaskPower.max,
          PLAYGROUND_CONTROL_RANGES.flamesEdgeMaskPower.step,
          {
            label: "Mask power",
            hint: PLAYGROUND_FIELD_HELP.flamesEdgeMaskPower,
            disabled: flamesMaskDisabled,
            onLive: (value) => handlers.onFlamesLive({ edgeMaskPower: value }),
            onCommit: (value) => handlers.onFlamesCommit({ edgeMaskPower: value }),
          },
        ),
      },
      { color: folderColor(snapshot.flamesModified) },
    ),
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
  const reveal = snapshot.revealConfig;

  const stripeValues = Object.fromEntries(
    snapshot.stripes.flatMap((stripe) => [
      [`stripe_${stripe.id}_color`, stripe.hex],
      [`stripe_${stripe.id}_startFrom`, stripe.startFrom],
      [`stripe_${stripe.id}_width`, stripe.width],
    ]),
  );

  return {
    texture: snapshot.selectedTextureId,
    canvasWidth: Math.max(snapshot.displayWidth, 1),
    canvasHeight: Math.max(snapshot.displayHeight, 1),
    importJson: snapshot.importText,
    uploadStatus: snapshot.uploadError,
    importStatus: snapshot.importStatus,
    loadError: snapshot.loadError,
    shaderEnabled: snapshot.duotoneEnabled,
    preset: reveal.preset,
    revealPosition: reveal.wave.position,
    revealWaveDuration: reveal.wave.durationMs,
    revealSoftness: reveal.wave.softness,
    revealWaviness: reveal.wave.waviness,
    revealNoiseScale: reveal.wave.noiseScale,
    revealColumnDuration: reveal.randomColumns.durationMs,
    revealColumnStagger: reveal.randomColumns.stagger,
    revealColumnYShift: reveal.randomColumns.yShift,
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
    textureLuminanceBackgroundColor: intToHexSync(snapshot.textureLuminanceSettings.backgroundColor),
    ...stripeValues,
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
    edgeMaskEnabled: flames.edgeMaskEnabled,
    edgeMaskStart: flames.edgeMaskStart * 100,
    edgeMaskEnd: flames.edgeMaskEnd * 100,
    edgeMaskPower: flames.edgeMaskPower,
  };
}
