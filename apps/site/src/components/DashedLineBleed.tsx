import cn from "classnames";
import DashedLine from "@/components/dashed-line/DashedLine";

export default function DashedLineBleed({ className }: { className?: string }) {
  return (
    <>
      <DashedLine
        animateTowards="right"
        className={cn(
          "absolute left-full w-screen text-border-default",
          className
        )}
        direction="horizontal"
      />
      <DashedLine
        animateTowards="left"
        className={cn(
          "absolute right-full w-screen text-border-default",
          className
        )}
        direction="horizontal"
      />
    </>
  );
}
