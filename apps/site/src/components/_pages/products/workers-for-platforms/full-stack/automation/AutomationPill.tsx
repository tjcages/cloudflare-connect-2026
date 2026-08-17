import SwapPill from "@/components/_animations/shared/swap/SwapPill";
import Icon from "@/components/icon/Icon";
import { AUTOMATION_EVENTS } from "./events";

export type AutomationPhase = "idle" | "trigger" | "result";
export type AutomationPillDetail = { phase: AutomationPhase; index: number };

export default function AutomationPill() {
  return (
    <SwapPill<AutomationPillDetail>
      channel="automation-pill"
      className="size-full"
      face={(detail) => {
        if (detail.phase === "idle") return null;
        const event = AUTOMATION_EVENTS[detail.index];
        const resolved = detail.phase === "result";
        return {
          swapKey: resolved ? event.icon : "loader",
          label: resolved ? event.result : event.trigger,
          icon: resolved ? (
            <Icon
              className={event.iconClass}
              color="purple"
              name={event.icon}
              size={20}
              variant="duo"
            />
          ) : (
            <Icon
              className="animate-spin text-icon-base [animation-duration:0.7s] [animation-timing-function:steps(8)]"
              name="loader"
              size={20}
            />
          ),
        };
      }}
      initial={{ phase: "idle", index: 0 }}
      labelClassName="relative flex h-20 flex-1 items-center px-4"
      rowClassName="flex size-full items-center gap-8 p-10"
    />
  );
}
