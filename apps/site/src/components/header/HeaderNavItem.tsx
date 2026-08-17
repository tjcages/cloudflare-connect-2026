import cn from "classnames";
import Icon from "../icon/Icon";
import type { IHeaderMenu } from "./menu/HeaderMenu";

export type IHeaderNavItem = {
  label: string;
} & (
  | {
      dropdown: { menu: IHeaderMenu };
    }
  | {
      href: string;
    }
);

export default function HeaderNavItem({
  label,
  className,
  ...props
}: IHeaderNavItem & React.HTMLAttributes<HTMLAnchorElement | HTMLDivElement>) {
  const isDropdown = "dropdown" in props;
  const Tag = (
    "href" in props ? "a" : isDropdown ? "button" : "div"
  ) as React.ElementType;

  const propsWithoutDropdown =
    "dropdown" in props
      ? {
          ...props,
          dropdown: undefined,
        }
      : props;

  return (
    <Tag
      {...propsWithoutDropdown}
      {...(isDropdown && { type: "button", "aria-haspopup": "true" })}
      className={cn(
        "header-nav-item group/nav-item relative flex rounded-full px-8 py-6 text-label-x-small text-text-base transition-all outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--color-orange-900)]",
        className
      )}
    >
      <span className="px-6">{label}</span>

      {"dropdown" in props && (
        <Icon
          className="transition group-hover/nav-item:rotate-180 group-aria-expanded/nav-item:rotate-180"
          name="chevron-down-small"
        />
      )}
    </Tag>
  );
}
