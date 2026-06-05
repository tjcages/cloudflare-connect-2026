import { ControlValueInput } from "./ControlValueInput";
import { PlaygroundControlSection } from "./PlaygroundControlSection";
import type { PlaygroundSourceFit, PlaygroundSourceTransform } from "./playgroundSourceTransform";
import type { PlaygroundTextureAdjustments } from "./playgroundTextureAdjustments";

type PlaygroundTextureControlsProps = {
  adjustments: PlaygroundTextureAdjustments;
  sourceTransform: PlaygroundSourceTransform;
  onAdjustmentsChange: (patch: Partial<PlaygroundTextureAdjustments>) => void;
  onSourceTransformChange: (patch: Partial<PlaygroundSourceTransform>) => void;
  onResetTone: () => void;
  onResetSource: () => void;
  onResetEffects: () => void;
  toneModified: boolean;
  sourceModified: boolean;
  effectsModified: boolean;
  disabled: boolean;
};

type NumberFieldProps = {
  label: string;
  value: number;
  inputMin: number;
  inputMax: number;
  sliderMin: number;
  sliderMax: number;
  step: number;
  ariaLabel: string;
  disabled: boolean;
  onChange: (value: number) => void;
  formatDisplay?: (value: number) => string;
};

function NumberField({
  label,
  value,
  inputMin,
  inputMax,
  sliderMin,
  sliderMax,
  step,
  ariaLabel,
  disabled,
  onChange,
  formatDisplay,
}: NumberFieldProps) {
  const sliderValue = Math.min(sliderMax, Math.max(sliderMin, value));
  return (
    <label className={`flex flex-col gap-1.5 text-sm ${disabled ? "opacity-40" : ""}`}>
      <span className="flex items-center justify-between gap-2 text-neutral-600">
        <span>{label}</span>
        <ControlValueInput
          value={value}
          inputMin={inputMin}
          inputMax={inputMax}
          commitMin={inputMin}
          commitMax={inputMax}
          disabled={disabled}
          onChange={onChange}
          formatDisplay={formatDisplay}
          ariaLabel={ariaLabel}
        />
      </span>
      <input
        type="range"
        min={sliderMin}
        max={sliderMax}
        step={step}
        value={sliderValue}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-neutral-700 disabled:cursor-not-allowed"
        aria-label={`${ariaLabel} slider`}
      />
    </label>
  );
}

export function PlaygroundTextureControls({
  adjustments,
  sourceTransform,
  onAdjustmentsChange,
  onSourceTransformChange,
  onResetTone,
  onResetSource,
  onResetEffects,
  toneModified,
  sourceModified,
  effectsModified,
  disabled,
}: PlaygroundTextureControlsProps) {
  return (
    <>
      <PlaygroundControlSection
        title="Texture Tone"
        testId="playground-section-texture-tone"
        modified={toneModified}
        onReset={onResetTone}
      >
        <NumberField
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
          formatDisplay={(v) => v.toFixed(2)}
        />
        <NumberField
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
          formatDisplay={(v) => v.toFixed(2)}
        />
        <NumberField
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
          formatDisplay={(v) => v.toFixed(2)}
        />
        <NumberField
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
          formatDisplay={(v) => String(v)}
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
          <span className="text-neutral-800">Invert luminance</span>
        </label>
      </PlaygroundControlSection>

      <PlaygroundControlSection
        title="Texture Levels"
        testId="playground-section-texture-levels"
        modified={effectsModified}
        onReset={onResetEffects}
      >
        <NumberField
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
          formatDisplay={(v) => v.toFixed(2)}
        />
        <NumberField
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
          formatDisplay={(v) => v.toFixed(2)}
        />
        <NumberField
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
          formatDisplay={(v) => v.toFixed(2)}
        />
        <NumberField
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
        />
        <NumberField
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
          formatDisplay={(v) => v.toFixed(2)}
        />
        <NumberField
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
        />
        <NumberField
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
          formatDisplay={(v) => v.toFixed(1)}
        />
      </PlaygroundControlSection>

      <PlaygroundControlSection
        title="Texture Source"
        testId="playground-section-texture-source"
        modified={sourceModified}
        onReset={onResetSource}
      >
        <label className={`flex flex-col gap-1.5 text-sm ${disabled ? "opacity-40" : ""}`}>
          <span className="text-neutral-600">Fit</span>
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
        <NumberField
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
          formatDisplay={(v) => v.toFixed(2)}
        />
        <NumberField
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
          formatDisplay={(v) => v.toFixed(2)}
        />
        <NumberField
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
          formatDisplay={(v) => v.toFixed(2)}
        />
      </PlaygroundControlSection>
    </>
  );
}
