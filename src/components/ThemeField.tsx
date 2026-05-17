import type { PaletteThemeId } from "../theme/palette";
import { PaletteThemePicker } from "./PaletteThemePicker";

type ThemeFieldProps = {
  value: PaletteThemeId;
  gridStrokeColor?: string;
  onChange: (theme: PaletteThemeId) => void;
};

export const ThemeField = ({ value, gridStrokeColor, onChange }: ThemeFieldProps) => (
  <div data-slot="builder-field" className="flex flex-col gap-1.5 text-[12px] text-builder-muted">
    <span>Theme</span>
    <PaletteThemePicker value={value} gridStrokeColor={gridStrokeColor} onChange={onChange} />
  </div>
);
