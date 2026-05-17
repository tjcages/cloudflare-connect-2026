import { PALETTE_THEMES, type PaletteThemeId } from "../theme/palette";

export type PaletteThemePickerProps = {
  value: PaletteThemeId;
  onChange: (id: PaletteThemeId) => void;
  gridStrokeColor?: string;
};

export const PaletteThemePicker = ({ value, onChange, gridStrokeColor }: PaletteThemePickerProps) => (
  <div className="flex flex-row flex-wrap items-center gap-2" data-testid="palette-theme-picker">
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
          className="box-border grid cursor-pointer place-items-center rounded-md border p-1 outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#9fc8ff] focus-visible:outline-offset-2"
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
