import { type CSSProperties, type ReactNode, useEffect, useId, useRef, useState } from "react";
import { HexColorInput, HexColorPicker } from "react-colorful";
import { cn } from "../lib/cn";

type HexColorPopoverProps = {
  color: string;
  onChange: (hex: string) => void;
  disabled?: boolean;
  ariaLabel?: string;
  triggerClassName?: string;
  triggerStyle?: CSSProperties;
  children?: ReactNode;
  containerClassName?: string;
  align?: "left" | "right";
};

export const HexColorPopover = ({
  color,
  onChange,
  disabled,
  ariaLabel,
  triggerClassName,
  triggerStyle,
  children,
  containerClassName,
  align = "left",
}: HexColorPopoverProps) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const popoverId = useId();

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  return (
    <div ref={containerRef} className={cn("relative inline-flex", containerClassName)}>
      <button
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={open ? popoverId : undefined}
        className={cn("cursor-pointer disabled:cursor-not-allowed", triggerClassName)}
        style={triggerStyle}
        onClick={() => {
          if (!disabled) setOpen((prev) => !prev);
        }}
      >
        {children}
      </button>
      {open && !disabled ? (
        <div
          id={popoverId}
          className={cn(
            "absolute top-[calc(100%+0.375rem)] z-50 flex flex-col gap-2 rounded-md border border-neutral-300 bg-white p-2 shadow-lg",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          <HexColorPicker color={color} onChange={onChange} />
          <div className="flex items-center rounded border border-neutral-300 px-2 py-1 font-mono text-xs">
            <HexColorInput
              color={color}
              onChange={onChange}
              prefixed
              aria-label={ariaLabel ? `${ariaLabel} hex value` : "Hex color value"}
              className="w-full min-w-0 border-0 bg-transparent uppercase outline-none"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
};
