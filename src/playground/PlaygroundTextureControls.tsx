import { FieldHelp } from "./FieldHelp";
import { PlaygroundControlSection } from "./PlaygroundControlSection";
import { PlaygroundNumberField } from "./PlaygroundNumberField";
import { PLAYGROUND_FIELD_HELP } from "./playgroundFieldHelp";
import type { PlaygroundSourceFit, PlaygroundSourceTransform } from "./playgroundSourceTransform";
import type { PlaygroundTextureAdjustments } from "./playgroundTextureAdjustments";

type PlaygroundTextureControlsProps = {
  adjustments: PlaygroundTextureAdjustments;
  sourceTransform: PlaygroundSourceTransform;
  onAdjustmentsChange: (patch: Partial<PlaygroundTextureAdjustments>) => void;
  onLiveAdjustmentsChange?: (patch: Partial<PlaygroundTextureAdjustments>) => void;
  onSourceTransformChange: (patch: Partial<PlaygroundSourceTransform>) => void;
  onLiveSourceTransformChange?: (patch: Partial<PlaygroundSourceTransform>) => void;
  onResetTone: () => void;
  onResetSource: () => void;
  onResetEffects: () => void;
  toneModified: boolean;
  sourceModified: boolean;
  effectsModified: boolean;
  disabled: boolean;
};

export function PlaygroundTextureControls({
  adjustments,
  sourceTransform,
  onAdjustmentsChange,
  onLiveAdjustmentsChange,
  onSourceTransformChange,
  onLiveSourceTransformChange,
  onResetTone,
  onResetSource,
  onResetEffects,
  toneModified,
  sourceModified,
  effectsModified,
  disabled,
}: PlaygroundTextureControlsProps) {
  const liveAdjustments = onLiveAdjustmentsChange;
  const liveSource = onLiveSourceTransformChange;

  return (
    <>
      <PlaygroundControlSection
        title="Texture Tone"
        testId="playground-section-texture-tone"
        modified={toneModified}
        onReset={onResetTone}
      >
        <PlaygroundNumberField
          label="Exposure"
          value={adjustments.exposure}
          inputMin={-5}
          inputMax={5}
          sliderMin={-2}
          sliderMax={2}
          step={0.05}
          ariaLabel="Texture exposure"
          disabled={disabled}
          onChange={(value) => onAdjustmentsChange({ exposure: value })}
          onLiveChange={liveAdjustments ? (value) => liveAdjustments({ exposure: value }) : undefined}
          formatDisplay={(v) => v.toFixed(2)}
          description={PLAYGROUND_FIELD_HELP.exposure}
        />
        <PlaygroundNumberField
          label="Brightness"
          value={adjustments.brightness}
          inputMin={-1}
          inputMax={1}
          sliderMin={-0.5}
          sliderMax={0.5}
          step={0.01}
          ariaLabel="Texture brightness"
          disabled={disabled}
          onChange={(value) => onAdjustmentsChange({ brightness: value })}
          onLiveChange={liveAdjustments ? (value) => liveAdjustments({ brightness: value }) : undefined}
          formatDisplay={(v) => v.toFixed(2)}
          description={PLAYGROUND_FIELD_HELP.brightness}
        />
        <PlaygroundNumberField
          label="Contrast"
          value={adjustments.contrast}
          inputMin={0}
          inputMax={4}
          sliderMin={0}
          sliderMax={2}
          step={0.01}
          ariaLabel="Texture contrast"
          disabled={disabled}
          onChange={(value) => onAdjustmentsChange({ contrast: value })}
          onLiveChange={liveAdjustments ? (value) => liveAdjustments({ contrast: value }) : undefined}
          formatDisplay={(v) => v.toFixed(2)}
          description={PLAYGROUND_FIELD_HELP.contrast}
        />
        <PlaygroundNumberField
          label="Gamma"
          value={adjustments.gamma}
          inputMin={0.05}
          inputMax={1_000}
          sliderMin={0.05}
          sliderMax={5}
          step={0.05}
          ariaLabel="Texture luminance gamma"
          disabled={disabled}
          onChange={(value) => onAdjustmentsChange({ gamma: value })}
          onLiveChange={liveAdjustments ? (value) => liveAdjustments({ gamma: value }) : undefined}
          formatDisplay={(v) => String(v)}
          description={PLAYGROUND_FIELD_HELP.gamma}
        />
        <label className={`flex items-center gap-2 text-sm ${disabled ? "opacity-40" : ""}`}>
          <input
            type="checkbox"
            checked={adjustments.invert}
            disabled={disabled}
            onChange={(event) => onAdjustmentsChange({ invert: event.target.checked })}
            className="size-4 cursor-pointer rounded border-neutral-300 disabled:cursor-not-allowed"
            aria-label="Invert texture luminance"
          />
          <span className="flex items-center gap-1.5 text-neutral-800">
            <FieldHelp label="Invert luminance" description={PLAYGROUND_FIELD_HELP.invertLuminance} />
          </span>
        </label>
      </PlaygroundControlSection>

      <PlaygroundControlSection
        title="Texture Levels"
        testId="playground-section-texture-levels"
        modified={effectsModified}
        onReset={onResetEffects}
      >
        <PlaygroundNumberField
          label="Black point"
          value={adjustments.blackPoint}
          inputMin={0}
          inputMax={1}
          sliderMin={0}
          sliderMax={1}
          step={0.01}
          ariaLabel="Texture black point"
          disabled={disabled}
          onChange={(value) => onAdjustmentsChange({ blackPoint: value })}
          onLiveChange={liveAdjustments ? (value) => liveAdjustments({ blackPoint: value }) : undefined}
          formatDisplay={(v) => v.toFixed(2)}
          description={PLAYGROUND_FIELD_HELP.blackPoint}
        />
        <PlaygroundNumberField
          label="White point"
          value={adjustments.whitePoint}
          inputMin={0}
          inputMax={1}
          sliderMin={0}
          sliderMax={1}
          step={0.01}
          ariaLabel="Texture white point"
          disabled={disabled}
          onChange={(value) => onAdjustmentsChange({ whitePoint: value })}
          onLiveChange={liveAdjustments ? (value) => liveAdjustments({ whitePoint: value }) : undefined}
          formatDisplay={(v) => v.toFixed(2)}
          description={PLAYGROUND_FIELD_HELP.whitePoint}
        />
        <PlaygroundNumberField
          label="Threshold bias"
          value={adjustments.thresholdBias}
          inputMin={-1}
          inputMax={1}
          sliderMin={-0.5}
          sliderMax={0.5}
          step={0.01}
          ariaLabel="Texture threshold bias"
          disabled={disabled}
          onChange={(value) => onAdjustmentsChange({ thresholdBias: value })}
          onLiveChange={liveAdjustments ? (value) => liveAdjustments({ thresholdBias: value }) : undefined}
          formatDisplay={(v) => v.toFixed(2)}
          description={PLAYGROUND_FIELD_HELP.thresholdBias}
        />
        <PlaygroundNumberField
          label="Posterize"
          value={adjustments.posterizeLevels}
          inputMin={0}
          inputMax={16}
          sliderMin={0}
          sliderMax={16}
          step={1}
          ariaLabel="Texture posterize levels"
          disabled={disabled}
          onChange={(value) => onAdjustmentsChange({ posterizeLevels: value })}
          onLiveChange={liveAdjustments ? (value) => liveAdjustments({ posterizeLevels: value }) : undefined}
          description={PLAYGROUND_FIELD_HELP.posterize}
        />
        <PlaygroundNumberField
          label="Noise"
          value={adjustments.noiseAmount}
          inputMin={0}
          inputMax={1}
          sliderMin={0}
          sliderMax={0.5}
          step={0.01}
          ariaLabel="Texture luma noise"
          disabled={disabled}
          onChange={(value) => onAdjustmentsChange({ noiseAmount: value })}
          onLiveChange={liveAdjustments ? (value) => liveAdjustments({ noiseAmount: value }) : undefined}
          formatDisplay={(v) => v.toFixed(2)}
          description={PLAYGROUND_FIELD_HELP.noise}
        />
        <PlaygroundNumberField
          label="Blur"
          value={adjustments.blurRadius}
          inputMin={0}
          inputMax={4}
          sliderMin={0}
          sliderMax={4}
          step={1}
          ariaLabel="Texture luma blur"
          disabled={disabled}
          onChange={(value) => onAdjustmentsChange({ blurRadius: value })}
          onLiveChange={liveAdjustments ? (value) => liveAdjustments({ blurRadius: value }) : undefined}
          description={PLAYGROUND_FIELD_HELP.blur}
        />
        <PlaygroundNumberField
          label="Sharpen"
          value={adjustments.sharpenAmount}
          inputMin={0}
          inputMax={4}
          sliderMin={0}
          sliderMax={4}
          step={0.1}
          ariaLabel="Texture luma sharpen"
          disabled={disabled}
          onChange={(value) => onAdjustmentsChange({ sharpenAmount: value })}
          onLiveChange={liveAdjustments ? (value) => liveAdjustments({ sharpenAmount: value }) : undefined}
          formatDisplay={(v) => v.toFixed(1)}
          description={PLAYGROUND_FIELD_HELP.sharpen}
        />
      </PlaygroundControlSection>

      <PlaygroundControlSection
        title="Texture Source"
        testId="playground-section-texture-source"
        modified={sourceModified}
        onReset={onResetSource}
      >
        <label className={`flex flex-col gap-1.5 text-sm ${disabled ? "opacity-40" : ""}`}>
          <span className="flex items-center gap-1.5 text-neutral-600">
            <FieldHelp label="Fit" description={PLAYGROUND_FIELD_HELP.fit} />
          </span>
          <select
            value={sourceTransform.fit}
            disabled={disabled}
            onChange={(event) => onSourceTransformChange({ fit: event.target.value as PlaygroundSourceFit })}
            className="rounded border border-neutral-300 bg-white px-2 py-1.5 disabled:cursor-not-allowed"
            aria-label="Texture fit mode"
          >
            <option value="stretch">Stretch</option>
            <option value="cover">Cover</option>
            <option value="contain">Contain</option>
          </select>
        </label>
        <PlaygroundNumberField
          label="Zoom"
          value={sourceTransform.zoom}
          inputMin={0.1}
          inputMax={8}
          sliderMin={0.5}
          sliderMax={4}
          step={0.01}
          ariaLabel="Texture source zoom"
          disabled={disabled}
          onChange={(value) => onSourceTransformChange({ zoom: value })}
          onLiveChange={liveSource ? (value) => liveSource({ zoom: value }) : undefined}
          formatDisplay={(v) => v.toFixed(2)}
          description={PLAYGROUND_FIELD_HELP.zoom}
        />
        <PlaygroundNumberField
          label="Pan X"
          value={sourceTransform.panX}
          inputMin={-1}
          inputMax={1}
          sliderMin={-1}
          sliderMax={1}
          step={0.01}
          ariaLabel="Texture source pan X"
          disabled={disabled}
          onChange={(value) => onSourceTransformChange({ panX: value })}
          onLiveChange={liveSource ? (value) => liveSource({ panX: value }) : undefined}
          formatDisplay={(v) => v.toFixed(2)}
          description={PLAYGROUND_FIELD_HELP.panX}
        />
        <PlaygroundNumberField
          label="Pan Y"
          value={sourceTransform.panY}
          inputMin={-1}
          inputMax={1}
          sliderMin={-1}
          sliderMax={1}
          step={0.01}
          ariaLabel="Texture source pan Y"
          disabled={disabled}
          onChange={(value) => onSourceTransformChange({ panY: value })}
          onLiveChange={liveSource ? (value) => liveSource({ panY: value }) : undefined}
          formatDisplay={(v) => v.toFixed(2)}
          description={PLAYGROUND_FIELD_HELP.panY}
        />
      </PlaygroundControlSection>
    </>
  );
}
