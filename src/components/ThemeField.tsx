import type { PaletteThemeId } from "../theme/palette";
import { PaletteThemePicker } from "./PaletteThemePicker";

type ThemeFieldProps = {
  value: PaletteThemeId;
  gridStrokeColor?: string;
  onChange: (theme: PaletteThemeId) => void;
};

export const ThemeField = ({ value, gridStrokeColor, onChange }: ThemeFieldProps) => (
  <div className="field">
    <span>Theme</span>
    <PaletteThemePicker value={value} gridStrokeColor={gridStrokeColor} onChange={onChange} />
  </div>
);
