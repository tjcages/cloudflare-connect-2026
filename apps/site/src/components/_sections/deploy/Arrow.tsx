import RightArrow from "./_svg/RightArrow.svg?react";
import RightArrowSrc from "./_svg/RightArrow.svg";
import type { RefObject } from "react";
import cn from "classnames";

export default function DeployGithubArrow({
  ref,
  wrapperRef,
  lineClassName,
}: {
  ref: RefObject<HTMLDivElement | null>;
  wrapperRef: RefObject<HTMLDivElement | null>;
  lineClassName: string;
}) {
  return (
    <div className="relative flex-center">
      <div
        ref={wrapperRef}
        style={{ maskImage: `url(${RightArrowSrc.src})` }}
        className="relative overflow-clip"
      >
        <RightArrow className="text-border-dashed" />
        <span
          ref={ref}
          className={cn("absolute top-0 -left-20 h-6 w-20", lineClassName)}
        />
      </div>
    </div>
  );
}
