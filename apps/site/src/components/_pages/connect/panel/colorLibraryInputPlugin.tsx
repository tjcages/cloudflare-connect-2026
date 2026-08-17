import {
  useEffect,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import {
  Components,
  createPlugin,
  useInputContext,
  type LevaInputProps,
} from "leva/plugin";
import { HexColorPopover } from "./HexColorPopover";
import { cssColorForHex, findLibraryColorByHex } from "./colorLibrary";
// The lab backs `persist: "backgroundColor"` with its own sticky-background
// store, which is a no-op there and has no counterpart on the site. Keep the
// setting accepted so schemas stay portable between the two panels.
const saveStickyBackgroundColor = (_color: number): void => {};
const clearStickyBackgroundColor = (): void => {};

const { Label, Row } = Components;

type ColorLibraryInputSettings = {
  persist?: "backgroundColor";
  onLiveChange?: (hex: string | null) => void;
};

type ColorLibraryInput = {
  value: string | null;
  render?: (get: (path: string) => unknown) => boolean;
  persist?: "backgroundColor";
  onLiveChange?: (hex: string | null) => void;
};

type ColorLibraryInputProps = LevaInputProps<
  string | null,
  ColorLibraryInputSettings
>;

function normalizeHex(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  const raw = typeof value === "string" ? value.trim() : "";
  const withoutHash = raw.replace(/^#/, "");
  if (/^[0-9a-fA-F]{6}$/.test(withoutHash))
    return `#${withoutHash.toLowerCase()}`;
  return null;
}

function displayValueForHex(hex: string | null): string {
  if (!hex) return "";
  const match = findLibraryColorByHex(hex);
  return match ? match.token : hex.toUpperCase();
}

function ColorLibraryInputComponent() {
  const { label, value, onUpdate, disabled, settings } =
    useInputContext<ColorLibraryInputProps>();
  const color = normalizeHex(value);
  const libraryMatch = color ? findLibraryColorByHex(color) : null;
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState(() => displayValueForHex(color));

  useEffect(() => {
    if (focused) return;
    setDraft(displayValueForHex(color));
  }, [color, focused]);

  const updateColor = (hex: string) => {
    const next = normalizeHex(hex);
    if (next === null) return;
    if (settings.persist === "backgroundColor") {
      saveStickyBackgroundColor(Number.parseInt(next.replace(/^#/, ""), 16));
    }
    settings.onLiveChange?.(next);
    onUpdate(next);
  };
  const commitDraft = () => {
    const next = normalizeHex(draft);
    if (next) {
      updateColor(next);
      setFocused(false);
      setDraft(displayValueForHex(next));
      return;
    }
    setFocused(false);
    setDraft(displayValueForHex(color));
  };
  const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    event.stopPropagation();
    if (event.key === "Enter") {
      event.currentTarget.blur();
    }
    if (event.key === "Escape") {
      setDraft(
        focused && color ? color.toUpperCase() : displayValueForHex(color)
      );
      event.currentTarget.blur();
    }
  };
  const clearColor = () => {
    if (settings.persist === "backgroundColor") clearStickyBackgroundColor();
    settings.onLiveChange?.(null);
    onUpdate(null);
  };
  const swatchColor = color ?? "#000000";
  const triggerStyle = {
    "--library-color-input-color": cssColorForHex(swatchColor),
    "--library-color-input-image": color
      ? "none"
      : "linear-gradient(45deg, #d6d6d6 25%, transparent 25%), linear-gradient(-45deg, #d6d6d6 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #d6d6d6 75%), linear-gradient(-45deg, transparent 75%, #d6d6d6 75%)",
  } as CSSProperties;

  return (
    <Row input>
      <Label>{label}</Label>
      <div
        className={`library-color-input${settings.persist === "backgroundColor" && color ? "has-clear" : ""}`}
      >
        <HexColorPopover
          color={swatchColor}
          onChange={updateColor}
          disabled={disabled}
          ariaLabel={`${label} color`}
          triggerClassName="library-color-input-swatch"
          triggerStyle={triggerStyle}
          align="right"
        />
        <input
          className={`library-color-input-value${libraryMatch && !focused ? "is-token" : ""}`}
          value={draft}
          placeholder={
            settings.persist === "backgroundColor" ? "Transparent" : "#RRGGBB"
          }
          disabled={disabled}
          spellCheck={false}
          inputMode="text"
          title={color ? color.toUpperCase() : undefined}
          aria-label={
            libraryMatch
              ? `${label} ${libraryMatch.token}`
              : `${label} hex value`
          }
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
          onFocus={() => {
            setFocused(true);
            setDraft(color ? color.toUpperCase() : "");
          }}
          onKeyDown={handleInputKeyDown}
          onChange={(event) => {
            const raw = event.target.value.trim();
            // While editing, accept hex only (token names resolve on blur via hex from picker).
            const withoutHash = raw.replace(/^#/, "");
            if (withoutHash.length === 0) {
              setDraft("");
              return;
            }
            if (!/^[0-9a-fA-F]{0,6}$/.test(withoutHash)) return;
            const nextDraft = `#${withoutHash.toUpperCase()}`;
            setDraft(nextDraft);
            if (withoutHash.length === 6) updateColor(nextDraft);
          }}
          onBlur={commitDraft}
        />
        {settings.persist === "backgroundColor" && color ? (
          <button
            type="button"
            className="library-color-input-clear"
            onClick={clearColor}
            disabled={disabled}
          >
            ×
          </button>
        ) : null}
      </div>
    </Row>
  );
}

export const colorLibraryInputPlugin = createPlugin<
  ColorLibraryInput,
  string | null,
  ColorLibraryInputSettings
>({
  component: ColorLibraryInputComponent,
  normalize: (input) => {
    const record = input && typeof input === "object" ? input : null;
    return {
      value: normalizeHex(record && "value" in record ? record.value : input),
      settings: {
        persist: record && "persist" in record ? record.persist : undefined,
        onLiveChange:
          record && "onLiveChange" in record ? record.onLiveChange : undefined,
      },
    };
  },
  sanitize: (value) => normalizeHex(value),
});
