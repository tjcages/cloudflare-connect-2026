import type { IconId } from "../grid/types";
import { ICON_OPTIONS } from "../lib/iconRegistry";
import { cn } from "../lib/cn";
import { BuilderField } from "./BuilderField";
import { ComponentIcon } from "./ComponentIcon";
import { SIDEBAR_LIST_ICON_PX } from "./iconTokens";

type IconPickerFieldProps = {
  iconId: IconId;
  iconFill: string;
  onIconIdChange: (next: IconId) => void;
};

export const IconPickerField = ({ iconId, iconFill, onIconIdChange }: IconPickerFieldProps) => (
  <BuilderField>
    <span>Icon</span>
    <div className="flex flex-wrap gap-1" data-testid="icon-picker">
      {ICON_OPTIONS.map((icon) => {
        const selected = iconId === icon.id;
        return (
          <button
            key={icon.id}
            className={cn(
              "grid size-6 cursor-pointer place-items-center rounded border-0 bg-builder-hover-row p-1 text-builder-control hover:bg-builder-active-surface",
              selected && "bg-builder-active-surface",
            )}
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
  </BuilderField>
);
