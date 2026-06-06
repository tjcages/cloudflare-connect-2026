import { FieldHelp } from "./FieldHelp";
import { PlaygroundControlSection } from "./PlaygroundControlSection";
import { PlaygroundNumberField } from "./PlaygroundNumberField";
import { PLAYGROUND_CONTROL_INPUT_BOUNDS, PLAYGROUND_CONTROL_RANGES } from "./playgroundControlRanges";
import { PLAYGROUND_FIELD_HELP } from "./playgroundFieldHelp";
import type {
  PlaygroundRevealConfig,
  PlaygroundRevealPreset,
  PlaygroundRandomColumnsRevealConfig,
  PlaygroundWaveRevealConfig,
  PlaygroundWaveRevealPosition,
} from "./playgroundRevealConfig";

const WAVE_POSITIONS: { value: PlaygroundWaveRevealPosition; label: string }[] = [
  { value: "left top", label: "Left top" },
  { value: "center top", label: "Center top" },
  { value: "right top", label: "Right top" },
  { value: "left center", label: "Left center" },
  { value: "center", label: "Center" },
  { value: "right center", label: "Right center" },
  { value: "left bottom", label: "Left bottom" },
  { value: "center bottom", label: "Center bottom" },
  { value: "right bottom", label: "Right bottom" },
];

export type PlaygroundRevealControlsProps = {
  config: PlaygroundRevealConfig;
  disabled: boolean;
  modified: boolean;
  onReset: () => void;
  onReplay: () => void;
  onChange: (patch: Partial<PlaygroundRevealConfig>) => void;
  onLiveWaveChange: (patch: Partial<PlaygroundWaveRevealConfig>) => void;
  onLiveRandomColumnsChange: (patch: Partial<PlaygroundRandomColumnsRevealConfig>) => void;
};

export function PlaygroundRevealControls({
  config,
  disabled,
  modified,
  onReset,
  onReplay,
  onChange,
  onLiveWaveChange,
  onLiveRandomColumnsChange,
}: PlaygroundRevealControlsProps) {
  const updateWave = (patch: Partial<PlaygroundWaveRevealConfig>) => onChange({ wave: { ...config.wave, ...patch } });
  const liveWave = (patch: Partial<PlaygroundWaveRevealConfig>) => onLiveWaveChange(patch);
  const updateRandomColumns = (patch: Partial<PlaygroundRandomColumnsRevealConfig>) =>
    onChange({ randomColumns: { ...config.randomColumns, ...patch } });
  const liveRandomColumns = (patch: Partial<PlaygroundRandomColumnsRevealConfig>) => onLiveRandomColumnsChange(patch);

  return (
    <PlaygroundControlSection
      title="Reveal"
      testId="playground-section-reveal"
      modified={modified}
      onReset={onReset}
      defaultOpen
    >
      <label className={`flex flex-col gap-1.5 text-sm ${disabled ? "opacity-40" : ""}`}>
        <span className="flex items-center gap-1.5 text-neutral-600">
          <FieldHelp label="Preset" description={PLAYGROUND_FIELD_HELP.revealPreset} />
        </span>
        <select
          value={config.preset}
          disabled={disabled}
          onChange={(event) => onChange({ preset: event.target.value as PlaygroundRevealPreset })}
          className="rounded border border-neutral-300 bg-white px-2 py-1.5 disabled:cursor-not-allowed"
          aria-label="Reveal preset"
        >
          <option value="wave">Wave</option>
          <option value="randomColumns">Random columns</option>
        </select>
      </label>

      {config.preset === "wave" ? (
        <>
          <label className={`flex flex-col gap-1.5 text-sm ${disabled ? "opacity-40" : ""}`}>
            <span className="flex items-center gap-1.5 text-neutral-600">
              <FieldHelp label="Position" description={PLAYGROUND_FIELD_HELP.revealPosition} />
            </span>
            <select
              value={config.wave.position}
              disabled={disabled}
              onChange={(event) => updateWave({ position: event.target.value as PlaygroundWaveRevealPosition })}
              className="rounded border border-neutral-300 bg-white px-2 py-1.5 disabled:cursor-not-allowed"
              aria-label="Wave reveal position"
            >
              {WAVE_POSITIONS.map((position) => (
                <option key={position.value} value={position.value}>
                  {position.label}
                </option>
              ))}
            </select>
          </label>
          <PlaygroundNumberField
            label="Duration"
            value={config.wave.durationMs}
            inputMin={PLAYGROUND_CONTROL_INPUT_BOUNDS.revealDurationMs.min}
            inputMax={PLAYGROUND_CONTROL_INPUT_BOUNDS.revealDurationMs.max}
            sliderMin={PLAYGROUND_CONTROL_RANGES.revealDurationMs.min}
            sliderMax={PLAYGROUND_CONTROL_RANGES.revealDurationMs.max}
            step={PLAYGROUND_CONTROL_RANGES.revealDurationMs.step}
            ariaLabel="Wave reveal duration milliseconds"
            disabled={disabled}
            onChange={(value) => updateWave({ durationMs: value })}
            onLiveChange={(value) => liveWave({ durationMs: value })}
            formatDisplay={(v) => `${Math.round(v)} ms`}
            description={PLAYGROUND_FIELD_HELP.revealDuration}
          />
          <PlaygroundNumberField
            label="Softness"
            value={config.wave.softness}
            inputMin={PLAYGROUND_CONTROL_INPUT_BOUNDS.revealSoftness.min}
            inputMax={PLAYGROUND_CONTROL_INPUT_BOUNDS.revealSoftness.max}
            sliderMin={PLAYGROUND_CONTROL_RANGES.revealSoftness.min}
            sliderMax={PLAYGROUND_CONTROL_RANGES.revealSoftness.max}
            step={PLAYGROUND_CONTROL_RANGES.revealSoftness.step}
            ariaLabel="Wave reveal softness"
            disabled={disabled}
            onChange={(value) => updateWave({ softness: value })}
            onLiveChange={(value) => liveWave({ softness: value })}
            formatDisplay={(v) => v.toFixed(2)}
            description={PLAYGROUND_FIELD_HELP.revealSoftness}
          />
          <PlaygroundNumberField
            label="Waviness"
            value={config.wave.waviness}
            inputMin={PLAYGROUND_CONTROL_INPUT_BOUNDS.revealWaviness.min}
            inputMax={PLAYGROUND_CONTROL_INPUT_BOUNDS.revealWaviness.max}
            sliderMin={PLAYGROUND_CONTROL_RANGES.revealWaviness.min}
            sliderMax={PLAYGROUND_CONTROL_RANGES.revealWaviness.max}
            step={PLAYGROUND_CONTROL_RANGES.revealWaviness.step}
            ariaLabel="Wave reveal waviness"
            disabled={disabled}
            onChange={(value) => updateWave({ waviness: value })}
            onLiveChange={(value) => liveWave({ waviness: value })}
            formatDisplay={(v) => v.toFixed(2)}
            description={PLAYGROUND_FIELD_HELP.revealWaviness}
          />
          <PlaygroundNumberField
            label="Noise scale"
            value={config.wave.noiseScale}
            inputMin={PLAYGROUND_CONTROL_INPUT_BOUNDS.revealNoiseScale.min}
            inputMax={PLAYGROUND_CONTROL_INPUT_BOUNDS.revealNoiseScale.max}
            sliderMin={PLAYGROUND_CONTROL_RANGES.revealNoiseScale.min}
            sliderMax={PLAYGROUND_CONTROL_RANGES.revealNoiseScale.max}
            step={PLAYGROUND_CONTROL_RANGES.revealNoiseScale.step}
            ariaLabel="Wave reveal noise scale"
            disabled={disabled}
            onChange={(value) => updateWave({ noiseScale: value })}
            onLiveChange={(value) => liveWave({ noiseScale: value })}
            formatDisplay={(v) => v.toFixed(1)}
            description={PLAYGROUND_FIELD_HELP.revealNoiseScale}
          />
        </>
      ) : null}

      {config.preset === "randomColumns" ? (
        <>
          <PlaygroundNumberField
            label="Duration"
            value={config.randomColumns.durationMs}
            inputMin={PLAYGROUND_CONTROL_INPUT_BOUNDS.revealDurationMs.min}
            inputMax={PLAYGROUND_CONTROL_INPUT_BOUNDS.revealDurationMs.max}
            sliderMin={PLAYGROUND_CONTROL_RANGES.revealDurationMs.min}
            sliderMax={PLAYGROUND_CONTROL_RANGES.revealDurationMs.max}
            step={PLAYGROUND_CONTROL_RANGES.revealDurationMs.step}
            ariaLabel="Random columns reveal duration milliseconds"
            disabled={disabled}
            onChange={(value) => updateRandomColumns({ durationMs: value })}
            onLiveChange={(value) => liveRandomColumns({ durationMs: value })}
            formatDisplay={(v) => `${Math.round(v)} ms`}
            description={PLAYGROUND_FIELD_HELP.revealDuration}
          />
          <PlaygroundNumberField
            label="Stagger"
            value={config.randomColumns.stagger}
            inputMin={PLAYGROUND_CONTROL_INPUT_BOUNDS.revealColumnStagger.min}
            inputMax={PLAYGROUND_CONTROL_INPUT_BOUNDS.revealColumnStagger.max}
            sliderMin={PLAYGROUND_CONTROL_RANGES.revealColumnStagger.min}
            sliderMax={PLAYGROUND_CONTROL_RANGES.revealColumnStagger.max}
            step={PLAYGROUND_CONTROL_RANGES.revealColumnStagger.step}
            ariaLabel="Random columns reveal stagger"
            disabled={disabled}
            onChange={(value) => updateRandomColumns({ stagger: value })}
            onLiveChange={(value) => liveRandomColumns({ stagger: value })}
            formatDisplay={(v) => v.toFixed(2)}
            description={PLAYGROUND_FIELD_HELP.revealColumnStagger}
          />
          <PlaygroundNumberField
            label="Y shift"
            value={config.randomColumns.yShift}
            inputMin={PLAYGROUND_CONTROL_INPUT_BOUNDS.revealColumnYShift.min}
            inputMax={PLAYGROUND_CONTROL_INPUT_BOUNDS.revealColumnYShift.max}
            sliderMin={PLAYGROUND_CONTROL_RANGES.revealColumnYShift.min}
            sliderMax={PLAYGROUND_CONTROL_RANGES.revealColumnYShift.max}
            step={PLAYGROUND_CONTROL_RANGES.revealColumnYShift.step}
            ariaLabel="Random columns reveal y shift"
            disabled={disabled}
            onChange={(value) => updateRandomColumns({ yShift: value })}
            onLiveChange={(value) => liveRandomColumns({ yShift: value })}
            formatDisplay={(v) => `${Math.round(v * 100)}%`}
            description={PLAYGROUND_FIELD_HELP.revealColumnYShift}
          />
        </>
      ) : null}

      <button
        type="button"
        className="rounded border border-neutral-300 bg-white px-3 py-1.5 text-sm hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40"
        disabled={disabled}
        onClick={onReplay}
      >
        Replay
      </button>
    </PlaygroundControlSection>
  );
}
