import { LevaPanel, useControls, useCreateStore } from "leva";
import { useEffect, useMemo, useRef, type ChangeEvent } from "react";
import type { PlaygroundFlamesConfig } from "./playgroundFlamesConfig";
import type { PlaygroundCursorTrailConfig } from "./playgroundCursorTrailConfig";
import type { PlaygroundGridConfig } from "./playgroundGridConfig";
import type {
  PlaygroundRandomColumnsRevealConfig,
  PlaygroundRevealConfig,
  PlaygroundWaveRevealConfig,
} from "./playgroundRevealConfig";
import type { PlaygroundSourceTransform } from "./playgroundSourceTransform";
import type { PlaygroundTextureAdjustments } from "./playgroundTextureAdjustments";
import type { PlaygroundCatalogEntry } from "./playgroundPersistence";
import type { PlaygroundTextureId } from "./playgroundTextures";
import type { TextureLuminanceSettings } from "./colorWhiteness";
import {
  buildPlaygroundLevaSchema,
  buildPlaygroundLevaSyncValues,
  type PlaygroundLevaHandlers,
  type PlaygroundLevaSnapshot,
} from "./playgroundLevaSchema";
import { PLAYGROUND_LEVA_LIGHT_THEME } from "./playgroundLevaTheme";
import { PLAYGROUND_LEVA_SIDEBAR_CLASS } from "./playgroundUi";
import type { Stripe } from "./stripeColors";

export type PlaygroundLevaControlsProps = {
  catalog: readonly PlaygroundCatalogEntry[];
  selectedTextureId: PlaygroundTextureId;
  onTextureSelect: (value: PlaygroundTextureId) => void;
  displayWidth: number;
  displayHeight: number;
  sourceWidth: number;
  sourceHeight: number;
  onDisplayWidthChange: (value: number) => void;
  onDisplayHeightChange: (value: number) => void;
  matchSourceDisplaySize: () => void;
  onUploadFile: (event: ChangeEvent<HTMLInputElement>) => void;
  importText: string;
  onImportTextChange: (value: string) => void;
  onCopyState: () => void;
  onImportState: () => void;
  importStatus: string | null;
  uploadError: string | null;
  workflowDisabled: boolean;
  loadError?: string | null;
  fallbackTextureId?: PlaygroundTextureId | null;
  fallbackTextureLabel?: string | null;
  onLoadFallbackTexture?: () => void;
  duotoneEnabled: boolean;
  onDuotoneEnabledChange: (value: boolean) => void;
  duotoneControlsDisabled: boolean;
  textureAdjustments: PlaygroundTextureAdjustments;
  onAdjustmentsChange: (patch: Partial<PlaygroundTextureAdjustments>) => void;
  onLiveAdjustmentsChange: (patch: Partial<PlaygroundTextureAdjustments>) => void;
  onResetTone: () => void;
  onResetEffects: () => void;
  toneModified: boolean;
  effectsModified: boolean;
  sourceTransform: PlaygroundSourceTransform;
  onSourceTransformChange: (patch: Partial<PlaygroundSourceTransform>) => void;
  onLiveSourceTransformChange: (patch: Partial<PlaygroundSourceTransform>) => void;
  onResetSource: () => void;
  sourceModified: boolean;
  backgroundColor: number;
  backgroundCss: string;
  backgroundCssActive: boolean;
  onBackgroundColorChange: (value: number) => void;
  onBackgroundCssChange: (value: string) => void;
  onResetBackground: () => void;
  backgroundModified: boolean;
  gridConfig: PlaygroundGridConfig;
  onGridChange: (patch: Partial<PlaygroundGridConfig>) => void;
  onGridLiveChange: (patch: Partial<PlaygroundGridConfig>) => void;
  onResetGrid: () => void;
  onResetLetters: () => void;
  gridModified: boolean;
  lettersModified: boolean;
  stripes: readonly Stripe[];
  stripesEnabled: boolean;
  textureLuminanceSettings: TextureLuminanceSettings;
  onStripesEnabledChange: (value: boolean) => void;
  onTextureLuminanceSettingsChange: (patch: Partial<TextureLuminanceSettings>) => void;
  onStripeColorChange: (id: string, hex: string) => void;
  onStripeStartFromCommit: (id: string, value: number) => void;
  onStripeWidthCommit: (id: string, value: number) => void;
  onResetStripes: () => void;
  stripesModified: boolean;
  sparkleGapsActivePercent: number;
  sparkleGapsSpeed: number;
  setSparkleGapsActivePercentLive: (value: number) => void;
  commitSparkleGapsActivePercent: (value: number) => void;
  setSparkleGapsSpeedLive: (value: number) => void;
  commitSparkleGapsSpeed: (value: number) => void;
  onResetSparkleGaps: () => void;
  sparkleGapsModified: boolean;
  sparkleWidthActivePercent: number;
  sparkleWidthSpeed: number;
  setSparkleWidthActivePercentLive: (value: number) => void;
  commitSparkleWidthActivePercent: (value: number) => void;
  setSparkleWidthSpeedLive: (value: number) => void;
  commitSparkleWidthSpeed: (value: number) => void;
  onResetSparkleWidth: () => void;
  sparkleWidthModified: boolean;
  flamesConfig: PlaygroundFlamesConfig;
  onFlamesChange: (patch: Partial<PlaygroundFlamesConfig>) => void;
  onFlamesLiveChange: (patch: Partial<PlaygroundFlamesConfig>) => void;
  onResetFlames: () => void;
  flamesModified: boolean;
  cursorTrailConfig: PlaygroundCursorTrailConfig;
  onCursorTrailChange: (patch: Partial<PlaygroundCursorTrailConfig>) => void;
  onCursorTrailLiveChange: (patch: Partial<PlaygroundCursorTrailConfig>) => void;
  onResetCursorTrail: () => void;
  cursorTrailModified: boolean;
  revealConfig: PlaygroundRevealConfig;
  onRevealChange: (patch: Partial<PlaygroundRevealConfig>) => void;
  onRevealWaveLiveChange: (patch: Partial<PlaygroundWaveRevealConfig>) => void;
  onRevealRandomColumnsLiveChange: (patch: Partial<PlaygroundRandomColumnsRevealConfig>) => void;
  onResetReveal: () => void;
  onReplayReveal: () => void;
  revealModified: boolean;
  onResetGeneral: () => void;
  generalModified: boolean;
};

export function PlaygroundLevaControls(props: PlaygroundLevaControlsProps) {
  const store = useCreateStore();
  const propsRef = useRef(props);
  propsRef.current = props;
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const textureOptions = useMemo((): Record<string, PlaygroundTextureId> => {
    if (props.catalog.length === 0) {
      return { "No textures": props.selectedTextureId };
    }
    return Object.fromEntries(props.catalog.map((entry) => [entry.label, entry.id]));
  }, [props.catalog, props.selectedTextureId]);

  const snapshot = useMemo((): PlaygroundLevaSnapshot => {
    const current = propsRef.current;
    const stripeControlsDisabled = current.duotoneControlsDisabled || !current.stripesEnabled;
    const flamesFieldsDisabled = current.duotoneControlsDisabled || !current.flamesConfig.enabled;
    const flamesMaskDisabled = flamesFieldsDisabled || !current.flamesConfig.edgeMaskEnabled;
    const cursorTrailFieldsDisabled = current.duotoneControlsDisabled || !current.cursorTrailConfig.enabled;

    return {
      selectedTextureId: current.selectedTextureId,
      textureOptions,
      displayWidth: current.displayWidth,
      displayHeight: current.displayHeight,
      importText: current.importText,
      uploadError: current.uploadError ?? "",
      importStatus: current.importStatus ?? "",
      workflowDisabled: current.workflowDisabled,
      matchSourceDisabled: current.sourceWidth <= 0 || current.sourceHeight <= 0,
      loadError: current.loadError ?? "",
      fallbackTextureAvailable: Boolean(current.fallbackTextureId),
      duotoneEnabled: current.duotoneEnabled,
      duotoneControlsDisabled: current.duotoneControlsDisabled,
      backgroundCssActive: current.backgroundCssActive,
      stripeControlsDisabled,
      sparkleGapsSpeedDisabled: current.sparkleGapsActivePercent <= 0,
      sparkleWidthSpeedDisabled: current.sparkleWidthActivePercent <= 0,
      flamesFieldsDisabled,
      flamesMaskDisabled,
      cursorTrailFieldsDisabled,
      textureAdjustments: current.textureAdjustments,
      sourceTransform: current.sourceTransform,
      backgroundColor: current.backgroundColor,
      backgroundCss: current.backgroundCss,
      gridConfig: current.gridConfig,
      stripes: current.stripes,
      stripesEnabled: current.stripesEnabled,
      textureLuminanceSettings: current.textureLuminanceSettings,
      sparkleGapsActivePercent: current.sparkleGapsActivePercent,
      sparkleGapsSpeed: current.sparkleGapsSpeed,
      sparkleWidthActivePercent: current.sparkleWidthActivePercent,
      sparkleWidthSpeed: current.sparkleWidthSpeed,
      flamesConfig: current.flamesConfig,
      cursorTrailConfig: current.cursorTrailConfig,
      revealConfig: current.revealConfig,
      generalModified: current.generalModified,
      toneModified: current.toneModified,
      effectsModified: current.effectsModified,
      sourceModified: current.sourceModified,
      backgroundModified: current.backgroundModified,
      gridModified: current.gridModified,
      lettersModified: current.lettersModified,
      stripesModified: current.stripesModified,
      sparkleGapsModified: current.sparkleGapsModified,
      sparkleWidthModified: current.sparkleWidthModified,
      flamesModified: current.flamesModified,
      cursorTrailModified: current.cursorTrailModified,
      revealModified: current.revealModified,
    };
  }, [
    textureOptions,
    props.selectedTextureId,
    props.displayWidth,
    props.displayHeight,
    props.importText,
    props.uploadError,
    props.importStatus,
    props.workflowDisabled,
    props.sourceWidth,
    props.sourceHeight,
    props.loadError,
    props.fallbackTextureId,
    props.duotoneEnabled,
    props.duotoneControlsDisabled,
    props.backgroundCssActive,
    props.stripesEnabled,
    props.sparkleGapsActivePercent,
    props.sparkleWidthActivePercent,
    props.flamesConfig.enabled,
    props.flamesConfig.edgeMaskEnabled,
    props.cursorTrailConfig.enabled,
    props.textureAdjustments,
    props.sourceTransform,
    props.backgroundColor,
    props.backgroundCss,
    props.gridConfig,
    props.stripes,
    props.textureLuminanceSettings,
    props.sparkleGapsSpeed,
    props.sparkleWidthActivePercent,
    props.sparkleWidthSpeed,
    props.flamesConfig,
    props.cursorTrailConfig,
    props.revealConfig,
    props.generalModified,
    props.toneModified,
    props.effectsModified,
    props.sourceModified,
    props.backgroundModified,
    props.gridModified,
    props.lettersModified,
    props.stripesModified,
    props.sparkleGapsModified,
    props.sparkleWidthModified,
    props.flamesModified,
    props.cursorTrailModified,
    props.revealModified,
  ]);

  const handlersRef = useRef<PlaygroundLevaHandlers>({
    onTextureSelect: (value) => propsRef.current.onTextureSelect(value),
    setDisplayWidth: (value) => propsRef.current.onDisplayWidthChange(value),
    setDisplayHeight: (value) => propsRef.current.onDisplayHeightChange(value),
    matchSourceDisplaySize: () => propsRef.current.matchSourceDisplaySize(),
    onUploadClick: () => fileInputRef.current?.click(),
    onCopyState: () => void propsRef.current.onCopyState(),
    setImportText: (value) => propsRef.current.onImportTextChange(value),
    onImportState: () => propsRef.current.onImportState(),
    loadFallbackTexture: () => propsRef.current.onLoadFallbackTexture?.(),
    setDuotoneEnabled: (value) => propsRef.current.onDuotoneEnabledChange(value),
    resetGeneral: () => propsRef.current.onResetGeneral(),
    onAdjustmentsLive: (patch) => propsRef.current.onLiveAdjustmentsChange(patch),
    onAdjustmentsCommit: (patch) => propsRef.current.onAdjustmentsChange(patch),
    resetTone: () => propsRef.current.onResetTone(),
    resetEffects: () => propsRef.current.onResetEffects(),
    onSourceLive: (patch) => propsRef.current.onLiveSourceTransformChange(patch),
    onSourceCommit: (patch) => propsRef.current.onSourceTransformChange(patch),
    resetSource: () => propsRef.current.onResetSource(),
    setBackgroundColor: (value) => propsRef.current.onBackgroundColorChange(value),
    setBackgroundCss: (value) => propsRef.current.onBackgroundCssChange(value),
    resetBackground: () => propsRef.current.onResetBackground(),
    onGridLive: (patch) => propsRef.current.onGridLiveChange(patch),
    onGridCommit: (patch) => propsRef.current.onGridChange(patch),
    resetGrid: () => propsRef.current.onResetGrid(),
    resetLetters: () => propsRef.current.onResetLetters(),
    setStripesEnabled: (value) => propsRef.current.onStripesEnabledChange(value),
    setTextureLuminanceSettings: (patch) => propsRef.current.onTextureLuminanceSettingsChange(patch),
    onStripeColorChange: (id, hex) => propsRef.current.onStripeColorChange(id, hex),
    onStripeStartFromCommit: (id, value) => propsRef.current.onStripeStartFromCommit(id, value),
    onStripeWidthCommit: (id, value) => propsRef.current.onStripeWidthCommit(id, value),
    resetStripes: () => propsRef.current.onResetStripes(),
    setSparkleGapsActivePercentLive: (value) => propsRef.current.setSparkleGapsActivePercentLive(value),
    commitSparkleGapsActivePercent: (value) => propsRef.current.commitSparkleGapsActivePercent(value),
    setSparkleGapsSpeedLive: (value) => propsRef.current.setSparkleGapsSpeedLive(value),
    commitSparkleGapsSpeed: (value) => propsRef.current.commitSparkleGapsSpeed(value),
    resetSparkleGaps: () => propsRef.current.onResetSparkleGaps(),
    setSparkleWidthActivePercentLive: (value) => propsRef.current.setSparkleWidthActivePercentLive(value),
    commitSparkleWidthActivePercent: (value) => propsRef.current.commitSparkleWidthActivePercent(value),
    setSparkleWidthSpeedLive: (value) => propsRef.current.setSparkleWidthSpeedLive(value),
    commitSparkleWidthSpeed: (value) => propsRef.current.commitSparkleWidthSpeed(value),
    resetSparkleWidth: () => propsRef.current.onResetSparkleWidth(),
    onFlamesLive: (patch) => propsRef.current.onFlamesLiveChange(patch),
    onFlamesCommit: (patch) => propsRef.current.onFlamesChange(patch),
    resetFlames: () => propsRef.current.onResetFlames(),
    onCursorTrailLive: (patch) => propsRef.current.onCursorTrailLiveChange(patch),
    onCursorTrailCommit: (patch) => propsRef.current.onCursorTrailChange(patch),
    resetCursorTrail: () => propsRef.current.onResetCursorTrail(),
    onRevealCommit: (patch) => propsRef.current.onRevealChange(patch),
    onRevealWaveLive: (patch) => propsRef.current.onRevealWaveLiveChange(patch),
    onRevealWaveCommit: (patch) =>
      propsRef.current.onRevealChange({ wave: { ...propsRef.current.revealConfig.wave, ...patch } }),
    onRevealRandomColumnsLive: (patch) => propsRef.current.onRevealRandomColumnsLiveChange(patch),
    onRevealRandomColumnsCommit: (patch) =>
      propsRef.current.onRevealChange({
        randomColumns: { ...propsRef.current.revealConfig.randomColumns, ...patch },
      }),
    resetReveal: () => propsRef.current.onResetReveal(),
    replayReveal: () => propsRef.current.onReplayReveal(),
  });

  const stripeKey = props.stripes.map((stripe) => stripe.id).join("|");

  useControls(() => buildPlaygroundLevaSchema(snapshot, handlersRef.current) as never, { store }, [
    snapshot.duotoneControlsDisabled,
    snapshot.backgroundCssActive,
    snapshot.stripeControlsDisabled,
    snapshot.sparkleGapsSpeedDisabled,
    snapshot.sparkleWidthSpeedDisabled,
    snapshot.flamesFieldsDisabled,
    snapshot.flamesMaskDisabled,
    snapshot.cursorTrailFieldsDisabled,
    snapshot.workflowDisabled,
    snapshot.loadError,
    snapshot.selectedTextureId,
    stripeKey,
    props.textureLuminanceSettings.mode,
    props.gridConfig.cellWidth,
    props.gridConfig.cellHeight,
    props.catalog.length,
    props.revealConfig.preset,
  ]);

  const syncSignature = useMemo(() => JSON.stringify(buildPlaygroundLevaSyncValues(snapshot)), [snapshot]);

  useEffect(() => {
    store.set(buildPlaygroundLevaSyncValues(snapshot), false);
  }, [store, syncSignature, snapshot]);

  return (
    <aside className={PLAYGROUND_LEVA_SIDEBAR_CLASS}>
      <div
        data-testid="playground-leva-panel"
        className="playground-leva-panel ui-scroll-hidden flex min-h-0 flex-1 flex-col overflow-y-auto"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*,image/*"
          className="hidden"
          onChange={(event) => void props.onUploadFile(event)}
        />
        <LevaPanel store={store} theme={PLAYGROUND_LEVA_LIGHT_THEME} fill flat titleBar={false} />
      </div>
    </aside>
  );
}
