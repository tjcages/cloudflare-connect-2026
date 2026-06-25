import { type CSSProperties, type ReactNode, useEffect, useState } from "react";
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
import { HexColorInput, HexColorPicker } from "react-colorful";
import { cn } from "../lib/cn";
import { COLOR_LIBRARY } from "./colorLibrary";

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
  const normalizedColor = color.toLowerCase();

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
  const { getReferenceProps, getFloatingProps } = useInteractions([click, dismiss, role]);

  useEffect(() => {
    if (open) setTab("library");
  }, [open]);

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  return (
    <div className={cn("relative inline-flex", containerClassName)}>
      <button
        ref={refs.setReference}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        className={cn("cursor-pointer disabled:cursor-not-allowed", triggerClassName)}
        style={triggerStyle}
        {...getReferenceProps()}
      >
        {children}
      </button>
      {open && !disabled ? (
        <FloatingPortal>
          <div
            ref={refs.setFloating}
            className="z-[2147483647] flex w-56 flex-col gap-2 overflow-hidden rounded-md border border-neutral-300 bg-white p-2 shadow-lg"
            style={floatingStyles}
            {...getFloatingProps()}
          >
            <div className="flex shrink-0 rounded-md bg-neutral-100 p-0.5" role="tablist">
              {(["library", "picker"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={tab === value}
                  className={cn(
                    "flex-1 cursor-pointer rounded px-2 py-1 text-xs font-medium capitalize transition-colors",
                    tab === value ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500 hover:text-neutral-700",
                  )}
                  onClick={() => setTab(value)}
                >
                  {value}
                </button>
              ))}
            </div>
            {tab === "picker" ? (
              <div className="flex shrink-0 flex-col gap-2">
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
            ) : (
              <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1">
                {COLOR_LIBRARY.map((group) => (
                  <div key={group.name} className="flex flex-col gap-0.5">
                    <span className="px-1 py-0.5 text-[0.625rem] font-semibold uppercase tracking-wide text-neutral-400">
                      {group.name}
                    </span>
                    {group.colors.map((c) => {
                      const selected = c.hex.toLowerCase() === normalizedColor;
                      return (
                        <button
                          key={`${group.name}-${c.label}`}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => {
                            onChange(c.hex);
                            setOpen(false);
                          }}
                          className={cn(
                            "flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-left transition-colors hover:bg-neutral-100",
                            selected && "bg-neutral-100",
                          )}
                        >
                          <span
                            className={cn(
                              "size-5 shrink-0 rounded border",
                              selected ? "border-blue-500 ring-1 ring-blue-500" : "border-neutral-300",
                            )}
                            style={{ backgroundColor: c.hex }}
                          />
                          <span className="min-w-0 flex-1 truncate text-xs text-neutral-700">{c.label}</span>
                          <span className="shrink-0 font-mono text-[0.625rem] uppercase text-neutral-400">{c.hex}</span>
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
