import { type CSSProperties, type ReactNode, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { HexColorInput, HexColorPicker } from "react-colorful";
import { cn } from "../lib/cn";

type HexColorPopoverProps = {
  /** Current color as a hex string, e.g. `#aabbcc`. */
  color: string;
  /** Called with a hex string (prefixed with `#`) whenever the color changes. */
  onChange: (hex: string) => void;
  disabled?: boolean;
  ariaLabel?: string;
  /** Classes applied to the swatch trigger button. */
  triggerClassName?: string;
  triggerStyle?: CSSProperties;
  /** Optional content rendered inside the trigger (e.g. a color preview). */
  children?: ReactNode;
  /** Classes applied to the relative wrapper around the trigger and popover. */
  containerClassName?: string;
  /** Horizontal edge the popover is anchored to. Defaults to `left`. */
  align?: "left" | "right";
};

/**
 * Color picker that opens a hex-first popover instead of the OS-controlled
 * native `<input type="color">` dialog. The text field shows hex by default.
 */
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
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties>({});
  const popoverId = useId();

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (containerRef.current?.contains(target) || popoverRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
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
    if (!open) {
      return;
    }
    const updatePosition = () => {
      const trigger = triggerRef.current;
      const popover = popoverRef.current;
      if (!trigger || !popover) {
        return;
      }
      const triggerRect = trigger.getBoundingClientRect();
      const popoverRect = popover.getBoundingClientRect();
      const gap = 6;
      const viewportPadding = 8;
      const idealLeft = align === "right" ? triggerRect.right - popoverRect.width : triggerRect.left;
      const left = Math.min(
        Math.max(viewportPadding, idealLeft),
        window.innerWidth - popoverRect.width - viewportPadding,
      );
      const top = Math.min(triggerRect.bottom + gap, window.innerHeight - popoverRect.height - viewportPadding);
      setPopoverStyle({
        position: "fixed",
        left,
        top,
        zIndex: 100100,
      });
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, align]);

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  const popover =
    open && !disabled
      ? createPortal(
          <div
            id={popoverId}
            ref={popoverRef}
            style={popoverStyle}
            className="flex flex-col gap-2 rounded-md border border-neutral-300 bg-white p-2 shadow-lg"
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
          </div>,
          document.body,
        )
      : null;

  return (
    <div ref={containerRef} className={cn("relative inline-flex", containerClassName)}>
      <button
        ref={triggerRef}
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
      {popover}
    </div>
  );
};
