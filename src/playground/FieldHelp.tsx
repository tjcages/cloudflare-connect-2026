import { useId, useLayoutEffect, useRef, useState, type MouseEvent } from "react";
import { createPortal } from "react-dom";

type FieldHelpProps = {
  label: string;
  description: string;
};

const TOOLTIP_WIDTH = 176;
const TOOLTIP_MARGIN = 8;
const TOOLTIP_GAP = 4;
const TOOLTIP_ESTIMATED_HEIGHT = 56;

export function FieldHelp({ label, description }: FieldHelpProps) {
  const tooltipId = useId();
  const labelRef = useRef<HTMLButtonElement>(null);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const visible = hovered || focused;

  const stopLabelActivation = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };

  useLayoutEffect(() => {
    if (!visible) {
      setPosition(null);
      return;
    }

    const updatePosition = () => {
      const rect = labelRef.current?.getBoundingClientRect();
      if (!rect) {
        return;
      }
      const maxLeft = window.innerWidth - TOOLTIP_WIDTH - TOOLTIP_MARGIN;
      const left = Math.max(TOOLTIP_MARGIN, Math.min(rect.left, maxLeft));
      const bottomTop = rect.bottom + TOOLTIP_GAP;
      const top =
        bottomTop + TOOLTIP_ESTIMATED_HEIGHT > window.innerHeight
          ? Math.max(TOOLTIP_MARGIN, rect.top - TOOLTIP_ESTIMATED_HEIGHT - TOOLTIP_GAP)
          : bottomTop;
      setPosition({ left, top });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [visible]);

  return (
    <span className="inline-flex min-w-0 items-center">
      <button
        type="button"
        ref={labelRef}
        className="min-w-0 cursor-help rounded-sm bg-transparent p-0 text-left text-inherit focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-400"
        aria-describedby={visible ? tooltipId : undefined}
        onMouseDown={stopLabelActivation}
        onClick={stopLabelActivation}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      >
        {label}
      </button>
      {visible && position && typeof document !== "undefined"
        ? createPortal(
            <span
              id={tooltipId}
              role="tooltip"
              className="fixed z-50 w-44 rounded border border-neutral-200 bg-white px-2 py-1.5 text-left text-[11px] font-normal leading-4 text-neutral-600 shadow-sm"
              style={{ left: position.left, top: position.top }}
            >
              {description}
            </span>,
            document.body,
          )
        : null}
    </span>
  );
}
