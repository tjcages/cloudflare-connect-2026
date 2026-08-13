import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  ChevronDown,
  ChevronRight,
  Diamond,
  Pause,
  Play,
  Plus,
  Repeat2,
  Search,
  SkipBack,
  Trash2,
  X,
} from "lucide-react";
import {
  clampTimelineTime,
  createTimelineId,
  evaluateSequence,
  loadTimelineSequence,
  saveTimelineSequence,
  sortKeyframes,
  upsertKeyframe,
  type TimelineEasing,
  type TimelineKeyframe,
  type TimelineProperty,
  type TimelineSequence,
  type TimelineTrack,
  type TimelineValue,
} from "../animation/timelineModel";

type LevaDataInput = {
  type: string;
  value: unknown;
  label: string | { toString(): string };
  disabled?: boolean;
  settings?: { min?: number; max?: number; step?: number; options?: unknown };
};

export type TimelineLevaStore = {
  getData: () => Record<string, LevaDataInput>;
  getVisiblePaths: () => string[];
  set: (values: Record<string, TimelineValue>, fromPanel: boolean) => void;
};

type TimelineEditorProps = {
  open: boolean;
  stores: readonly TimelineLevaStore[];
  onOpenChange: (open: boolean) => void;
  onApplyValues: (values: Record<string, TimelineValue>) => void;
  onTimeChange?: (seconds: number) => void;
};

const EASING_OPTIONS: Array<{ value: TimelineEasing; label: string }> = [
  { value: "linear", label: "Linear" },
  { value: "easeIn", label: "Ease in" },
  { value: "easeOut", label: "Ease out" },
  { value: "easeInOut", label: "Ease in + out" },
  { value: "spring", label: "Spring" },
  { value: "hold", label: "Hold" },
];

function inputLabel(input: LevaDataInput, key: string): string {
  return typeof input.label === "string" && input.label.trim() ? input.label : key.replace(/([A-Z])/g, " $1").trim();
}

function timelinePropertyFromInput(path: string, input: LevaDataInput): TimelineProperty | null {
  if (input.disabled) return null;
  const value = input.value;
  if (typeof value !== "number" && typeof value !== "string" && typeof value !== "boolean") return null;
  if (["BUTTON", "BUTTON_GROUP", "MONITOR", "STRING"].includes(input.type) && typeof value === "string") return null;
  const parts = path.split(".");
  const key = parts.at(-1) ?? path;
  const group = parts.length > 1 ? parts.slice(0, -1).join(" / ") : "General";
  const isColor = typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
  return {
    key,
    path,
    group,
    label: inputLabel(input, key),
    value: value as TimelineValue,
    valueType: typeof value === "number" ? "number" : isColor ? "color" : "discrete",
    min: input.settings?.min,
    max: input.settings?.max,
    step: input.settings?.step,
  };
}

export function collectTimelineProperties(stores: readonly TimelineLevaStore[]): TimelineProperty[] {
  const properties = new Map<string, TimelineProperty>();
  for (const store of stores) {
    const data = store.getData();
    for (const path of store.getVisiblePaths()) {
      const property = data[path] ? timelinePropertyFromInput(path, data[path]) : null;
      if (property && !properties.has(property.key)) properties.set(property.key, property);
    }
  }
  return [...properties.values()].sort((a, b) => a.group.localeCompare(b.group) || a.label.localeCompare(b.label));
}

function formatSeconds(time: number): string {
  const minutes = Math.floor(time / 60);
  const seconds = time - minutes * 60;
  return minutes > 0 ? `${minutes}:${seconds.toFixed(1).padStart(4, "0")}` : `${seconds.toFixed(2)}s`;
}

function displayValue(value: TimelineValue): string {
  if (typeof value === "number") return Number(value.toFixed(3)).toString();
  if (typeof value === "boolean") return value ? "On" : "Off";
  return value;
}

function rulerStep(duration: number): number {
  if (duration <= 5) return 0.5;
  if (duration <= 15) return 1;
  if (duration <= 40) return 2;
  if (duration <= 90) return 5;
  return 10;
}

function PropertyPicker({
  properties,
  tracks,
  onAdd,
}: {
  properties: TimelineProperty[];
  tracks: TimelineTrack[];
  onAdd: (property: TimelineProperty) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const tracked = useMemo(() => new Set(tracks.map((track) => track.propertyKey)), [tracks]);
  const filtered = properties.filter(
    (property) =>
      !tracked.has(property.key) &&
      `${property.group} ${property.label}`.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const groups = filtered.reduce<Record<string, TimelineProperty[]>>((result, property) => {
    (result[property.group] ??= []).push(property);
    return result;
  }, {});

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [open]);

  return (
    <div className="timeline-property-picker" ref={containerRef}>
      <button type="button" className="timeline-add-property" onClick={() => setOpen((value) => !value)}>
        <Plus size={12} /> Add property <ChevronDown size={11} />
      </button>
      {open ? (
        <div className="timeline-property-menu">
          <label className="timeline-property-search">
            <Search size={12} />
            <input
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
              placeholder="Search every control…"
            />
          </label>
          <div className="timeline-property-results ui-scroll-hidden">
            {Object.entries(groups).map(([group, entries]) => (
              <section key={group}>
                <h4>{group}</h4>
                {entries?.map((property) => (
                  <button
                    type="button"
                    key={property.path}
                    onClick={() => {
                      onAdd(property);
                      setOpen(false);
                      setQuery("");
                    }}
                  >
                    <span>{property.label}</span>
                    <small>{displayValue(property.value)}</small>
                  </button>
                ))}
              </section>
            ))}
            {filtered.length === 0 ? <p>No matching controls</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function TimelineEditor({ open, stores, onOpenChange, onApplyValues, onTimeChange }: TimelineEditorProps) {
  const [sequence, setSequence] = useState<TimelineSequence>(loadTimelineSequence);
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [selectedKeyId, setSelectedKeyId] = useState<string | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const sequenceRef = useRef(sequence);
  const timeRef = useRef(currentTime);
  const properties = collectTimelineProperties(stores);
  sequenceRef.current = sequence;
  timeRef.current = currentTime;

  const updateTime = useCallback(
    (time: number) => {
      const next = clampTimelineTime(time, sequenceRef.current.duration);
      timeRef.current = next;
      setCurrentTime(next);
      onApplyValues(evaluateSequence(sequenceRef.current, next));
      onTimeChange?.(next);
    },
    [onApplyValues, onTimeChange],
  );

  useEffect(() => saveTimelineSequence(sequence), [sequence]);

  useEffect(() => {
    onApplyValues(evaluateSequence(sequence, timeRef.current));
  }, [onApplyValues, sequence]);

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let previous = performance.now();
    const tick = (now: number) => {
      const elapsed = Math.min(0.1, (now - previous) / 1000);
      previous = now;
      let next = timeRef.current + elapsed;
      if (next >= sequenceRef.current.duration) {
        if (sequenceRef.current.loop) next %= sequenceRef.current.duration;
        else {
          next = sequenceRef.current.duration;
          setPlaying(false);
        }
      }
      updateTime(next);
      if (next < sequenceRef.current.duration || sequenceRef.current.loop) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, updateTime]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target.isContentEditable) return;
      if (event.code === "Space" && open) {
        event.preventDefault();
        setPlaying((value) => !value);
      }
      if ((event.key === "Delete" || event.key === "Backspace") && selectedKeyId) {
        event.preventDefault();
        setSequence((current) => ({
          ...current,
          tracks: current.tracks.map((track) => ({
            ...track,
            keyframes: track.keyframes.filter((keyframe) => keyframe.id !== selectedKeyId),
          })),
        }));
        setSelectedKeyId(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, selectedKeyId]);

  const currentProperties = useMemo(
    () => new Map(properties.map((property) => [property.key, property])),
    [properties],
  );
  const selectedTrack = sequence.tracks.find((track) => track.id === selectedTrackId) ?? null;
  const selectedKey = selectedTrack?.keyframes.find((keyframe) => keyframe.id === selectedKeyId) ?? null;
  const selectedProperty = selectedTrack ? currentProperties.get(selectedTrack.propertyKey) : null;
  const ticks = useMemo(() => {
    const step = rulerStep(sequence.duration);
    return Array.from({ length: Math.floor(sequence.duration / step) + 1 }, (_, index) => index * step);
  }, [sequence.duration]);

  const addTrack = (property: TimelineProperty) => {
    const track: TimelineTrack = {
      id: createTimelineId("track"),
      propertyKey: property.key,
      propertyPath: property.path,
      label: property.label,
      valueType: property.valueType,
      keyframes: [{ id: createTimelineId("key"), time: currentTime, value: property.value, easing: "easeInOut" }],
    };
    setSequence((current) => ({ ...current, tracks: [...current.tracks, track] }));
    setSelectedTrackId(track.id);
    setSelectedKeyId(track.keyframes[0].id);
  };

  const addKey = (track: TimelineTrack, time = currentTime) => {
    const property = currentProperties.get(track.propertyKey);
    const storeValue = property?.value ?? evaluateSequence(sequence, currentTime)[track.propertyKey];
    if (storeValue === undefined) return;
    const next = upsertKeyframe(track, clampTimelineTime(time, sequence.duration), storeValue);
    setSequence((current) => ({
      ...current,
      tracks: current.tracks.map((candidate) => (candidate.id === track.id ? next : candidate)),
    }));
    const key = next.keyframes.find((frame) => Math.abs(frame.time - time) < 0.001) ?? next.keyframes.at(-1);
    setSelectedTrackId(track.id);
    setSelectedKeyId(key?.id ?? null);
  };

  const timeFromPointer = (clientX: number): number => {
    const rect = timelineRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    return clampTimelineTime(
      ((clientX - rect.left) / rect.width) * sequenceRef.current.duration,
      sequenceRef.current.duration,
    );
  };

  const scrub = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setPlaying(false);
    updateTime(timeFromPointer(event.clientX));
  };

  const dragKey = (event: ReactPointerEvent<HTMLButtonElement>, trackId: string, keyId: string) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelectedTrackId(trackId);
    setSelectedKeyId(keyId);
    const move = (moveEvent: PointerEvent) => {
      const time = timeFromPointer(moveEvent.clientX);
      setSequence((current) => ({
        ...current,
        tracks: current.tracks.map((track) =>
          track.id === trackId
            ? {
                ...track,
                keyframes: sortKeyframes(
                  track.keyframes.map((keyframe) => (keyframe.id === keyId ? { ...keyframe, time } : keyframe)),
                ),
              }
            : track,
        ),
      }));
      updateTime(time);
    };
    const end = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
  };

  const updateSelectedKey = (patch: Partial<TimelineKeyframe>) => {
    if (!selectedTrack || !selectedKey) return;
    setSequence((current) => ({
      ...current,
      tracks: current.tracks.map((track) =>
        track.id === selectedTrack.id
          ? {
              ...track,
              keyframes: sortKeyframes(
                track.keyframes.map((keyframe) =>
                  keyframe.id === selectedKey.id ? { ...keyframe, ...patch } : keyframe,
                ),
              ),
            }
          : track,
      ),
    }));
  };

  return (
    <section
      className={`timeline-editor playground-leva-panel${open ? " is-open" : ""}`}
      aria-label="Animation timeline"
    >
      <button type="button" className="timeline-tab" aria-expanded={open} onClick={() => onOpenChange(!open)}>
        <ChevronRight size={12} className="timeline-tab-chevron" />
        <Diamond size={10} className="timeline-tab-diamond" fill="currentColor" />
        <span>Timeline</span>
        {sequence.tracks.length > 0 ? <small>{sequence.tracks.length}</small> : null}
        <span className="timeline-tab-action">{open ? "Close timeline" : "Open timeline"}</span>
      </button>
      {open ? (
        <div className="timeline-panel">
          <header className="timeline-toolbar">
            <div className="timeline-transport">
              <button type="button" onClick={() => updateTime(0)} aria-label="Go to start" title="Go to start">
                <SkipBack size={13} />
              </button>
              <button
                type="button"
                className="timeline-play"
                onClick={() => setPlaying((value) => !value)}
                aria-label={playing ? "Pause animation" : "Play animation"}
                title="Play / pause (Space)"
              >
                {playing ? <Pause size={13} /> : <Play size={13} />}
              </button>
              <output>{formatSeconds(currentTime)}</output>
            </div>
            <PropertyPicker properties={properties} tracks={sequence.tracks} onAdd={addTrack} />
            <div className="timeline-sequence-settings">
              <label>
                Duration
                <input
                  type="number"
                  min={0.1}
                  max={3600}
                  step={0.1}
                  value={sequence.duration}
                  onChange={(event) => {
                    const duration = Math.min(3600, Math.max(0.1, Number(event.currentTarget.value) || 0.1));
                    setSequence((current) => ({ ...current, duration }));
                    updateTime(Math.min(currentTime, duration));
                  }}
                />
                <span>s</span>
              </label>
              <button
                type="button"
                className={sequence.loop ? "is-active" : ""}
                onClick={() => setSequence((current) => ({ ...current, loop: !current.loop }))}
                aria-pressed={sequence.loop}
                title="Loop playback"
              >
                <Repeat2 size={13} /> Loop
              </button>
              <button type="button" onClick={() => onOpenChange(false)} aria-label="Close timeline">
                <X size={13} />
              </button>
            </div>
          </header>
          <div className="timeline-workspace">
            <div className="timeline-track-list">
              <div className="timeline-track-list-heading">
                <span>Properties</span>
                <small>{sequence.tracks.length}</small>
              </div>
              {sequence.tracks.length === 0 ? (
                <div className="timeline-empty-copy">
                  <Diamond size={14} />
                  <p>Add a control, then place keys to animate it.</p>
                </div>
              ) : (
                sequence.tracks.map((track) => (
                  <div
                    key={track.id}
                    className={`timeline-track-label${selectedTrackId === track.id ? " is-selected" : ""}`}
                  >
                    <span className={`timeline-track-type is-${track.valueType}`} />
                    <button
                      type="button"
                      className="timeline-track-name"
                      title={track.propertyPath}
                      onClick={() => {
                        setSelectedTrackId(track.id);
                        setSelectedKeyId(null);
                      }}
                    >
                      {track.label}
                    </button>
                    <small>{displayValue(evaluateSequence(sequence, currentTime)[track.propertyKey] ?? "—")}</small>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        addKey(track);
                      }}
                      title="Add key here"
                    >
                      <Diamond size={11} />
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setSequence((current) => ({
                          ...current,
                          tracks: current.tracks.filter((candidate) => candidate.id !== track.id),
                        }));
                        if (selectedTrackId === track.id) {
                          setSelectedTrackId(null);
                          setSelectedKeyId(null);
                        }
                      }}
                      title="Remove property"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                ))
              )}
            </div>
            <div className="timeline-canvas-shell">
              <div className="timeline-ruler" onPointerDown={scrub}>
                {ticks.map((tick) => (
                  <span key={tick} style={{ left: `${(tick / sequence.duration) * 100}%` }}>
                    {tick}s
                  </span>
                ))}
              </div>
              <div className="timeline-canvas" ref={timelineRef} onPointerDown={scrub}>
                <div className="timeline-grid-lines" aria-hidden>
                  {ticks.map((tick) => (
                    <i key={tick} style={{ left: `${(tick / sequence.duration) * 100}%` }} />
                  ))}
                </div>
                <div className="timeline-playhead" style={{ left: `${(currentTime / sequence.duration) * 100}%` }}>
                  <span />
                </div>
                {sequence.tracks.map((track, rowIndex) => (
                  <div
                    className={`timeline-track-row${selectedTrackId === track.id ? " is-selected" : ""}`}
                    key={track.id}
                    style={{ top: rowIndex * 34 }}
                    onDoubleClick={(event) => addKey(track, timeFromPointer(event.clientX))}
                  >
                    {sortKeyframes(track.keyframes)
                      .slice(0, -1)
                      .map((keyframe, index) => {
                        const next = sortKeyframes(track.keyframes)[index + 1];
                        return (
                          <span
                            key={`${keyframe.id}-segment`}
                            className={`timeline-key-segment is-${keyframe.easing}`}
                            style={{
                              left: `${(keyframe.time / sequence.duration) * 100}%`,
                              width: `${((next.time - keyframe.time) / sequence.duration) * 100}%`,
                            }}
                          />
                        );
                      })}
                    {track.keyframes.map((keyframe) => (
                      <button
                        type="button"
                        key={keyframe.id}
                        className={`timeline-key${selectedKeyId === keyframe.id ? " is-selected" : ""}`}
                        style={{ left: `${(keyframe.time / sequence.duration) * 100}%` }}
                        onPointerDown={(event) => dragKey(event, track.id, keyframe.id)}
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedTrackId(track.id);
                          setSelectedKeyId(keyframe.id);
                          updateTime(keyframe.time);
                        }}
                        aria-label={`${track.label} key at ${formatSeconds(keyframe.time)}`}
                        title={`${displayValue(keyframe.value)} · ${formatSeconds(keyframe.time)}`}
                      >
                        <span />
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </div>
            <aside className={`timeline-inspector${selectedKey ? " is-active" : ""}`}>
              {selectedTrack && selectedKey ? (
                <>
                  <div className="timeline-inspector-title">
                    <span>{selectedTrack.label}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setSequence((current) => ({
                          ...current,
                          tracks: current.tracks.map((track) =>
                            track.id === selectedTrack.id
                              ? {
                                  ...track,
                                  keyframes: track.keyframes.filter((keyframe) => keyframe.id !== selectedKey.id),
                                }
                              : track,
                          ),
                        }));
                        setSelectedKeyId(null);
                      }}
                      aria-label="Delete keyframe"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                  <label>
                    Time
                    <input
                      type="number"
                      min={0}
                      max={sequence.duration}
                      step={0.01}
                      value={Number(selectedKey.time.toFixed(3))}
                      onChange={(event) => {
                        const time = clampTimelineTime(Number(event.currentTarget.value), sequence.duration);
                        updateSelectedKey({ time });
                        updateTime(time);
                      }}
                    />
                  </label>
                  <label>
                    Value
                    {selectedTrack.valueType === "color" ? (
                      <input
                        type="color"
                        value={String(selectedKey.value)}
                        onChange={(event) => updateSelectedKey({ value: event.currentTarget.value })}
                      />
                    ) : typeof selectedKey.value === "boolean" ? (
                      <input
                        type="checkbox"
                        checked={selectedKey.value}
                        onChange={(event) => updateSelectedKey({ value: event.currentTarget.checked })}
                      />
                    ) : selectedTrack.valueType === "number" ? (
                      <input
                        type="number"
                        min={selectedProperty?.min}
                        max={selectedProperty?.max}
                        step={selectedProperty?.step ?? 0.01}
                        value={selectedKey.value as number}
                        onChange={(event) => updateSelectedKey({ value: Number(event.currentTarget.value) })}
                      />
                    ) : (
                      <input
                        value={String(selectedKey.value)}
                        onChange={(event) => updateSelectedKey({ value: event.currentTarget.value })}
                      />
                    )}
                  </label>
                  <label>
                    To next key
                    <select
                      value={selectedKey.easing}
                      onChange={(event) => updateSelectedKey({ easing: event.currentTarget.value as TimelineEasing })}
                    >
                      {EASING_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              ) : (
                <p>Select a key to edit its exact value and easing.</p>
              )}
            </aside>
          </div>
        </div>
      ) : null}
    </section>
  );
}
