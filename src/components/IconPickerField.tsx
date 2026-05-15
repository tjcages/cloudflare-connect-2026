import type { IconId } from "../grid/types";
import { ICON_OPTIONS } from "../lib/iconRegistry";
import { ComponentIcon } from "./ComponentIcon";
import { SIDEBAR_LIST_ICON_PX } from "./iconTokens";

type IconPickerFieldProps = {
  iconId: IconId;
  iconFill: string;
  onIconIdChange: (next: IconId) => void;
};

export const IconPickerField = ({ iconId, iconFill, onIconIdChange }: IconPickerFieldProps) => (
  <div className="field">
    <span>Icon</span>
    <div className="icon-picker" data-testid="icon-picker">
      {ICON_OPTIONS.map((icon) => {
        const selected = iconId === icon.id;
        return (
          <button
            key={icon.id}
            className={selected ? "icon-picker-button icon-picker-button-active" : "icon-picker-button"}
            type="button"
            data-testid={`icon-picker-${icon.id}`}
            data-selected={selected ? "true" : undefined}
            onClick={() => onIconIdChange(icon.id as IconId)}
          >
            <ComponentIcon iconId={icon.id as IconId} color={iconFill} size={SIDEBAR_LIST_ICON_PX} />
          </button>
        );
      })}
    </div>
  </div>
);
