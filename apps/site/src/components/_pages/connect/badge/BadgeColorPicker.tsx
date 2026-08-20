import { HexColorInput, HexColorPicker } from "react-colorful";
import cn from "classnames";
import { useState } from "react";
import Dropdown from "@/components/dropdown/Dropdown";
import type { BadgeParams } from "./badge-params";
import {
  DEFAULT_BADGE_COLOR,
  findBadgeTheme,
  isBadgePickerTheme,
  parseBadgeHex,
  themeFromHex,
} from "./badge-themes";
import BadgeThemeSwatch from "./BadgeThemeSwatch";
import "./BadgeColorPicker.css";

export default function BadgeColorPicker({
  params,
  onChange,
}: {
  params: BadgeParams;
  onChange: (next: BadgeParams) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = isBadgePickerTheme(params.theme);
  const color = parseBadgeHex(params.color) ?? DEFAULT_BADGE_COLOR;
  const swatch = themeFromHex(color);

  const setColor = (next: string) => {
    const parsed = parseBadgeHex(next);
    if (!parsed) return;
    onChange({ ...params, theme: "custom", color: parsed });
  };

  return (
    <Dropdown
      align="start"
      label="Custom color"
      onOpenChange={(next) => {
        setOpen(next);
        if (!next || isBadgePickerTheme(params.theme)) return;
        onChange({
          ...params,
          theme: "custom",
          color: findBadgeTheme(params.theme).accent,
        });
      }}
      open={open}
      panelClassName="w-240 overflow-hidden rounded-12"
      scroll={false}
      side="top"
      trigger={
        <button
          aria-checked={selected}
          aria-label="Custom color"
          className={cn(
            "flex size-40 items-center justify-center rounded-full transition-transform",
            selected
              ? "shadow-[inset_0_0_0_2px_var(--color-orange-900)]"
              : "hover:scale-105"
          )}
          role="radio"
          type="button"
        >
          <BadgeThemeSwatch theme={swatch} />
        </button>
      }
    >
      <div className="flex items-center justify-between border-b border-border-muted px-12 py-8">
        <span className="text-label-tiny text-text-base">Color</span>
        <span className="text-label-tiny text-text-muted tabular-nums">
          {color}
        </span>
      </div>
      <div
        className="badge-color-picker flex flex-col gap-8 p-12"
        onKeyDown={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <HexColorPicker color={color} onChange={setColor} />
        <HexColorInput
          aria-label="Hex color"
          className="h-26 rounded-6 bg-background-faint px-8 text-label-tiny text-text-base tabular-nums outline-none"
          color={color}
          onChange={setColor}
          prefixed
        />
      </div>
    </Dropdown>
  );
}
