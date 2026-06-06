import { PlaygroundControlSection } from "./PlaygroundControlSection";
import { PlaygroundNumberField } from "./PlaygroundNumberField";
import { FieldHelp } from "./FieldHelp";
import { PLAYGROUND_CONTROL_INPUT_BOUNDS, PLAYGROUND_CONTROL_RANGES } from "./playgroundControlRanges";
import { PLAYGROUND_FIELD_HELP } from "./playgroundFieldHelp";
import type { PlaygroundFlamesConfig, PlaygroundFlamesDirection } from "./playgroundFlamesConfig";

export type PlaygroundFlamesControlsProps = {
  config: PlaygroundFlamesConfig;
  disabled: boolean;
  modified: boolean;
  onReset: () => void;
  onChange: (patch: Partial<PlaygroundFlamesConfig>) => void;
  onLiveChange: (patch: Partial<PlaygroundFlamesConfig>) => void;
};

export function PlaygroundFlamesControls({
  config,
  disabled,
  modified,
  onReset,
  onChange,
  onLiveChange,
}: PlaygroundFlamesControlsProps) {
  const fieldsDisabled = disabled || !config.enabled;
  const ratio = PLAYGROUND_CONTROL_RANGES.flamesSizeRatio;
  const ratioBounds = PLAYGROUND_CONTROL_INPUT_BOUNDS.flamesSizeRatio;

  return (
    <PlaygroundControlSection
      title="Background Flames"
      testId="playground-section-flames"
      modified={modified}
      onReset={onReset}
    >
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={config.enabled}
          onChange={(event) => onChange({ enabled: event.target.checked })}
          className="size-4 cursor-pointer rounded border-neutral-300"
          aria-label="Background flames enabled"
          disabled={disabled}
        />
        <span className="flex items-center gap-1.5 text-neutral-800">
          <FieldHelp label="Enabled" description={PLAYGROUND_FIELD_HELP.flamesEnabled} />
        </span>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="flex items-center gap-1.5 text-neutral-800">
          <FieldHelp label="Direction" description={PLAYGROUND_FIELD_HELP.flamesDirection} />
        </span>
        <select
          value={config.direction}
          disabled={fieldsDisabled}
          onChange={(event) => onChange({ direction: event.target.value as PlaygroundFlamesDirection })}
          className="rounded border border-neutral-300 bg-white px-2 py-1.5 disabled:cursor-not-allowed"
          aria-label="Flame travel direction"
        >
          <option value="up">Up</option>
          <option value="down">Down</option>
          <option value="left">Left</option>
          <option value="right">Right</option>
        </select>
      </label>
      <PlaygroundNumberField
        label="Width min"
        value={config.minWidthRatio * 100}
        inputMin={ratioBounds.min * 100}
        inputMax={ratioBounds.max * 100}
        sliderMin={ratio.min * 100}
        sliderMax={ratio.max * 100}
        step={ratio.step * 100}
        ariaLabel="Flame minimum width percent"
        disabled={fieldsDisabled}
        onChange={(value) => onChange({ minWidthRatio: value / 100 })}
        onLiveChange={(value) => onLiveChange({ minWidthRatio: value / 100 })}
        formatDisplay={(v) => `${v.toFixed(2)}%`}
        description={PLAYGROUND_FIELD_HELP.flamesWidthMin}
      />
      <PlaygroundNumberField
        label="Width max"
        value={config.maxWidthRatio * 100}
        inputMin={ratioBounds.min * 100}
        inputMax={ratioBounds.max * 100}
        sliderMin={ratio.min * 100}
        sliderMax={ratio.max * 100}
        step={ratio.step * 100}
        ariaLabel="Flame maximum width percent"
        disabled={fieldsDisabled}
        onChange={(value) => onChange({ maxWidthRatio: value / 100 })}
        onLiveChange={(value) => onLiveChange({ maxWidthRatio: value / 100 })}
        formatDisplay={(v) => `${v.toFixed(2)}%`}
        description={PLAYGROUND_FIELD_HELP.flamesWidthMax}
      />
      <PlaygroundNumberField
        label="Height min"
        value={config.minHeightRatio * 100}
        inputMin={ratioBounds.min * 100}
        inputMax={ratioBounds.max * 100}
        sliderMin={ratio.min * 100}
        sliderMax={ratio.max * 100}
        step={ratio.step * 100}
        ariaLabel="Flame minimum height percent"
        disabled={fieldsDisabled}
        onChange={(value) => onChange({ minHeightRatio: value / 100 })}
        onLiveChange={(value) => onLiveChange({ minHeightRatio: value / 100 })}
        formatDisplay={(v) => `${v.toFixed(2)}%`}
        description={PLAYGROUND_FIELD_HELP.flamesHeightMin}
      />
      <PlaygroundNumberField
        label="Height max"
        value={config.maxHeightRatio * 100}
        inputMin={ratioBounds.min * 100}
        inputMax={ratioBounds.max * 100}
        sliderMin={ratio.min * 100}
        sliderMax={ratio.max * 100}
        step={ratio.step * 100}
        ariaLabel="Flame maximum height percent"
        disabled={fieldsDisabled}
        onChange={(value) => onChange({ maxHeightRatio: value / 100 })}
        onLiveChange={(value) => onLiveChange({ maxHeightRatio: value / 100 })}
        formatDisplay={(v) => `${v.toFixed(2)}%`}
        description={PLAYGROUND_FIELD_HELP.flamesHeightMax}
      />
      <PlaygroundNumberField
        label="Speed"
        value={config.baseSpeedPxPerSec}
        inputMin={PLAYGROUND_CONTROL_INPUT_BOUNDS.flamesSpeed.min}
        inputMax={PLAYGROUND_CONTROL_INPUT_BOUNDS.flamesSpeed.max}
        sliderMin={PLAYGROUND_CONTROL_RANGES.flamesSpeed.min}
        sliderMax={PLAYGROUND_CONTROL_RANGES.flamesSpeed.max}
        step={PLAYGROUND_CONTROL_RANGES.flamesSpeed.step}
        ariaLabel="Flame base speed"
        disabled={fieldsDisabled}
        onChange={(value) => onChange({ baseSpeedPxPerSec: value })}
        onLiveChange={(value) => onLiveChange({ baseSpeedPxPerSec: value })}
        formatDisplay={(v) => `${Math.round(v)} px/s`}
        description={PLAYGROUND_FIELD_HELP.flamesSpeed}
      />
      <PlaygroundNumberField
        label="Speed variation"
        value={config.speedVariation}
        inputMin={PLAYGROUND_CONTROL_INPUT_BOUNDS.flamesSpeedVariation.min}
        inputMax={PLAYGROUND_CONTROL_INPUT_BOUNDS.flamesSpeedVariation.max}
        sliderMin={PLAYGROUND_CONTROL_RANGES.flamesSpeedVariation.min}
        sliderMax={PLAYGROUND_CONTROL_RANGES.flamesSpeedVariation.max}
        step={PLAYGROUND_CONTROL_RANGES.flamesSpeedVariation.step}
        ariaLabel="Flame speed variation"
        disabled={fieldsDisabled}
        onChange={(value) => onChange({ speedVariation: value })}
        onLiveChange={(value) => onLiveChange({ speedVariation: value })}
        formatDisplay={(v) => v.toFixed(2)}
        description={PLAYGROUND_FIELD_HELP.flamesSpeedVariation}
      />
      <PlaygroundNumberField
        label="Spawn interval"
        value={config.spawnIntervalMs}
        inputMin={PLAYGROUND_CONTROL_INPUT_BOUNDS.flamesSpawnIntervalMs.min}
        inputMax={PLAYGROUND_CONTROL_INPUT_BOUNDS.flamesSpawnIntervalMs.max}
        sliderMin={PLAYGROUND_CONTROL_RANGES.flamesSpawnIntervalMs.min}
        sliderMax={PLAYGROUND_CONTROL_RANGES.flamesSpawnIntervalMs.max}
        step={PLAYGROUND_CONTROL_RANGES.flamesSpawnIntervalMs.step}
        ariaLabel="Flame spawn interval milliseconds"
        disabled={fieldsDisabled}
        onChange={(value) => onChange({ spawnIntervalMs: value })}
        onLiveChange={(value) => onLiveChange({ spawnIntervalMs: value })}
        formatDisplay={(v) => `${Math.round(v)} ms`}
        description={PLAYGROUND_FIELD_HELP.flamesSpawnInterval}
      />
      <PlaygroundNumberField
        label="Spawn jitter"
        value={config.spawnJitterMs}
        inputMin={PLAYGROUND_CONTROL_INPUT_BOUNDS.flamesSpawnJitterMs.min}
        inputMax={PLAYGROUND_CONTROL_INPUT_BOUNDS.flamesSpawnJitterMs.max}
        sliderMin={PLAYGROUND_CONTROL_RANGES.flamesSpawnJitterMs.min}
        sliderMax={PLAYGROUND_CONTROL_RANGES.flamesSpawnJitterMs.max}
        step={PLAYGROUND_CONTROL_RANGES.flamesSpawnJitterMs.step}
        ariaLabel="Flame spawn jitter milliseconds"
        disabled={fieldsDisabled}
        onChange={(value) => onChange({ spawnJitterMs: value })}
        onLiveChange={(value) => onLiveChange({ spawnJitterMs: value })}
        formatDisplay={(v) => `${Math.round(v)} ms`}
        description={PLAYGROUND_FIELD_HELP.flamesSpawnJitter}
      />
      <PlaygroundNumberField
        label="Max active"
        value={config.maxActive}
        inputMin={PLAYGROUND_CONTROL_INPUT_BOUNDS.flamesMaxActive.min}
        inputMax={PLAYGROUND_CONTROL_INPUT_BOUNDS.flamesMaxActive.max}
        sliderMin={PLAYGROUND_CONTROL_RANGES.flamesMaxActive.min}
        sliderMax={PLAYGROUND_CONTROL_RANGES.flamesMaxActive.max}
        step={PLAYGROUND_CONTROL_RANGES.flamesMaxActive.step}
        ariaLabel="Maximum active flames"
        disabled={fieldsDisabled}
        onChange={(value) => onChange({ maxActive: value })}
        onLiveChange={(value) => onLiveChange({ maxActive: value })}
        formatDisplay={(v) => `${Math.round(v)}`}
        description={PLAYGROUND_FIELD_HELP.flamesMaxActive}
      />
      <PlaygroundNumberField
        label="Edge sharpness"
        value={config.edgeSharpness}
        inputMin={PLAYGROUND_CONTROL_INPUT_BOUNDS.flamesEdgeSharpness.min}
        inputMax={PLAYGROUND_CONTROL_INPUT_BOUNDS.flamesEdgeSharpness.max}
        sliderMin={PLAYGROUND_CONTROL_RANGES.flamesEdgeSharpness.min}
        sliderMax={PLAYGROUND_CONTROL_RANGES.flamesEdgeSharpness.max}
        step={PLAYGROUND_CONTROL_RANGES.flamesEdgeSharpness.step}
        ariaLabel="Flame edge sharpness"
        disabled={fieldsDisabled}
        onChange={(value) => onChange({ edgeSharpness: value })}
        onLiveChange={(value) => onLiveChange({ edgeSharpness: value })}
        formatDisplay={(v) => v.toFixed(2)}
        description={PLAYGROUND_FIELD_HELP.flamesEdgeSharpness}
      />
    </PlaygroundControlSection>
  );
}
