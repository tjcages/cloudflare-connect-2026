import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import { ChevronDown, ChevronRight, Diamond, Keyboard, Plus, Repeat2, Search, Trash2, X } from "lucide-react";
import {
  clampTimelineTime,
  createTimelineId,
  DEFAULT_TIMELINE_EASING,
  evaluateSequence,
  loadTimelineSequence,
  saveTimelineSequence,
  snapTimelineTimeToWholeSecond,
  sortKeyframes,
  updateKeyframeValueById,
  upsertKeyframe,
  type TimelineKeyframe,
  type TimelineProperty,
  type TimelineSequence,
  type TimelineTrack,
  type TimelineValue,
} from "../animation/timelineModel";
import {
  clampTimelineHeight,
  clampTimelineInspectorWidth,
  loadTimelineLayout,
  saveTimelineLayout,
} from "../animation/timelineLayout";
import { HexColorPopover } from "./HexColorPopover";
import { cssColorForHex, findLibraryColorByHex } from "./colorLibrary";
import { TimelineEasingEditor } from "./TimelineEasingEditor";

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
  subscribeToEditEnd: (path: string, listener: (value: TimelineValue) => void) => () => void;
};

type TimelineEditorProps = {
  open: boolean;
  playing: boolean;
  stores: readonly TimelineLevaStore[];
  graphicMode: "twizzler" | "rain" | "both";
  onOpenChange: (open: boolean) => void;
  onApplyValues: (values: Record<string, TimelineValue>) => void;
  onTimeChange?: (seconds: number) => void;
  onPlayingChange?: (playing: boolean) => void;
};

const TIMELINE_TRACK_HEIGHT = 34;

export function timelineScrollContentHeight(trackCount: number): number {
  return (Math.max(0, Math.floor(trackCount)) + 1) * TIMELINE_TRACK_HEIGHT;
}

function TransportGlyph({ type }: { type: "rewind" | "play" | "pause" }) {
  return (
    <svg className={`timeline-transport-glyph is-${type}`} viewBox="0 0 10 10" aria-hidden="true" focusable="false">
      {type === "rewind" ? (
        <path d="M1 1h1.35v8H1V1Zm7.6.25v7.5L3.15 5 8.6 1.25Z" />
      ) : type === "play" ? (
        <path d="M2 1.1 8.65 5 2 8.9V1.1Z" />
      ) : (
        <path d="M2 1.25h2.1v7.5H2v-7.5Zm3.9 0H8v7.5H5.9v-7.5Z" />
      )}
    </svg>
  );
}

function inputLabel(input: LevaDataInput, key: string): string {
  return typeof input.label === "string" && input.label.trim() ? input.label : key.replace(/([A-Z])/g, " $1").trim();
}

function timelinePropertyFromInput(path: string, input: LevaDataInput): TimelineProperty | null {
  if (input.disabled) return null;
  const value = input.value;
  if (["BUTTON", "BUTTON_GROUP", "MONITOR", "STRING"].includes(input.type)) return null;
  if (typeof value !== "number" && typeof value !== "string" && typeof value !== "boolean") return null;
  // Custom editors can store structured state as serialized strings. Those are
  // not meaningful scalar tracks; their individual aliases are exposed instead.
  if (typeof value === "string" && (value.trim().startsWith("[") || value.trim().startsWith("{"))) return null;
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

export function collectTimelineProperties(
  stores: readonly TimelineLevaStore[],
  graphicMode: TimelineEditorProps["graphicMode"] = "both",
): TimelineProperty[] {
  const properties = new Map<string, TimelineProperty>();
  for (const store of stores) {
    const data = store.getData();
    // Hidden Leva folders still contain animation-safe controls (including
    // Transform / Zoom), so the timeline uses the complete store as its source.
    for (const [path, input] of Object.entries(data)) {
      if (path.startsWith("Rain.") && graphicMode === "twizzler") continue;
      if (path.startsWith("Twizzler.") && graphicMode === "rain") continue;
      const property = timelinePropertyFromInput(path, input);
      if (property && !properties.has(property.path)) properties.set(property.path, property);
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

export function displayTimelineColorValue(value: string): string {
  return findLibraryColorByHex(value)?.token ?? value.toUpperCase();
}

function TimelineColorValue({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="timeline-color-value">
      <HexColorPopover
        color={value}
        onChange={onChange}
        ariaLabel="Keyframe color variable"
        triggerClassName="library-color-input-swatch"
        triggerStyle={{ "--library-color-input-color": cssColorForHex(value) } as CSSProperties}
        align="right"
      />
      <span className="timeline-color-value-name" title={value.toUpperCase()}>
        {displayTimelineColorValue(value)}
      </span>
    </div>
  );
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
  buttonRef,
  onAdd,
}: {
  properties: TimelineProperty[];
  tracks: TimelineTrack[];
  buttonRef: RefObject<HTMLButtonElement | null>;
  onAdd: (property: TimelineProperty) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const tracked = useMemo(() => new Set(tracks.map((track) => track.propertyPath)), [tracks]);
  const filtered = properties.filter(
    (property) =>
      !tracked.has(property.path) &&
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

  useEffect(() => {
    if (!open || !window.matchMedia("(min-width: 901px)").matches) return;
    const frame = requestAnimationFrame(() => searchRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open]);

  return (
    <div className="timeline-property-picker" ref={containerRef}>
      <button
        ref={buttonRef}
        type="button"
        className="timeline-add-property"
        onClick={() => setOpen((value) => !value)}
      >
        <Plus size={12} /> Add property <ChevronDown size={11} />
      </button>
      {open ? (
        <div className="timeline-property-menu">
          <label className="timeline-property-search">
            <Search size={12} />
            <input
              ref={searchRef}
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

export function TimelineEditor({
  open,
  playing,
  stores,
  graphicMode,
  onOpenChange,
  onApplyValues,
  onTimeChange,
  onPlayingChange,
}: TimelineEditorProps) {
  const [sequence, setSequence] = useState<TimelineSequence>(loadTimelineSequence);
  const [currentTime, setCurrentTime] = useState(0);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [selectedKeyId, setSelectedKeyId] = useState<string | null>(null);
  const [selectedNumberDraft, setSelectedNumberDraft] = useState<string | null>(null);
  const [snapGuideTime, setSnapGuideTime] = useState<number | null>(null);
  const [layout, setLayout] = useState(loadTimelineLayout);
  const timelineRef = useRef<HTMLDivElement>(null);
  const trackListScrollRef = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const addPropertyButtonRef = useRef<HTMLButtonElement>(null);
  const shortcutsRef = useRef<HTMLDetailsElement>(null);
  const sequenceRef = useRef(sequence);
  const timeRef = useRef(currentTime);
  const playingRef = useRef(playing);
  const onApplyValuesRef = useRef(onApplyValues);
  const onTimeChangeRef = useRef(onTimeChange);
  const onPlayingChangeRef = useRef(onPlayingChange);
  const deferSequenceApplyRef = useRef(false);
  const applyingTimelineValuesRef = useRef(false);
  const properties = collectTimelineProperties(stores, graphicMode);
  sequenceRef.current = sequence;
  timeRef.current = currentTime;
  playingRef.current = playing;
  onApplyValuesRef.current = onApplyValues;
  onTimeChangeRef.current = onTimeChange;
  onPlayingChangeRef.current = onPlayingChange;

  const updatePlaying = useCallback((next: boolean) => {
    if (playingRef.current === next) return;
    playingRef.current = next;
    onPlayingChangeRef.current?.(next);
  }, []);

  const applyEvaluatedValues = useCallback((nextSequence: TimelineSequence, time: number) => {
    applyingTimelineValuesRef.current = true;
    try {
      onApplyValuesRef.current(evaluateSequence(nextSequence, time));
    } finally {
      applyingTimelineValuesRef.current = false;
    }
  }, []);

  const updateTime = useCallback(
    (time: number, syncMotion = true, applyValues = true) => {
      const next = clampTimelineTime(time, sequenceRef.current.duration);
      timeRef.current = next;
      setCurrentTime(next);
      if (applyValues) applyEvaluatedValues(sequenceRef.current, next);
      if (syncMotion) onTimeChangeRef.current?.(next);
    },
    [applyEvaluatedValues],
  );

  const snapKeyTime = useCallback((time: number, disabled = false) => {
    const width = timelineRef.current?.getBoundingClientRect().width ?? 0;
    return disabled
      ? { time: clampTimelineTime(time, sequenceRef.current.duration), snapped: false }
      : snapTimelineTimeToWholeSecond(time, sequenceRef.current.duration, width);
  }, []);

  useEffect(() => saveTimelineSequence(sequence), [sequence]);

  useEffect(() => setSelectedNumberDraft(null), [selectedKeyId]);

  useEffect(() => {
    const closeShortcuts = (event: PointerEvent) => {
      if (!shortcutsRef.current?.contains(event.target as Node)) shortcutsRef.current?.removeAttribute("open");
    };
    window.addEventListener("pointerdown", closeShortcuts);
    return () => window.removeEventListener("pointerdown", closeShortcuts);
  }, []);

  useEffect(() => {
    if (!selectedKeyId) return;
    const clearSelectedKey = (event: PointerEvent) => {
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest(".timeline-key, .timeline-inspector, .timeline-resize-handle, [data-hex-color-popover]")
      )
        return;
      setSelectedKeyId(null);
    };
    window.addEventListener("pointerdown", clearSelectedKey, true);
    return () => window.removeEventListener("pointerdown", clearSelectedKey, true);
  }, [selectedKeyId]);

  useEffect(() => {
    if (deferSequenceApplyRef.current) return;
    applyEvaluatedValues(sequence, timeRef.current);
  }, [applyEvaluatedValues, sequence]);

  useEffect(() => saveTimelineLayout(layout), [layout]);

  useEffect(() => {
    const fitToViewport = () =>
      setLayout((current) => ({
        ...current,
        height: clampTimelineHeight(current.height, window.innerHeight),
      }));
    fitToViewport();
    window.addEventListener("resize", fitToViewport);
    return () => window.removeEventListener("resize", fitToViewport);
  }, []);

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let previous = performance.now();
    const tick = (now: number) => {
      const elapsed = Math.min(0.1, (now - previous) / 1000);
      previous = now;
      let next = timeRef.current + elapsed;
      const shouldLoop = sequenceRef.current.loop || sequenceRef.current.tracks.length === 0;
      if (next >= sequenceRef.current.duration) {
        if (shouldLoop) next %= sequenceRef.current.duration;
        else {
          next = sequenceRef.current.duration;
          updatePlaying(false);
        }
      }
      // The shader's natural clock keeps advancing independently while the
      // keyframed property clock loops. Scrubbing still synchronizes both.
      updateTime(next, false);
      if (next < sequenceRef.current.duration || shouldLoop) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, updatePlaying, updateTime]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const isLevaNumberInput =
        target instanceof HTMLInputElement &&
        [...target.classList].some((className) => className.includes("levaType-number"));
      const isTextEntry =
        target instanceof HTMLTextAreaElement ||
        target.isContentEditable ||
        (target instanceof HTMLInputElement &&
          !isLevaNumberInput &&
          ["text", "search", "email", "url", "tel", "password"].includes(target.type));

      if (event.code === "Space" && !event.metaKey && !event.ctrlKey && !event.altKey && !event.repeat) {
        if (isTextEntry) return;
        event.preventDefault();
        event.stopPropagation();
        updatePlaying(!playingRef.current);
        return;
      }

      if (isTextEntry || target instanceof HTMLInputElement || target instanceof HTMLSelectElement) return;

      if (event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.key === "Escape") {
        shortcutsRef.current?.removeAttribute("open");
        return;
      }

      if (event.key === "Home") {
        event.preventDefault();
        updatePlaying(false);
        updateTime(0);
        return;
      }

      if (event.key === "End") {
        event.preventDefault();
        updatePlaying(false);
        updateTime(sequenceRef.current.duration);
        return;
      }

      const frameDirection =
        event.key === "ArrowLeft" || event.key === "PageUp"
          ? -1
          : event.key === "ArrowRight" || event.key === "PageDown"
            ? 1
            : 0;
      if (frameDirection !== 0) {
        event.preventDefault();
        updatePlaying(false);
        updateTime(timeRef.current + (frameDirection * (event.shiftKey ? 10 : 1)) / 30);
        return;
      }

      if (event.code === "KeyJ" || event.code === "KeyK") {
        const tracks = selectedTrackId
          ? sequenceRef.current.tracks.filter((track) => track.id === selectedTrackId)
          : sequenceRef.current.tracks;
        const keyTimes = [...new Set(tracks.flatMap((track) => track.keyframes.map((keyframe) => keyframe.time)))].sort(
          (a, b) => a - b,
        );
        const nextTime =
          event.code === "KeyJ"
            ? keyTimes.filter((time) => time < timeRef.current - 0.0001).at(-1)
            : keyTimes.find((time) => time > timeRef.current + 0.0001);
        if (nextTime !== undefined) {
          event.preventDefault();
          updatePlaying(false);
          updateTime(nextTime);
        }
        return;
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
    // Capture lets the transport shortcut win even when Leva controls stop
    // keyboard events before they bubble to the window.
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [selectedKeyId, selectedTrackId, updatePlaying, updateTime]);

  const currentProperties = useMemo(
    () => new Map(properties.map((property) => [property.path, property])),
    [properties],
  );
  const selectedTrack = sequence.tracks.find((track) => track.id === selectedTrackId) ?? null;
  const selectedKey = selectedTrack?.keyframes.find((keyframe) => keyframe.id === selectedKeyId) ?? null;
  const selectedProperty = selectedTrack ? currentProperties.get(selectedTrack.propertyPath) : null;
  const ticks = useMemo(() => {
    const step = rulerStep(sequence.duration);
    return Array.from({ length: Math.floor(sequence.duration / step) + 1 }, (_, index) => index * step);
  }, [sequence.duration]);

  useEffect(() => {
    if (!selectedTrack) return;
    const store = stores.find((candidate) => selectedTrack.propertyPath in candidate.getData());
    if (!store) return;
    return store.subscribeToEditEnd(selectedTrack.propertyPath, (value) => {
      if (applyingTimelineValuesRef.current) return;
      const current = sequenceRef.current;
      const track = current.tracks.find((candidate) => candidate.id === selectedTrack.id);
      if (!track) return;
      const selectedFrame = selectedKeyId
        ? track.keyframes.find((keyframe) => keyframe.id === selectedKeyId)
        : undefined;
      if (selectedFrame) {
        const nextTrack = updateKeyframeValueById(track, selectedFrame.id, value);
        const nextSequence = {
          ...current,
          tracks: current.tracks.map((candidate) => (candidate.id === track.id ? nextTrack : candidate)),
        };
        sequenceRef.current = nextSequence;
        setSequence(nextSequence);
        return;
      }
      const keyTime = snapKeyTime(timeRef.current).time;
      const nextTrack = upsertKeyframe(track, keyTime, value);
      const nextKey = nextTrack.keyframes.find((keyframe) => Math.abs(keyframe.time - keyTime) < 0.001);
      const nextSequence = {
        ...current,
        tracks: current.tracks.map((candidate) => (candidate.id === track.id ? nextTrack : candidate)),
      };
      sequenceRef.current = nextSequence;
      setSequence(nextSequence);
      setSelectedKeyId(nextKey?.id ?? null);
    });
  }, [selectedKeyId, selectedTrack, snapKeyTime, stores]);

  const addTrack = (property: TimelineProperty) => {
    const keyTime = snapKeyTime(currentTime).time;
    const track: TimelineTrack = {
      id: createTimelineId("track"),
      propertyKey: property.key,
      propertyPath: property.path,
      label: property.label,
      valueType: property.valueType,
      keyframes: [
        { id: createTimelineId("key"), time: keyTime, value: property.value, easing: DEFAULT_TIMELINE_EASING },
      ],
    };
    setSequence((current) => ({ ...current, tracks: [...current.tracks, track] }));
    setSelectedTrackId(track.id);
    setSelectedKeyId(track.keyframes[0].id);
  };

  const addKey = (track: TimelineTrack, time = currentTime) => {
    const property = currentProperties.get(track.propertyPath);
    const storeValue = property?.value ?? evaluateSequence(sequence, currentTime)[track.propertyPath];
    if (storeValue === undefined) return;
    const keyTime = snapKeyTime(time).time;
    const next = upsertKeyframe(track, keyTime, storeValue);
    setSequence((current) => ({
      ...current,
      tracks: current.tracks.map((candidate) => (candidate.id === track.id ? next : candidate)),
    }));
    const key = next.keyframes.find((frame) => Math.abs(frame.time - keyTime) < 0.001) ?? next.keyframes.at(-1);
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
    event.preventDefault();
    updatePlaying(false);
    updateTime(timeFromPointer(event.clientX));
    const pointerId = event.pointerId;
    let pendingClientX = event.clientX;
    let frame = 0;
    const flush = () => {
      frame = 0;
      updateTime(timeFromPointer(pendingClientX), false, false);
    };
    const move = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return;
      moveEvent.preventDefault();
      pendingClientX = moveEvent.clientX;
      if (!frame) frame = requestAnimationFrame(flush);
    };
    const end = (endEvent: PointerEvent) => {
      if (endEvent.pointerId !== pointerId) return;
      if (frame) cancelAnimationFrame(frame);
      updateTime(timeFromPointer(endEvent.clientX));
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  };

  const dragKey = (event: ReactPointerEvent<HTMLButtonElement>, trackId: string, keyId: string) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    updatePlaying(false);
    deferSequenceApplyRef.current = true;
    setSnapGuideTime(null);
    const setKeyTime = (time: number) => {
      setSequence((current) => {
        const next = {
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
        };
        sequenceRef.current = next;
        return next;
      });
      updateTime(time, false, false);
    };
    const move = (moveEvent: PointerEvent) => {
      const snapped = snapKeyTime(timeFromPointer(moveEvent.clientX), moveEvent.altKey);
      setSnapGuideTime(snapped.snapped ? snapped.time : null);
      setKeyTime(snapped.time);
    };
    const end = (endEvent: PointerEvent) => {
      const snapped = snapKeyTime(timeFromPointer(endEvent.clientX), endEvent.altKey);
      deferSequenceApplyRef.current = false;
      setSnapGuideTime(null);
      setSelectedTrackId(trackId);
      setSelectedKeyId(keyId);
      setKeyTime(snapped.time);
      updateTime(snapped.time);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  };

  const resizeTimeline = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const pointerId = event.pointerId;
    const startY = event.clientY;
    const startHeight = layout.height;
    document.body.classList.add("is-resizing-timeline-height");
    const move = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return;
      moveEvent.preventDefault();
      setLayout((current) => ({
        ...current,
        height: clampTimelineHeight(startHeight + startY - moveEvent.clientY, window.innerHeight),
      }));
    };
    const end = (endEvent: PointerEvent) => {
      if (endEvent.pointerId !== pointerId) return;
      document.body.classList.remove("is-resizing-timeline-height");
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  };

  const resizeInspector = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const pointerId = event.pointerId;
    const startX = event.clientX;
    const startWidth = layout.inspectorWidth;
    const workspaceWidth = workspaceRef.current?.getBoundingClientRect().width ?? window.innerWidth;
    document.body.classList.add("is-resizing-timeline-inspector");
    const move = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return;
      moveEvent.preventDefault();
      setLayout((current) => ({
        ...current,
        inspectorWidth: clampTimelineInspectorWidth(startWidth + startX - moveEvent.clientX, workspaceWidth),
      }));
    };
    const end = (endEvent: PointerEvent) => {
      if (endEvent.pointerId !== pointerId) return;
      document.body.classList.remove("is-resizing-timeline-inspector");
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
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
      style={
        {
          "--timeline-editor-height": `${layout.height}px`,
          "--timeline-inspector-width": `${layout.inspectorWidth}px`,
        } as CSSProperties
      }
    >
      {open ? (
        <button
          type="button"
          className="timeline-resize-handle timeline-height-resize-handle"
          aria-label="Resize timeline"
          title={`Resize timeline · ${Math.round(layout.height)}px`}
          onPointerDown={resizeTimeline}
          onKeyDown={(event) => {
            if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
            event.preventDefault();
            const direction = event.key === "ArrowUp" ? 1 : -1;
            setLayout((current) => ({
              ...current,
              height: clampTimelineHeight(current.height + direction * 10, window.innerHeight),
            }));
          }}
        />
      ) : null}
      <header className="timeline-header">
        <button type="button" className="timeline-tab" aria-expanded={open} onClick={() => onOpenChange(!open)}>
          <ChevronRight size={12} className="timeline-tab-chevron" />
          <Diamond size={10} className="timeline-tab-diamond" fill="currentColor" />
          <span>Timeline</span>
          {sequence.tracks.length > 0 ? <small>{sequence.tracks.length}</small> : null}
        </button>
        <div className="timeline-transport">
          <button type="button" onClick={() => updateTime(0)} aria-label="Go to start" title="Go to start (Home)">
            <TransportGlyph type="rewind" />
          </button>
          <button
            type="button"
            className="timeline-play"
            onClick={() => updatePlaying(!playingRef.current)}
            aria-label={playing ? "Pause animation" : "Play animation"}
            title="Play / pause (Space)"
          >
            <TransportGlyph type={playing ? "pause" : "play"} />
          </button>
          <output>
            {formatSeconds(currentTime)} <span>/ {formatSeconds(sequence.duration)}</span>
          </output>
        </div>
        {open ? (
          <>
            <PropertyPicker
              properties={properties}
              tracks={sequence.tracks}
              buttonRef={addPropertyButtonRef}
              onAdd={addTrack}
            />
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
                title="Loop keyframed properties"
              >
                <Repeat2 size={13} /> Loop
              </button>
              <details className="timeline-shortcuts" ref={shortcutsRef}>
                <summary aria-label="Timeline keyboard shortcuts" title="Keyboard shortcuts">
                  <Keyboard size={13} />
                </summary>
                <div className="timeline-shortcuts-menu">
                  <strong>Keyboard shortcuts</strong>
                  <dl>
                    <div>
                      <dt>Play / pause</dt>
                      <dd>Space</dd>
                    </div>
                    <div>
                      <dt>Previous / next key</dt>
                      <dd>J / K</dd>
                    </div>
                    <div>
                      <dt>Step 1 frame</dt>
                      <dd>← / →</dd>
                    </div>
                    <div>
                      <dt>Step 10 frames</dt>
                      <dd>Shift + ← / →</dd>
                    </div>
                    <div>
                      <dt>Start / end</dt>
                      <dd>Home / End</dd>
                    </div>
                    <div>
                      <dt>Delete selected key</dt>
                      <dd>Delete</dd>
                    </div>
                  </dl>
                </div>
              </details>
              <button type="button" onClick={() => onOpenChange(false)} aria-label="Close timeline">
                <X size={13} />
              </button>
            </div>
          </>
        ) : (
          <button type="button" className="timeline-open-action" onClick={() => onOpenChange(true)}>
            Open timeline
          </button>
        )}
      </header>
      {open ? (
        <div className="timeline-panel">
          <div ref={workspaceRef} className={`timeline-workspace${selectedKey ? " has-inspector" : ""}`}>
            <div
              className="timeline-track-list"
              onDoubleClick={(event) => {
                const target = event.target;
                if (target instanceof Element && target.closest(".timeline-track-label, .timeline-track-list-heading"))
                  return;
                addPropertyButtonRef.current?.click();
              }}
            >
              <div className="timeline-track-list-heading">
                <span>Properties</span>
                <small>{sequence.tracks.length}</small>
              </div>
              <div
                className="timeline-track-list-scroll"
                ref={trackListScrollRef}
                onScroll={(event) => {
                  if (timelineRef.current && timelineRef.current.scrollTop !== event.currentTarget.scrollTop) {
                    timelineRef.current.scrollTop = event.currentTarget.scrollTop;
                  }
                }}
              >
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
                      <small>{displayValue(evaluateSequence(sequence, currentTime)[track.propertyPath] ?? "—")}</small>
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
            </div>
            <div className="timeline-canvas-shell">
              <div className="timeline-ruler" onPointerDown={scrub}>
                {ticks.map((tick) => (
                  <span key={tick} style={{ left: `${(tick / sequence.duration) * 100}%` }}>
                    {tick}s
                  </span>
                ))}
              </div>
              <div
                className="timeline-canvas"
                ref={timelineRef}
                onPointerDown={scrub}
                onScroll={(event) => {
                  if (
                    trackListScrollRef.current &&
                    trackListScrollRef.current.scrollTop !== event.currentTarget.scrollTop
                  ) {
                    trackListScrollRef.current.scrollTop = event.currentTarget.scrollTop;
                  }
                }}
              >
                <div
                  className="timeline-canvas-content"
                  style={{ height: `max(100%, ${timelineScrollContentHeight(sequence.tracks.length)}px)` }}
                >
                  <div className="timeline-grid-lines" aria-hidden>
                    {ticks.map((tick) => (
                      <i key={tick} style={{ left: `${(tick / sequence.duration) * 100}%` }} />
                    ))}
                  </div>
                  {snapGuideTime !== null ? (
                    <div
                      className="timeline-snap-guide"
                      style={{ left: `${(snapGuideTime / sequence.duration) * 100}%` }}
                      aria-hidden
                    />
                  ) : null}
                  <div className="timeline-playhead" style={{ left: `${(currentTime / sequence.duration) * 100}%` }}>
                    <span />
                  </div>
                  {sequence.tracks.map((track, rowIndex) => (
                    <div
                      className={`timeline-track-row${selectedTrackId === track.id ? " is-selected" : ""}`}
                      key={track.id}
                      style={{ top: rowIndex * TIMELINE_TRACK_HEIGHT }}
                      onPointerDown={() => {
                        setSelectedTrackId(track.id);
                        setSelectedKeyId(null);
                      }}
                      onDoubleClick={(event) => addKey(track, timeFromPointer(event.clientX))}
                    >
                      {sortKeyframes(track.keyframes)
                        .slice(0, -1)
                        .map((keyframe, index) => {
                          const next = sortKeyframes(track.keyframes)[index + 1];
                          return (
                            <span
                              key={`${keyframe.id}-segment`}
                              className={`timeline-key-segment${keyframe.easing === "hold" ? " is-hold" : ""}${keyframe.easing === "spring" ? " is-spring" : ""}`}
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
            </div>
            {selectedTrack && selectedKey ? (
              <aside className="timeline-inspector is-active">
                <button
                  type="button"
                  className="timeline-resize-handle timeline-inspector-resize-handle"
                  aria-label="Resize keyframe details"
                  title={`Resize keyframe details · ${Math.round(layout.inspectorWidth)}px`}
                  onPointerDown={resizeInspector}
                  onKeyDown={(event) => {
                    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
                    event.preventDefault();
                    const direction = event.key === "ArrowLeft" ? 1 : -1;
                    const workspaceWidth = workspaceRef.current?.getBoundingClientRect().width ?? window.innerWidth;
                    setLayout((current) => ({
                      ...current,
                      inspectorWidth: clampTimelineInspectorWidth(
                        current.inspectorWidth + direction * 10,
                        workspaceWidth,
                      ),
                    }));
                  }}
                />
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
                    <TimelineColorValue
                      value={String(selectedKey.value)}
                      onChange={(value) => updateSelectedKey({ value })}
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
                      value={selectedNumberDraft ?? String(selectedKey.value)}
                      onFocus={() => setSelectedNumberDraft(String(selectedKey.value))}
                      onChange={(event) => {
                        const draft = event.currentTarget.value;
                        setSelectedNumberDraft(draft);
                        if (draft.trim() === "") return;
                        const value = Number(draft);
                        if (Number.isFinite(value)) updateSelectedKey({ value });
                      }}
                      onBlur={() => setSelectedNumberDraft(null)}
                    />
                  ) : (
                    <input
                      value={String(selectedKey.value)}
                      onChange={(event) => updateSelectedKey({ value: event.currentTarget.value })}
                    />
                  )}
                </label>
                <TimelineEasingEditor
                  keyframeId={selectedKey.id}
                  value={selectedKey.easing}
                  onChange={(easing) => updateSelectedKey({ easing })}
                />
              </aside>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
