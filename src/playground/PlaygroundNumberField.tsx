import { useCallback, useEffect, useRef, useState } from "react";
import { ControlValueInput } from "./ControlValueInput";
import { FieldHelp } from "./FieldHelp";

export type PlaygroundNumberFieldProps = {
  label: string;
  value: number;
  inputMin: number;
  inputMax: number;
  sliderMin: number;
  sliderMax: number;
  step: number;
  ariaLabel: string;
  disabled: boolean;
  /** Commits the final value (pointer up, typed input, or when live updates are disabled). */
  onChange: (value: number) => void;
  /** Fires on every range scrub step for immediate canvas updates. */
  onLiveChange?: (value: number) => void;
  formatDisplay?: (value: number) => string;
  description: string;
  commitMin?: number;
  commitMax?: number;
};

export function PlaygroundNumberField({
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
  onLiveChange,
  formatDisplay,
  description,
  commitMin = inputMin,
  commitMax = inputMax,
}: PlaygroundNumberFieldProps) {
  const [scrubbing, setScrubbing] = useState(false);
  const [scrubValue, setScrubValue] = useState<number | null>(null);
  const scrubValueRef = useRef<number | null>(null);

  const displayValue = scrubbing && scrubValue !== null ? scrubValue : value;
  const sliderValue = Math.min(sliderMax, Math.max(sliderMin, displayValue));

  useEffect(() => {
    if (!scrubbing) {
      setScrubValue(null);
      scrubValueRef.current = null;
    }
  }, [value, scrubbing]);

  const emitLive = useCallback(
    (next: number) => {
      if (onLiveChange) {
        onLiveChange(next);
      } else {
        onChange(next);
      }
    },
    [onChange, onLiveChange],
  );

  const onSliderInput = (next: number) => {
    setScrubValue(next);
    scrubValueRef.current = next;
    emitLive(next);
  };

  const endScrub = () => {
    const finalValue = scrubValueRef.current;
    setScrubbing(false);
    setScrubValue(null);
    scrubValueRef.current = null;
    if (finalValue !== null && finalValue !== value) {
      onChange(finalValue);
    }
  };

  return (
    <label className={`flex flex-col gap-1.5 text-sm ${disabled ? "opacity-40" : ""}`}>
      <span className="flex items-center justify-between gap-2 text-neutral-600">
        <span className="flex min-w-0 items-center gap-1.5">
          <FieldHelp label={label} description={description} />
        </span>
        <ControlValueInput
          value={displayValue}
          inputMin={inputMin}
          inputMax={inputMax}
          commitMin={commitMin}
          commitMax={commitMax}
          disabled={disabled}
          onChange={(next) => {
            emitLive(next);
            onChange(next);
          }}
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
        onPointerDown={() => setScrubbing(true)}
        onPointerUp={endScrub}
        onPointerCancel={endScrub}
        onInput={(event) => onSliderInput(Number(event.currentTarget.value))}
        className="w-full accent-neutral-700 disabled:cursor-not-allowed"
        aria-label={`${ariaLabel} slider`}
      />
    </label>
  );
}
