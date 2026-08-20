import { useRef } from "react";
import cn from "classnames";

export default function BadgeInspectorField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix = "",
  active = false,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  active?: boolean;
}) {
  const drag = useRef<{ x: number; value: number } | null>(null);

  const clamp = (next: number) => {
    const snapped = Math.round(next / step) * step;
    return Math.min(max, Math.max(min, snapped));
  };

  return (
    <label
      className={cn(
        "flex h-26 min-w-0 items-center gap-4 rounded-6 py-2 pr-6 pl-4",
        active ? "bg-background-muted" : "bg-background-faint"
      )}
    >
      <span
        aria-label={label}
        aria-valuemax={max}
        aria-valuemin={min}
        aria-valuenow={value}
        className="flex h-full shrink-0 cursor-ew-resize touch-none items-center text-label-tiny text-text-muted select-none hover:text-text-base focus-visible:text-orange-900 focus-visible:outline-none"
        onKeyDown={(event) => {
          const mult = event.shiftKey ? 10 : 1;
          if (event.key === "ArrowUp" || event.key === "ArrowRight") {
            event.preventDefault();
            onChange(clamp(value + step * mult));
          } else if (event.key === "ArrowDown" || event.key === "ArrowLeft") {
            event.preventDefault();
            onChange(clamp(value - step * mult));
          }
        }}
        onPointerDown={(event) => {
          (event.target as HTMLElement).setPointerCapture(event.pointerId);
          drag.current = { x: event.clientX, value };
        }}
        onPointerMove={(event) => {
          if (!drag.current) return;
          onChange(
            clamp(
              drag.current.value + ((event.clientX - drag.current.x) / 2) * step
            )
          );
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        role="slider"
        tabIndex={0}
      >
        {label}
      </span>
      <input
        aria-label={`${label} value`}
        className="min-w-0 flex-1 bg-transparent text-label-tiny text-text-base tabular-nums outline-none"
        inputMode="numeric"
        onChange={(event) => {
          const next = Number(event.target.value.replace(/[^\d-]/g, ""));
          if (!Number.isNaN(next)) onChange(clamp(next));
        }}
        value={value}
      />
      {suffix ? (
        <span className="shrink-0 text-label-tiny text-text-muted">
          {suffix}
        </span>
      ) : null}
    </label>
  );
}
