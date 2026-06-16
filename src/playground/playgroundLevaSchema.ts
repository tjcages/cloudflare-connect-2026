import { button, folder } from "leva";
import type { FolderSettings } from "leva/dist/declarations/src/types/public";
import { PLAYGROUND_CONTROL_RANGES } from "./playgroundControlRanges";
import { PLAYGROUND_FIELD_HELP } from "./playgroundFieldHelp";
import type { PlaygroundGridConfig } from "./playgroundGridConfig";
import type { PlaygroundFlamesConfig, PlaygroundFlamesDirection } from "./playgroundFlamesConfig";
import type { PlaygroundCursorTrailConfig } from "./playgroundCursorTrailConfig";
import type { PlaygroundClickWaveConfig } from "./playgroundClickWaveConfig";
import type {
  PlaygroundRandomColumnsRevealConfig,
  PlaygroundRevealConfig,
  PlaygroundRevealPreset,
  PlaygroundWaveRevealConfig,
  PlaygroundWaveRevealPosition,
} from "./playgroundRevealConfig";
import {
  PLAYGROUND_SHADER_PRESETS,
  PLAYGROUND_SHADER_PRESET_CUSTOM_ID,
  resolvePlaygroundShaderPresetId,
} from "./playgroundShaderSource";
import { findSavedShaderBySource, savedShaderPresetId, type PlaygroundSavedShader } from "./playgroundSavedShaders";
import { COLOR_PRESET_CUSTOM_ID, type PlaygroundColorPreset } from "./playgroundColorPresets";
import type { PlaygroundSourceFit, PlaygroundSourceTransform } from "./playgroundSourceTransform";
import type { PlaygroundTextureAdjustments } from "./playgroundTextureAdjustments";
import type { PlaygroundTextureId } from "./playgroundTextures";
import { PLAYGROUND_DISPLAY_MAX_PX } from "./setupTextureShaderScene";
import { type Stripe } from "./stripeColors";
import { stripeColorsTablePlugin, stripeSyncKey } from "./stripeColorsTablePlugin";
import { type TextureLuminanceMode, type TextureLuminanceSettings } from "./colorWhiteness";
import type { PlaygroundPerfSample } from "./playgroundPerfProfile";

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

function readOnlyControl(value: string, options: { label: string; hint?: string }) {
  return {
    value,
    label: options.label,
    hint: options.hint,
    disabled: true,
  };
}

function formatPerfNumber(value: number | undefined): string {
  return Number.isFinite(value) ? `${value!.toFixed(2)} ms` : "n/a";
}

function formatPerfCount(value: number | undefined): string {
  return Number.isFinite(value) ? `${Math.round(value!)}` : "n/a";
}

function formatPerfBool(value: boolean | undefined): string {
  return value ? "Yes" : "No";
}

function formatPerfFps(value: number | undefined): string {
  return Number.isFinite(value) ? `${value!.toFixed(1)} fps` : "n/a";
}

function formatPerfPct(value: number | undefined): string {
  return Number.isFinite(value) ? `${value!.toFixed(0)}%` : "n/a";
}

function formatPerfStatus(perfOverlayEnabled: boolean, perfSample: PlaygroundPerfSample | null): string {
  if (!perfOverlayEnabled) {
    return "Disabled (set __PLAYGROUND_PERF__ = true)";
  }
  return perfSample ? "Collecting live samples" : "Waiting for samples";
}

function formatPerfHealth(health: PlaygroundPerfSample["perfHealth"] | undefined): string {
  switch (health) {
    case "good":
      return "Good";
    case "ok":
      return "OK";
    case "slow":
      return "Slow";
    default:
      return "n/a";
  }
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

export type PlaygroundCanvasLevaSnapshot = {
  selectedTextureId: PlaygroundTextureId;
  textureOptions: Record<string, PlaygroundTextureId>;
  displayWidth: number;
  displayHeight: number;
  renderScale: number;
  workflowDisabled: boolean;
  perfOverlayEnabled?: boolean;
  perfSample?: PlaygroundPerfSample | null;
};

export type PlaygroundCanvasLevaHandlers = {
  onTextureSelect: (value: PlaygroundTextureId) => void;
  setDisplayWidth: (value: number) => void;
  setDisplayHeight: (value: number) => void;
  setRenderScale: (value: number) => void;
};

export type PlaygroundShaderLevaSnapshot = {
  shaderSource: string;
  workflowDisabled: boolean;
  savedShaders: readonly PlaygroundSavedShader[];
  audioInputEnabled: boolean;
  audioInputStatus: string;
};

export type PlaygroundShaderLevaHandlers = {
  onShaderSourceLive: (value: string) => void;
  onShaderSourceCommit: (value: string) => void;
  onShaderPresetChange: (presetId: string) => void;
  onSaveShader: () => void;
  onDeleteSavedShader: () => void;
  onBackupShadersToFiles: () => void;
  onAudioInputToggle: (enabled: boolean) => void;
};

function shaderPresetOptions(savedShaders: readonly PlaygroundSavedShader[]): Record<string, string> {
  const options: Record<string, string> = {};
  for (const preset of PLAYGROUND_SHADER_PRESETS) {
    options[preset.label] = preset.id;
  }
  const usedLabels = new Set(Object.keys(options));
  for (const saved of savedShaders) {
    let label = saved.label;
    let suffix = 2;
    while (usedLabels.has(label)) {
      label = `${saved.label} (${suffix})`;
      suffix += 1;
    }
    usedLabels.add(label);
    options[label] = savedShaderPresetId(saved.id);
  }
  options.Custom = PLAYGROUND_SHADER_PRESET_CUSTOM_ID;
  return options;
}

function colorPresetOptions(colorPresets: readonly PlaygroundColorPreset[]): Record<string, string> {
  const options: Record<string, string> = {};
  const usedLabels = new Set<string>();
  for (const preset of colorPresets) {
    let label = preset.label;
    let suffix = 2;
    while (usedLabels.has(label)) {
      label = `${preset.label} (${suffix})`;
      suffix += 1;
    }
    usedLabels.add(label);
    options[label] = preset.id;
  }
  // Sentinel shown when the live palette matches no saved preset.
  options.Custom = COLOR_PRESET_CUSTOM_ID;
  return options;
}

export function buildPlaygroundCanvasLevaSchema(
  snapshot: PlaygroundCanvasLevaSnapshot,
  handlers: PlaygroundCanvasLevaHandlers,
): Record<string, unknown> {
  const workflowDisabled = snapshot.workflowDisabled;
  const perfOverlayEnabled = snapshot.perfOverlayEnabled === true;
  const perfSample = snapshot.perfSample ?? null;

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
    renderScale: selectControl(
      String(snapshot.renderScale),
      { "2x (sharp)": "2", "1.5x": "1.5", "1x (fast)": "1", "0.5x (fastest)": "0.5" },
      {
        label: "Render scale",
        hint: PLAYGROUND_FIELD_HELP.renderScale,
        disabled: workflowDisabled,
        onChange: (value: string) => handlers.setRenderScale(Number(value)),
      },
    ),
    Performance: levaFolder({
      perfStatus: readOnlyControl(formatPerfStatus(perfOverlayEnabled, perfSample), {
        label: "Status",
        hint: PLAYGROUND_FIELD_HELP.perfStatus,
      }),
      perfHealth: readOnlyControl(formatPerfHealth(perfSample?.perfHealth), {
        label: "Health",
        hint: PLAYGROUND_FIELD_HELP.perfHealth,
      }),
      perfFps: readOnlyControl(formatPerfFps(perfSample?.fps), {
        label: "FPS (inst)",
        hint: PLAYGROUND_FIELD_HELP.perfFps,
      }),
      perfFpsSmoothed: readOnlyControl(formatPerfFps(perfSample?.fpsSmoothed), {
        label: "FPS (smooth)",
        hint: PLAYGROUND_FIELD_HELP.perfFpsSmoothed,
      }),
      perfFrameBudgetUsage: readOnlyControl(formatPerfPct(perfSample?.frameBudgetUsagePct), {
        label: "Budget usage",
        hint: PLAYGROUND_FIELD_HELP.perfFrameBudgetUsage,
      }),
      perfFrameHeadroom: readOnlyControl(formatPerfNumber(perfSample?.frameHeadroomMs), {
        label: "Headroom",
        hint: PLAYGROUND_FIELD_HELP.perfFrameHeadroom,
      }),
      perfTickTotalMs: readOnlyControl(formatPerfNumber(perfSample?.tickTotalMs), {
        label: "Tick total",
        hint: PLAYGROUND_FIELD_HELP.perfTickTotal,
      }),
      perfRenderMs: readOnlyControl(formatPerfNumber(perfSample?.renderMs), {
        label: "Render",
        hint: PLAYGROUND_FIELD_HELP.perfRender,
      }),
      perfBuildGridMs: readOnlyControl(formatPerfNumber(perfSample?.buildGridMs), {
        label: "Build grid",
        hint: PLAYGROUND_FIELD_HELP.perfBuildGrid,
      }),
      perfSampleFrameMs: readOnlyControl(formatPerfNumber(perfSample?.sampleFrameMs), {
        label: "Sample frame",
        hint: PLAYGROUND_FIELD_HELP.perfSampleFrame,
      }),
      perfBlockTextureMs: readOnlyControl(formatPerfNumber(perfSample?.blockTextureMs), {
        label: "Upload grid",
        hint: PLAYGROUND_FIELD_HELP.perfBlockTexture,
      }),
      perfWorkerLatencyMs: readOnlyControl(formatPerfNumber(perfSample?.workerGridLatencyMs), {
        label: "Worker latency",
        hint: PLAYGROUND_FIELD_HELP.perfWorkerLatency,
      }),
      perfWorkerQueueDepth: readOnlyControl(formatPerfCount(perfSample?.workerGridQueueDepth), {
        label: "Worker queue depth",
        hint: PLAYGROUND_FIELD_HELP.perfWorkerQueueDepth,
      }),
      perfWorkerInFlight: readOnlyControl(formatPerfBool(perfSample?.workerGridInFlight), {
        label: "Worker in flight",
        hint: PLAYGROUND_FIELD_HELP.perfWorkerInFlight,
      }),
      perfWorkerApplied: readOnlyControl(formatPerfBool(perfSample?.workerGridApplied), {
        label: "Worker applied",
        hint: PLAYGROUND_FIELD_HELP.perfWorkerApplied,
      }),
      perfWorkerCoalesced: readOnlyControl(formatPerfCount(perfSample?.workerGridCoalesced), {
        label: "Worker coalesced",
        hint: PLAYGROUND_FIELD_HELP.perfWorkerCoalesced,
      }),
      perfWorkerDroppedQueued: readOnlyControl(formatPerfCount(perfSample?.workerGridDroppedQueued), {
        label: "Worker dropped queued",
        hint: PLAYGROUND_FIELD_HELP.perfWorkerDroppedQueued,
      }),
      perfPartialGrid: readOnlyControl(formatPerfBool(perfSample?.partialGrid), {
        label: "Partial grid",
        hint: PLAYGROUND_FIELD_HELP.perfPartialGrid,
      }),
    }),
  };
}

export function buildPlaygroundCanvasLevaSyncValues(snapshot: PlaygroundCanvasLevaSnapshot): Record<string, unknown> {
  const perfOverlayEnabled = snapshot.perfOverlayEnabled === true;
  const perfSample = snapshot.perfSample ?? null;
  return {
    texture: snapshot.selectedTextureId,
    canvasWidth: Math.max(snapshot.displayWidth, 1),
    canvasHeight: Math.max(snapshot.displayHeight, 1),
    renderScale: String(snapshot.renderScale),
    perfStatus: formatPerfStatus(perfOverlayEnabled, perfSample),
    perfHealth: formatPerfHealth(perfSample?.perfHealth),
    perfFps: formatPerfFps(perfSample?.fps),
    perfFpsSmoothed: formatPerfFps(perfSample?.fpsSmoothed),
    perfFrameBudgetUsage: formatPerfPct(perfSample?.frameBudgetUsagePct),
    perfFrameHeadroom: formatPerfNumber(perfSample?.frameHeadroomMs),
    perfTickTotalMs: formatPerfNumber(perfSample?.tickTotalMs),
    perfRenderMs: formatPerfNumber(perfSample?.renderMs),
    perfBuildGridMs: formatPerfNumber(perfSample?.buildGridMs),
    perfSampleFrameMs: formatPerfNumber(perfSample?.sampleFrameMs),
    perfBlockTextureMs: formatPerfNumber(perfSample?.blockTextureMs),
    perfWorkerLatencyMs: formatPerfNumber(perfSample?.workerGridLatencyMs),
    perfWorkerQueueDepth: formatPerfCount(perfSample?.workerGridQueueDepth),
    perfWorkerInFlight: formatPerfBool(perfSample?.workerGridInFlight),
    perfWorkerApplied: formatPerfBool(perfSample?.workerGridApplied),
    perfWorkerCoalesced: formatPerfCount(perfSample?.workerGridCoalesced),
    perfWorkerDroppedQueued: formatPerfCount(perfSample?.workerGridDroppedQueued),
    perfPartialGrid: formatPerfBool(perfSample?.partialGrid),
  };
}

export function buildPlaygroundShaderLevaSchema(
  snapshot: PlaygroundShaderLevaSnapshot,
  handlers: PlaygroundShaderLevaHandlers,
): Record<string, unknown> {
  const isSavedShaderActive = Boolean(findSavedShaderBySource(snapshot.savedShaders, snapshot.shaderSource));
  return {
    shaderPreset: selectControl(
      resolvePlaygroundShaderPresetId(snapshot.shaderSource, snapshot.savedShaders),
      shaderPresetOptions(snapshot.savedShaders),
      {
        label: "Preset",
        hint: PLAYGROUND_FIELD_HELP.shaderPreset,
        disabled: snapshot.workflowDisabled,
        onChange: handlers.onShaderPresetChange,
      },
    ),
    shaderSource: {
      value: snapshot.shaderSource,
      label: "Shader equation",
      hint: PLAYGROUND_FIELD_HELP.shaderSource,
      rows: 18 as const,
      disabled: snapshot.workflowDisabled,
      transient: true as const,
      onChange: skipInitialString(handlers.onShaderSourceLive),
      onEditEnd: skipInitialString(handlers.onShaderSourceCommit),
    },
    audioInput: boolControl(snapshot.audioInputEnabled, {
      label: "Audio input (mic)",
      hint: PLAYGROUND_FIELD_HELP.audioInput,
      disabled: snapshot.workflowDisabled,
      onChange: handlers.onAudioInputToggle,
    }),
    ...(snapshot.audioInputStatus
      ? { audioInputStatus: { value: snapshot.audioInputStatus, label: "Mic status", editable: false } }
      : {}),
    saveShader: { ...actionButton(handlers.onSaveShader, snapshot.workflowDisabled), label: "Save shader" },
    deleteShader: {
      ...actionButton(handlers.onDeleteSavedShader, snapshot.workflowDisabled || !isSavedShaderActive),
      label: "Delete saved shader",
    },
    backupShaders: {
      ...actionButton(handlers.onBackupShadersToFiles, snapshot.workflowDisabled || snapshot.savedShaders.length === 0),
      label: "Save all shaders to files",
    },
  };
}

export function buildPlaygroundShaderLevaSyncValues(snapshot: PlaygroundShaderLevaSnapshot): Record<string, unknown> {
  return {
    shaderPreset: resolvePlaygroundShaderPresetId(snapshot.shaderSource, snapshot.savedShaders),
    shaderSource: snapshot.shaderSource,
    audioInput: snapshot.audioInputEnabled,
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
  flamesMaskDisabled: boolean;
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
  colorPresets: readonly PlaygroundColorPreset[];
  activeColorPresetId: string;
  sparkleGapsActivePercent: number;
  sparkleGapsSpeed: number;
  sparkleWidthActivePercent: number;
  sparkleWidthSpeed: number;
  flamesConfig: PlaygroundFlamesConfig;
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
  cursorTrailModified: boolean;
  cursorClickModified: boolean;
  revealModified: boolean;
  perfOverlayEnabled?: boolean;
  perfSample?: PlaygroundPerfSample | null;
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
  onStripeMove: (id: string, direction: -1 | 1) => void;
  onStripeAdd: () => void;
  onStripeRemove: (id: string) => void;
  resetStripes: () => void;
  applyColorPreset: (id: string) => void;
  saveColorPreset: () => void;
  deleteColorPreset: () => void;
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
  const cursorTrail = snapshot.cursorTrailConfig;
  const cursorTrailDisabled = snapshot.cursorTrailFieldsDisabled;
  const clickWave = snapshot.clickWaveConfig;
  const clickWaveDisabled = snapshot.cursorClickFieldsDisabled;
  const reveal = snapshot.revealConfig;
  const revealDisabled = snapshot.revealFieldsDisabled;

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
        preset: selectControl<PlaygroundRevealPreset>(reveal.preset, REVEAL_PRESET_OPTIONS, {
          label: "Preset",
          hint: PLAYGROUND_FIELD_HELP.revealPreset,
          disabled: revealDisabled,
          onChange: (preset) => handlers.onRevealCommit({ preset }),
        }),
        ...(reveal.preset === "wave"
          ? {
              revealPosition: selectControl<PlaygroundWaveRevealPosition>(reveal.wave.position, WAVE_POSITION_OPTIONS, {
                label: "Position",
                hint: PLAYGROUND_FIELD_HELP.revealPosition,
                disabled: revealDisabled,
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
                  disabled: revealDisabled,
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
                  disabled: revealDisabled,
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
                  disabled: revealDisabled,
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
                  disabled: revealDisabled,
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
                  disabled: revealDisabled,
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
                  disabled: revealDisabled,
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
                  disabled: revealDisabled,
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
        zoom: numControl(source.zoom, 0.1, 8, 0.01, {
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
        colorPreset: selectControl(snapshot.activeColorPresetId, colorPresetOptions(snapshot.colorPresets), {
          label: "Color preset",
          hint: PLAYGROUND_FIELD_HELP.colorPreset,
          disabled: stripeDisabled,
          onChange: handlers.applyColorPreset,
        }),
        saveColorPreset: {
          ...actionButton(() => handlers.saveColorPreset(), stripeDisabled),
          label: "Save color preset",
        },
        deleteColorPreset: {
          ...actionButton(
            () => handlers.deleteColorPreset(),
            stripeDisabled || snapshot.activeColorPresetId === COLOR_PRESET_CUSTOM_ID,
          ),
          label: "Delete color preset",
        },
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
  const cursorTrail = snapshot.cursorTrailConfig;
  const clickWave = snapshot.clickWaveConfig;
  const reveal = snapshot.revealConfig;

  const values: Record<string, unknown> = {
    shaderEnabled: snapshot.duotoneEnabled,
    revealEnabled: reveal.enabled,
    preset: reveal.preset,
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
    colorPreset: snapshot.activeColorPresetId,
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
    edgeMaskEnabled: flames.edgeMaskEnabled,
    edgeMaskStart: flames.edgeMaskStart * 100,
    edgeMaskEnd: flames.edgeMaskEnd * 100,
    edgeMaskPower: flames.edgeMaskPower,
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

  if (reveal.preset === "wave") {
    values.revealPosition = reveal.wave.position;
    values.revealWaveDuration = reveal.wave.durationMs;
    values.revealSoftness = reveal.wave.softness;
    values.revealWaviness = reveal.wave.waviness;
    values.revealNoiseScale = reveal.wave.noiseScale;
  } else {
    values.revealColumnDuration = reveal.randomColumns.durationMs;
    values.revealColumnStagger = reveal.randomColumns.stagger;
    values.revealColumnYShift = reveal.randomColumns.yShift;
  }

  if (snapshot.textureLuminanceSettings.mode === "luminance" || snapshot.textureLuminanceSettings.mode === "overlay") {
    values.stripeColorsTable = stripeSyncKey(snapshot.stripes);
  }

  return values;
}
