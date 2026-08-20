import { useRef } from "react";
import cn from "classnames";

function fieldSurface(tone: "light" | "dark", active: boolean): string {
  switch (tone) {
    case "dark":
      return active ? "bg-white/15" : "bg-white/10";
    case "light":
      return active ? "bg-background-muted" : "bg-background-faint";
    default: {
      const _never: never = tone;
      return _never;
    }
  }
}

export default function BadgeInspectorField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix = "",
  active = false,
  className,
  tone = "light",
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  active?: boolean;
  className?: string;
  tone?: "light" | "dark";
}) {
  const drag = useRef<{ x: number; value: number } | null>(null);
  const onDark = tone === "dark";

  const clamp = (next: number) => {
    const snapped = Math.round(next / step) * step;
    return Math.min(max, Math.max(min, snapped));
  };

  return (
    <label
      className={cn(
        "flex h-26 min-w-0 items-center gap-4 rounded-6 py-2 pr-6 pl-4",
        fieldSurface(tone, active),
        className
      )}
    >
      <span
        aria-label={label}
        aria-valuemax={max}
        aria-valuemin={min}
        aria-valuenow={value}
        className={cn(
          "flex h-full shrink-0 cursor-ew-resize touch-none items-center text-label-tiny select-none focus-visible:text-orange-900 focus-visible:outline-none",
          onDark
            ? "text-white/55 hover:text-white"
            : "text-text-muted hover:text-text-base"
        )}
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
        className={cn(
          "min-w-0 flex-1 bg-transparent text-label-tiny tabular-nums outline-none",
          onDark ? "text-white" : "text-text-base"
        )}
        inputMode="numeric"
        onChange={(event) => {
          const next = Number(event.target.value.replace(/[^\d-]/g, ""));
          if (!Number.isNaN(next)) onChange(clamp(next));
        }}
        value={value}
      />
      {suffix ? (
        <span
          className={cn(
            "shrink-0 text-label-tiny",
            onDark ? "text-white/55" : "text-text-muted"
          )}
        >
          {suffix}
        </span>
      ) : null}
    </label>
  );
}
