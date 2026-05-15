import { PALETTE_THEMES, type PaletteThemeId } from "../theme/palette";

export type PaletteThemePickerProps = {
  value: PaletteThemeId;
  onChange: (id: PaletteThemeId) => void;
  gridStrokeColor?: string;
};

export const PaletteThemePicker = ({ value, onChange, gridStrokeColor }: PaletteThemePickerProps) => (
  <div className="palette-theme-picker" data-testid="palette-theme-picker">
    {PALETTE_THEMES.map((theme) => {
      const selected = value === theme.id;
      const strokeTrim = gridStrokeColor?.trim() ?? "";
      const neutralSyncedFill = theme.id === "neutral" && strokeTrim.length > 0 ? strokeTrim : theme.fillHex;
      const neutralSyncedP3 = theme.id === "neutral" && strokeTrim.length > 0 ? strokeTrim : theme.fillDisplayP3;
      return (
        <button
          key={theme.id}
          type="button"
          data-testid={`palette-theme-swatch-${theme.id}`}
          data-selected={selected ? "true" : undefined}
          className="palette-theme-swatch"
          style={{
            borderColor: selected ? neutralSyncedFill : "#f3f3f3",
            ["--palette-fill-fallback" as string]: neutralSyncedFill,
            ["--palette-fill-p3" as string]: neutralSyncedP3,
          }}
          onClick={() => onChange(theme.id)}
        >
          <span className="palette-theme-swatch-fill" />
        </button>
      );
    })}
  </div>
);
