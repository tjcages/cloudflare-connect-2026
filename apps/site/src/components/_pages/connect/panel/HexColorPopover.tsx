import {
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  autoUpdate,
  flip,
  FloatingPortal,
  offset,
  shift,
  size,
  useClick,
  useDismiss,
  useFloating,
  useInteractions,
  useRole,
} from "@floating-ui/react";
import { cn } from "./cn";
import { COLOR_LIBRARY, cssColorForHex } from "./colorLibrary";

type PopoverTab = "library" | "picker";

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

type RgbColor = { r: number; g: number; b: number };
type HsvColor = { h: number; s: number; v: number };

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeHex(value: string): string {
  const raw = value.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(raw)) return "#ffffff";
  return `#${raw.toLowerCase()}`;
}

function channelToHex(value: number): string {
  return clamp(Math.round(value), 0, 255).toString(16).padStart(2, "0");
}

function hexToRgb(hex: string): RgbColor {
  const normalized = normalizeHex(hex).replace(/^#/, "");
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

function rgbToHex({ r, g, b }: RgbColor): string {
  return `#${channelToHex(r)}${channelToHex(g)}${channelToHex(b)}`;
}

function rgbToHsv({ r, g, b }: RgbColor): HsvColor {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  let h = 0;

  if (delta > 0) {
    if (max === rn) h = ((gn - bn) / delta) % 6;
    else if (max === gn) h = (bn - rn) / delta + 2;
    else h = (rn - gn) / delta + 4;
    h *= 60;
    if (h < 0) h += 360;
  }

  return {
    h,
    s: max <= 0 ? 0 : (delta / max) * 100,
    v: max * 100,
  };
}

function hsvToRgb({ h, s, v }: HsvColor): RgbColor {
  const hue = ((h % 360) + 360) % 360;
  const sat = clamp(s, 0, 100) / 100;
  const val = clamp(v, 0, 100) / 100;
  const chroma = val * sat;
  const x = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = val - chroma;
  const [rp, gp, bp] =
    hue < 60
      ? [chroma, x, 0]
      : hue < 120
        ? [x, chroma, 0]
        : hue < 180
          ? [0, chroma, x]
          : hue < 240
            ? [0, x, chroma]
            : hue < 300
              ? [x, 0, chroma]
              : [chroma, 0, x];

  return {
    r: (rp + m) * 255,
    g: (gp + m) * 255,
    b: (bp + m) * 255,
  };
}

function hsvToHex(hsv: HsvColor): string {
  return rgbToHex(hsvToRgb(hsv));
}

type EmbeddedHexColorPickerProps = {
  color: string;
  onChange: (hex: string) => void;
};

function EmbeddedHexColorPicker({
  color,
  onChange,
}: EmbeddedHexColorPickerProps) {
  const hsv = useMemo(() => rgbToHsv(hexToRgb(color)), [color]);
  const saturationRef = useRef<HTMLButtonElement | null>(null);
  const hueRef = useRef<HTMLButtonElement | null>(null);

  const updateSaturation = useCallback(
    (clientX: number, clientY: number) => {
      const rect = saturationRef.current?.getBoundingClientRect();
      if (!rect) return;
      const s = clamp(
        ((clientX - rect.left) / Math.max(1, rect.width)) * 100,
        0,
        100
      );
      const v = clamp(
        (1 - (clientY - rect.top) / Math.max(1, rect.height)) * 100,
        0,
        100
      );
      onChange(hsvToHex({ h: hsv.h, s, v }));
    },
    [hsv.h, onChange]
  );

  const updateSaturationFromOffset = useCallback(
    (offsetX: number, offsetY: number, width: number, height: number) => {
      const s = clamp((offsetX / Math.max(1, width)) * 100, 0, 100);
      const v = clamp((1 - offsetY / Math.max(1, height)) * 100, 0, 100);
      onChange(hsvToHex({ h: hsv.h, s, v }));
    },
    [hsv.h, onChange]
  );

  const updateHue = useCallback(
    (clientX: number) => {
      const rect = hueRef.current?.getBoundingClientRect();
      if (!rect) return;
      const h = clamp(
        ((clientX - rect.left) / Math.max(1, rect.width)) * 360,
        0,
        360
      );
      onChange(hsvToHex({ ...hsv, h }));
    },
    [hsv, onChange]
  );

  const updateHueFromOffset = useCallback(
    (offsetX: number, width: number) => {
      const h = clamp((offsetX / Math.max(1, width)) * 360, 0, 360);
      onChange(hsvToHex({ ...hsv, h }));
    },
    [hsv, onChange]
  );

  const beginPointerDrag = useCallback(
    (
      event: ReactPointerEvent<HTMLButtonElement>,
      update: (clientX: number, clientY: number) => void
    ) => {
      event.preventDefault();
      update(event.clientX, event.clientY);

      const handleMove = (moveEvent: PointerEvent) => {
        moveEvent.preventDefault();
        update(moveEvent.clientX, moveEvent.clientY);
      };
      const handleEnd = () => {
        window.removeEventListener("pointermove", handleMove);
        window.removeEventListener("pointerup", handleEnd);
        window.removeEventListener("pointercancel", handleEnd);
      };

      window.addEventListener("pointermove", handleMove, { passive: false });
      window.addEventListener("pointerup", handleEnd);
      window.addEventListener("pointercancel", handleEnd);
    },
    []
  );

  return (
    <div className="flex w-200 flex-col gap-3">
      <button
        type="button"
        ref={saturationRef}
        role="slider"
        aria-label="Color"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(hsv.v)}
        aria-valuetext={`Saturation ${Math.round(hsv.s)}%, Brightness ${Math.round(hsv.v)}%`}
        className="rounded-lg relative h-164 w-200 cursor-crosshair touch-none overflow-hidden border-0 p-0"
        style={{
          backgroundColor: `hsl(${hsv.h}, 100%, 50%)`,
          backgroundImage:
            "linear-gradient(0deg, #000, transparent), linear-gradient(90deg, #fff, rgba(255,255,255,0))",
          boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.06)",
        }}
        onPointerDown={(event) => beginPointerDrag(event, updateSaturation)}
        onMouseDown={(event: ReactMouseEvent<HTMLButtonElement>) =>
          updateSaturationFromOffset(
            event.nativeEvent.offsetX,
            event.nativeEvent.offsetY,
            event.currentTarget.clientWidth,
            event.currentTarget.clientHeight
          )
        }
        onClick={(event: ReactMouseEvent<HTMLButtonElement>) =>
          updateSaturationFromOffset(
            event.nativeEvent.offsetX,
            event.nativeEvent.offsetY,
            event.currentTarget.clientWidth,
            event.currentTarget.clientHeight
          )
        }
      >
        <span
          className="border-white pointer-events-none absolute size-7 rounded-full border-2 shadow-[0_2px_4px_rgba(0,0,0,0.25)]"
          style={{
            left: `${hsv.s}%`,
            top: `${100 - hsv.v}%`,
            transform: "translate(-50%, -50%)",
            backgroundColor: cssColorForHex(color),
          }}
        />
      </button>
      <button
        type="button"
        ref={hueRef}
        role="slider"
        aria-label="Hue"
        aria-valuemin={0}
        aria-valuemax={360}
        aria-valuenow={Math.round(hsv.h)}
        className="rounded-b-lg relative h-6 w-200 cursor-ew-resize touch-none border-0 p-0"
        style={{
          background:
            "linear-gradient(90deg, red 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, red 100%)",
        }}
        onPointerDown={(event) =>
          beginPointerDrag(event, (clientX) => updateHue(clientX))
        }
        onMouseDown={(event: ReactMouseEvent<HTMLButtonElement>) =>
          updateHueFromOffset(
            event.nativeEvent.offsetX,
            event.currentTarget.clientWidth
          )
        }
        onClick={(event: ReactMouseEvent<HTMLButtonElement>) =>
          updateHueFromOffset(
            event.nativeEvent.offsetX,
            event.currentTarget.clientWidth
          )
        }
      >
        <span
          className="border-white pointer-events-none absolute top-1/2 size-7 rounded-full border-2 shadow-[0_2px_4px_rgba(0,0,0,0.25)]"
          style={{
            left: `${(hsv.h / 360) * 100}%`,
            transform: "translate(-50%, -50%)",
            backgroundColor: `hsl(${hsv.h}, 100%, 50%)`,
          }}
        />
      </button>
    </div>
  );
}

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
  const [tab, setTab] = useState<PopoverTab>("library");
  const selectedLibraryButtonRef = useRef<HTMLButtonElement | null>(null);
  const normalizedColor = normalizeHex(color);
  const [draftColor, setDraftColor] = useState(normalizedColor);
  const [hexDraft, setHexDraft] = useState(normalizedColor.toUpperCase());
  const displayColor = open ? draftColor : normalizedColor;

  const pendingColor = useRef<string | null>(null);
  const colorRaf = useRef<number | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const lastSentColor = useRef(normalizedColor);

  useEffect(
    () => () => {
      if (colorRaf.current != null) cancelAnimationFrame(colorRaf.current);
      const pending = pendingColor.current;
      pendingColor.current = null;
      if (pending && pending !== lastSentColor.current) {
        lastSentColor.current = pending;
        onChangeRef.current(pending);
      }
    },
    []
  );

  const updateColor = useCallback((hex: string) => {
    const next = normalizeHex(hex);
    setDraftColor(next);
    setHexDraft(next.toUpperCase());
    pendingColor.current = next;
    if (colorRaf.current != null) return;
    colorRaf.current = requestAnimationFrame(() => {
      colorRaf.current = null;
      const pending = pendingColor.current;
      pendingColor.current = null;
      if (!pending || pending === lastSentColor.current) return;
      lastSentColor.current = pending;
      onChangeRef.current(pending);
    });
  }, []);

  const commitHexDraft = useCallback(() => {
    const raw = hexDraft.trim().replace(/^#/, "");
    if (!/^[0-9a-fA-F]{6}$/.test(raw)) {
      setHexDraft(displayColor.toUpperCase());
      return;
    }
    const next = normalizeHex(raw);
    setHexDraft(next.toUpperCase());
    updateColor(next);
  }, [displayColor, hexDraft, updateColor]);

  const handleHexInputKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLInputElement>) => {
      event.stopPropagation();
      if (event.key === "Enter") {
        event.currentTarget.blur();
      }
      if (event.key === "Escape") {
        setHexDraft(displayColor.toUpperCase());
        event.currentTarget.blur();
      }
    },
    [displayColor]
  );

  const { refs, floatingStyles, context } = useFloating({
    open: open && !disabled,
    onOpenChange: setOpen,
    placement: align === "right" ? "bottom-end" : "bottom-start",
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(6),
      flip({ padding: 8 }),
      shift({ padding: 8 }),
      size({
        padding: 8,
        apply({ availableHeight, elements }) {
          elements.floating.style.maxHeight = `${Math.max(220, availableHeight)}px`;
        },
      }),
    ],
  });

  const click = useClick(context, { enabled: !disabled });
  const dismiss = useDismiss(context);
  const role = useRole(context, { role: "dialog" });
  const { getReferenceProps, getFloatingProps } = useInteractions([
    click,
    dismiss,
    role,
  ]);

  useEffect(() => {
    if (pendingColor.current) return;
    lastSentColor.current = normalizedColor;
    setDraftColor(normalizedColor);
    setHexDraft(normalizedColor.toUpperCase());
  }, [normalizedColor]);

  useEffect(() => {
    setHexDraft(displayColor.toUpperCase());
  }, [displayColor]);

  useEffect(() => {
    if (open) setTab("library");
  }, [open]);

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  useEffect(() => {
    if (!open || disabled || tab !== "library") return;
    const frame = requestAnimationFrame(() => {
      selectedLibraryButtonRef.current?.scrollIntoView({ block: "center" });
    });
    return () => cancelAnimationFrame(frame);
  }, [disabled, displayColor, open, tab]);

  return (
    <div className={cn("relative inline-flex", containerClassName)}>
      <button
        ref={refs.setReference}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        className={cn(
          "cursor-pointer disabled:cursor-not-allowed",
          triggerClassName
        )}
        style={triggerStyle}
        {...getReferenceProps()}
      >
        {children}
      </button>
      {open && !disabled ? (
        <FloatingPortal>
          <div
            ref={refs.setFloating}
            data-hex-color-popover
            className="rounded-md border-neutral-300 bg-white z-2147483647 flex w-56 flex-col gap-2 overflow-hidden border p-2 shadow-lg"
            style={floatingStyles}
            {...getFloatingProps()}
          >
            <div
              className="rounded-md bg-neutral-100 flex shrink-0 p-0.5"
              role="tablist"
            >
              {(["library", "picker"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={tab === value}
                  className={cn(
                    "rounded text-xs flex-1 cursor-pointer px-2 py-1 font-medium capitalize transition-colors",
                    tab === value
                      ? "bg-white text-neutral-900 shadow-sm"
                      : "text-neutral-500 hover:text-neutral-700"
                  )}
                  onClick={() => setTab(value)}
                >
                  {value}
                </button>
              ))}
            </div>
            {tab === "picker" ? (
              <div className="flex shrink-0 flex-col gap-2">
                <EmbeddedHexColorPicker
                  color={displayColor}
                  onChange={updateColor}
                />
                <div className="rounded border-neutral-300 text-xs flex items-center border px-2 py-1 font-mono">
                  <input
                    value={hexDraft}
                    onChange={(event) => {
                      const raw = event.target.value.trim();
                      const withoutHash = raw.replace(/^#/, "");
                      if (/^[0-9a-fA-F]{0,6}$/.test(withoutHash)) {
                        setHexDraft(
                          withoutHash.length > 0
                            ? `#${withoutHash.toUpperCase()}`
                            : ""
                        );
                      }
                      if (/^[0-9a-fA-F]{6}$/.test(withoutHash)) {
                        updateColor(`#${withoutHash}`);
                      }
                    }}
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => event.stopPropagation()}
                    onKeyDown={handleHexInputKeyDown}
                    onBlur={commitHexDraft}
                    aria-label={
                      ariaLabel ? `${ariaLabel} hex value` : "Hex color value"
                    }
                    className="w-full min-w-0 border-0 bg-transparent uppercase outline-none"
                  />
                </div>
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1">
                {COLOR_LIBRARY.map((group) => (
                  <div key={group.name} className="flex flex-col gap-0.5">
                    <span className="text-neutral-400 px-1 py-0.5 text-[0.625rem] font-semibold tracking-wide uppercase">
                      {group.name}
                    </span>
                    {group.colors.map((c) => {
                      const selected = c.hex.toLowerCase() === displayColor;
                      return (
                        <button
                          ref={selected ? selectedLibraryButtonRef : undefined}
                          key={`${group.name}-${c.label}`}
                          type="button"
                          aria-pressed={selected}
                          title={
                            c.oklch
                              ? `${c.oklch} / ${c.p3 ?? c.hex} / fallback ${c.hex.toUpperCase()}`
                              : c.p3
                                ? `${c.p3} / fallback ${c.hex.toUpperCase()}`
                                : c.hex.toUpperCase()
                          }
                          onClick={() => {
                            updateColor(c.hex);
                            setOpen(false);
                          }}
                          className={cn(
                            "rounded hover:bg-neutral-100 flex cursor-pointer items-center gap-2 px-1 py-1 text-left transition-colors",
                            selected && "bg-neutral-100"
                          )}
                        >
                          <span
                            className={cn(
                              "rounded size-5 shrink-0 border",
                              selected
                                ? "border-blue-500 ring-1 ring-blue-500"
                                : "border-neutral-300"
                            )}
                            style={{ backgroundColor: cssColorForHex(c.hex) }}
                          />
                          <span className="text-xs text-neutral-700 min-w-0 flex-1 truncate">
                            {c.label}
                          </span>
                          <span className="text-neutral-400 shrink-0 font-mono text-[0.625rem] uppercase">
                            {c.hex}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>
        </FloatingPortal>
      ) : null}
    </div>
  );
};
