import { Menu } from "@base-ui/react/menu";
import cn from "classnames";
import type { ReactNode } from "react";
import ScrollArea from "@/components/ScrollArea";

export default function Dropdown({
  label,
  trigger,
  anchor,
  finalFocus,
  open,
  onOpenChange,
  panelClassName,
  side = "bottom",
  align = "start",
  scroll = true,
  children,
}: {
  label: string;
  trigger?: Menu.Trigger.Props["render"];
  anchor?: Menu.Positioner.Props["anchor"];
  finalFocus?: Menu.Popup.Props["finalFocus"];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  panelClassName?: string | string[];
  side?: Menu.Positioner.Props["side"];
  align?: Menu.Positioner.Props["align"];
  scroll?: boolean;
  children: ReactNode;
}) {
  return (
    <Menu.Root modal={false} onOpenChange={onOpenChange} open={open}>
      {trigger ? <Menu.Trigger render={trigger} /> : null}

      <Menu.Portal>
        <Menu.Positioner
          align={align}
          anchor={anchor}
          className="z-60 outline-none"
          collisionAvoidance={{
            align: "shift",
            fallbackAxisSide: "none",
            side: "shift",
          }}
          side={side}
          sideOffset={8}
        >
          <Menu.Popup
            aria-label={label}
            className={cn(
              "origin-(--transform-origin) bg-background-base shadow-elevation-default outline-none",
              "transition-[opacity,translate] duration-200 ease-[cubic-bezier(0.165,0.84,0.44,1)]",
              "data-ending-style:opacity-0 data-starting-style:opacity-0",
              side === "top"
                ? "data-ending-style:translate-y-4 data-starting-style:translate-y-4"
                : "data-ending-style:-translate-y-4 data-starting-style:-translate-y-4",
              panelClassName
            )}
            finalFocus={finalFocus}
          >
            {scroll ? (
              <ScrollArea viewportClassName="max-h-352">
                <div className="flex flex-col p-4">{children}</div>
              </ScrollArea>
            ) : (
              children
            )}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
