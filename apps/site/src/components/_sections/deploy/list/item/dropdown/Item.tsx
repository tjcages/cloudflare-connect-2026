import cn from "classnames";

export default function DeployListItemDropdownItem({
  label,
  icon,
  color,
  hovered,
}: {
  label: string;
  icon: React.ReactNode;
  color?: "red" | "black";
  hovered?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex w-full gap-10 rounded-8 p-6 text-body-x-small transition-all duration-200",
        color === "red" ? "text-text-accent-warning" : "text-text-base",
        hovered ? "bg-background-ghost" : "bg-background-base"
      )}
    >
      {icon}
      <span className="pr-10 whitespace-nowrap">{label}</span>
    </div>
  );
}
