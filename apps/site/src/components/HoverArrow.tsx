import cn from "classnames";
import Icon from "@/components/icon/Icon";

export default function HoverArrow({
  color,
  className,
}: {
  color?: string;
  className?: string;
}) {
  return (
    <Icon
      className={cn(
        className,
        color,
        "-translate-x-4 opacity-0 blur-[2px] transition-all duration-150 group-hover:translate-x-0 group-hover:opacity-100 group-hover:blur-[0px]"
      )}
      name="arrow-right"
    />
  );
}
