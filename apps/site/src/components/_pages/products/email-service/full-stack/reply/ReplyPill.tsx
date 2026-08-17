import SwapPill from "@/components/_animations/shared/swap/SwapPill";
import Icon from "@/components/icon/Icon";
import { ACTIONS, type ReplyPillDetail } from "./actions";

export default function ReplyPill() {
  return (
    <SwapPill<ReplyPillDetail>
      channel="reply-pill"
      className="size-full"
      face={(detail) => {
        if (detail.phase === "idle") return null;
        const action = ACTIONS[detail.index % ACTIONS.length];
        const resolved = detail.phase === "resolved";
        return {
          swapKey: resolved ? "resolved" : "working",
          label: resolved ? action.result : action.working,
          icon: resolved ? (
            <Icon
              className="text-icon-accent-success"
              name="checkmark-1-medium"
              size={20}
            />
          ) : (
            <Icon
              className="animate-spin text-icon-muted [animation-duration:0.7s] [animation-timing-function:steps(8)]"
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
