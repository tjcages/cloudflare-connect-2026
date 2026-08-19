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
}: IHeaderNavItem &
  React.HTMLAttributes<
    HTMLAnchorElement | HTMLDivElement | HTMLButtonElement
  >) {
  const classNames = cn(
    "header-nav-item group/nav-item relative flex rounded-full px-8 py-6 text-label-x-small text-text-base transition-all outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--color-orange-900)]",
    className
  );

  const children = (
    <>
      <span className="px-6">{label}</span>
      {"dropdown" in props && (
        <Icon
          className="transition group-hover/nav-item:rotate-180 group-aria-expanded/nav-item:rotate-180"
          name="chevron-down-small"
        />
      )}
    </>
  );

  if ("href" in props) {
    const { href, ...rest } = props;
    return (
      <a className={classNames} href={href} {...rest}>
        {children}
      </a>
    );
  }

  if ("dropdown" in props) {
    const { dropdown: _dropdown, ...rest } = props;
    return (
      <button
        {...rest}
        aria-haspopup="true"
        className={classNames}
        type="button"
      >
        {children}
      </button>
    );
  }

  const _exhaustive: never = props;
  return _exhaustive;
}
