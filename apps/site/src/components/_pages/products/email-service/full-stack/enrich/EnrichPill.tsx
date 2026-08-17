import SwapPill from "@/components/_animations/shared/swap/SwapPill";
import Icon from "@/components/icon/Icon";
import { CLASSIFICATIONS } from "./classifications";

export type EnrichPhase = "idle" | "thinking" | "resolved";
export type EnrichPillDetail = {
  phase: EnrichPhase;
  dimension: number;
  value: number;
};

export default function EnrichPill() {
  return (
    <SwapPill<EnrichPillDetail>
      channel="enrich-pill"
      className="size-full"
      face={(detail) => {
        if (detail.phase === "idle") return null;
        const classification = CLASSIFICATIONS[detail.dimension];
        const resolved = detail.phase === "resolved";
        return {
          swapKey: resolved ? classification.icon : "thinking",
          label: resolved
            ? classification.values[detail.value]
            : "AI Thinking...",
          icon: resolved ? (
            <Icon
              color="purple"
              name={classification.icon}
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
      initial={{ phase: "idle", dimension: 0, value: 0 }}
      labelClassName="relative flex h-20 flex-1 items-center px-4"
      rowClassName="flex size-full items-center gap-8 p-10"
    />
  );
}
