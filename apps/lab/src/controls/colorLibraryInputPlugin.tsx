import { useEffect, useState, type CSSProperties, type KeyboardEvent } from "react";
import { Components, createPlugin, useInputContext, type LevaInputProps } from "leva/plugin";
import { HexColorPopover } from "../components/HexColorPopover";
import { cssColorForHex } from "../components/colorLibrary";
import { clearStickyBackgroundColor, saveStickyBackgroundColor } from "../persistence";
import { hexToInt, normalizeHexString } from "../lib/color";

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

type ColorLibraryInputProps = LevaInputProps<string | null, ColorLibraryInputSettings>;

function ColorLibraryInputComponent() {
  const { label, value, onUpdate, disabled, settings } = useInputContext<ColorLibraryInputProps>();
  const color = normalizeHexString(value);
  const [draft, setDraft] = useState(color ? color.toUpperCase() : "");

  useEffect(() => {
    setDraft(color ? color.toUpperCase() : "");
  }, [color]);

  const updateColor = (hex: string) => {
    const next = normalizeHexString(hex);
    if (next === null) return;
    if (settings.persist === "backgroundColor") {
      saveStickyBackgroundColor(hexToInt(next));
    }
    settings.onLiveChange?.(next);
    onUpdate(next);
  };
  const commitDraft = () => {
    const next = normalizeHexString(draft);
    if (next) {
      updateColor(next);
      setDraft(next.toUpperCase());
      return;
    }
    setDraft(color ? color.toUpperCase() : "");
  };
  const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    event.stopPropagation();
    if (event.key === "Enter") {
      event.currentTarget.blur();
    }
    if (event.key === "Escape") {
      setDraft(color ? color.toUpperCase() : "");
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
      <div className="library-color-input">
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
          className="library-color-input-value"
          value={draft}
          placeholder={settings.persist === "backgroundColor" ? "Transparent" : "#RRGGBB"}
          disabled={disabled}
          spellCheck={false}
          inputMode="text"
          aria-label={`${label} hex value`}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
          onKeyDown={handleInputKeyDown}
          onChange={(event) => {
            const raw = event.target.value.trim();
            const withoutHash = raw.replace(/^#/, "");
            if (!/^[0-9a-fA-F]{0,6}$/.test(withoutHash)) return;
            const nextDraft = withoutHash.length > 0 ? `#${withoutHash.toUpperCase()}` : "";
            setDraft(nextDraft);
            if (withoutHash.length === 6) updateColor(nextDraft);
          }}
          onBlur={commitDraft}
        />
        {settings.persist === "backgroundColor" && color ? (
          <button type="button" className="library-color-input-clear" onClick={clearColor} disabled={disabled}>
            ×
          </button>
        ) : null}
      </div>
    </Row>
  );
}

export const colorLibraryInputPlugin = createPlugin<ColorLibraryInput, string | null, ColorLibraryInputSettings>({
  component: ColorLibraryInputComponent,
  normalize: (input) => {
    const record = input && typeof input === "object" ? input : null;
    return {
      value: normalizeHexString(record && "value" in record ? record.value : input),
      settings: {
        persist: record && "persist" in record ? record.persist : undefined,
        onLiveChange: record && "onLiveChange" in record ? record.onLiveChange : undefined,
      },
    };
  },
  sanitize: (value) => normalizeHexString(value),
});
