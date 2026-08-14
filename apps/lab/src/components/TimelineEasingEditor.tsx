import { useEffect, useMemo, useState } from "react";
import { EasingGraph } from "../controls/StripeColorsTable";
import { EASING_OPTIONS, formatCustomEasing, type CustomEasingControlPoints } from "../controls/easing";
import type { TimelineEasing } from "../animation/timelineModel";
import {
  loadTimelineEasingPresets,
  saveTimelineEasingPresets,
  upsertTimelineEasingPreset,
} from "../animation/timelineEasingPresets";

const EXPO_OPTIONS = [
  ["Ease In Expo", "easeInExpo"],
  ["Ease Out Expo", "easeOutExpo"],
  ["Ease In Out Expo", "easeInOutExpo"],
] as const;

const EXPO_VALUES = new Set<string>(EXPO_OPTIONS.map(([, value]) => value));
const LEGACY_TIMELINE_EASINGS = new Set(["easeIn", "easeOut", "easeInOut"]);
const EXPO_CUSTOM_POINTS: CustomEasingControlPoints = { x1: 0.87, y1: 0, x2: 0.13, y2: 1 };
const DEFAULT_CUSTOM_EXPO = formatCustomEasing(EXPO_CUSTOM_POINTS);

export function TimelineEasingEditor({
  keyframeId,
  value,
  onChange,
}: {
  keyframeId: string;
  value: TimelineEasing;
  onChange: (easing: TimelineEasing) => void;
}) {
  const [presets, setPresets] = useState(loadTimelineEasingPresets);
  const [presetName, setPresetName] = useState("");
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const otherOptions = useMemo(
    () =>
      Object.entries(EASING_OPTIONS).filter(
        ([, optionValue]) => !EXPO_VALUES.has(optionValue) && !LEGACY_TIMELINE_EASINGS.has(optionValue),
      ),
    [],
  );
  const selectedPreset = presets.find((preset) => preset.id === selectedPresetId);
  const selectValue = selectedPreset ? `saved:${selectedPreset.id}` : value.startsWith("custom:") ? "__custom" : value;

  useEffect(() => {
    setSelectedPresetId(null);
    setPresetName("");
    setSaved(false);
  }, [keyframeId]);

  const savePreset = () => {
    if (!presetName.trim()) return;
    const result = upsertTimelineEasingPreset(presets, presetName, value);
    setPresets(result.presets);
    saveTimelineEasingPresets(result.presets);
    setSelectedPresetId(result.preset.id);
    setPresetName("");
    setSaved(true);
  };

  return (
    <div className="timeline-easing-editor">
      <label className="timeline-easing-select-row">
        <span>To next key</span>
        <select
          aria-label="Easing to next keyframe"
          value={selectValue}
          onChange={(event) => {
            const next = event.currentTarget.value;
            setSaved(false);
            if (next.startsWith("saved:")) {
              const preset = presets.find((candidate) => `saved:${candidate.id}` === next);
              if (!preset) return;
              setSelectedPresetId(preset.id);
              onChange(preset.easing);
              return;
            }
            setSelectedPresetId(null);
            onChange((next === "__custom" ? DEFAULT_CUSTOM_EXPO : next) as TimelineEasing);
          }}
        >
          <optgroup label="Expo">
            {EXPO_OPTIONS.map(([label, optionValue]) => (
              <option key={optionValue} value={optionValue}>
                {label}
              </option>
            ))}
          </optgroup>
          {presets.length > 0 ? (
            <optgroup label="Saved locally">
              {presets.map((preset) => (
                <option key={preset.id} value={`saved:${preset.id}`}>
                  {preset.name}
                </option>
              ))}
            </optgroup>
          ) : null}
          <optgroup label="Other easing">
            {otherOptions.map(([label, optionValue]) => (
              <option key={optionValue} value={optionValue}>
                {label}
              </option>
            ))}
            <option value="spring">Spring</option>
            <option value="hold">Hold</option>
          </optgroup>
          <option value="__custom">Custom curve</option>
        </select>
      </label>
      <EasingGraph
        value={value}
        editableDefault={EXPO_CUSTOM_POINTS}
        onChange={(next) => {
          setSelectedPresetId(null);
          setSaved(false);
          onChange(next as TimelineEasing);
        }}
      />
      <div className="timeline-easing-save-row">
        <input
          aria-label="Saved easing name"
          maxLength={40}
          placeholder="Name this easing…"
          value={presetName}
          onChange={(event) => {
            setPresetName(event.currentTarget.value);
            setSaved(false);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              savePreset();
            }
          }}
        />
        <button type="button" disabled={!presetName.trim()} onClick={savePreset}>
          {saved ? "Saved" : "Save"}
        </button>
      </div>
    </div>
  );
}
