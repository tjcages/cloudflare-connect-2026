import cn from "classnames";
import { AnimatePresence } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useDebounceCallback } from "usehooks-ts";
import type { IslandProps } from "@/types/island-props";
import { setPageOverlayOwner } from "@/utils/page-overlay";
import CommandMenu from "./command-menu/CommandMenu";
import HeaderDropdown from "./HeaderDropdown";
import HeaderNavItem, { type IHeaderNavItem } from "./HeaderNavItem";
import type { IHeaderMenu } from "./menu/HeaderMenu";
import { connectNavItems } from "./connect/connect-nav";
import { productsMenu } from "./products/products-menu";
import { resourcesMenu } from "./resources/resources-menu";
import { solutionsMenu } from "./solutions/solutions-menu";

const defaultNavItems: IHeaderNavItem[] = [
  {
    label: "Products",
    dropdown: {
      menu: productsMenu,
    },
  },
  {
    label: "Solutions",
    dropdown: {
      menu: solutionsMenu,
    },
  },
  {
    label: "Resources",
    dropdown: {
      menu: resourcesMenu,
    },
  },
  {
    label: "Enterprise",
    href: "#",
  },
  {
    label: "Pricing",
    href: "#",
  },
];

export default function HeaderNav({
  className,
  itemClassName,
  variant = "default",
}: IslandProps<{
  className?: string;
  itemClassName?: string;
  /** `connect` uses Agenda / Speakers / Resources (menu built client-side). */
  variant?: "default" | "connect";
}>) {
  const navItems = variant === "connect" ? connectNavItems : defaultNavItems;
  const allowDropdowns = navItems.some((item) => "dropdown" in item);
  const [hoveredState, setHoveredState] = useState<{
    label: string;
    direction: 1 | -1;

    dropdown?: {
      menu: IHeaderMenu;
    };
  } | null>(null);

  const navRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const clearHoveredState = useDebounceCallback(
    () => setHoveredState(null),
    300
  );

  const isDropdownOpen = Boolean(allowDropdowns && hoveredState?.dropdown);

  useEffect(() => {
    setPageOverlayOwner("header", isDropdownOpen);
    return () => setPageOverlayOwner("header", false);
  }, [isDropdownOpen]);

  const openItem = (item: IHeaderNavItem) => {
    if (!allowDropdowns || !("dropdown" in item)) return;
    clearHoveredState.cancel();

    const navIndex = (label: string) =>
      navItems.findIndex((navItem) => navItem.label === label);

    setHoveredState((prev) => ({
      label: item.label,
      direction: prev && navIndex(item.label) < navIndex(prev.label) ? -1 : 1,
      dropdown: item.dropdown,
    }));
  };

  const closeMenu = useCallback(() => {
    clearHoveredState.cancel();
    setHoveredState(null);
  }, [clearHoveredState]);

  const prepareForCommandMenu = useCallback(
    (activeElement: HTMLElement | null) => {
      const focusFallback =
        activeElement && panelRef.current?.contains(activeElement)
          ? (navRef.current?.querySelector<HTMLElement>(
              '[aria-expanded="true"]'
            ) ?? null)
          : null;

      closeMenu();
      return focusFallback;
    },
    [closeMenu]
  );

  useEffect(() => {
    if (!isDropdownOpen) return;

    const isInsideMenu = (target: EventTarget | null) =>
      target instanceof Node &&
      Boolean(
        navRef.current?.contains(target) || panelRef.current?.contains(target)
      );

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;

      const trigger = navRef.current?.querySelector<HTMLElement>(
        '[aria-expanded="true"]'
      );

      closeMenu();
      trigger?.focus();
    };

    const onPointerDown = (event: PointerEvent) => {
      if (!isInsideMenu(event.target)) closeMenu();
    };

    const onFocusIn = (event: FocusEvent) => {
      if (!isInsideMenu(event.target)) closeMenu();
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("focusin", onFocusIn);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("focusin", onFocusIn);
    };
  }, [isDropdownOpen, closeMenu]);

  return (
    <>
      <div
        className={cn(
          "group relative flex items-center contain-paint",
          className
        )}
        ref={navRef}
      >
        {navItems.map((item) => {
          const isOpen =
            allowDropdowns &&
            "dropdown" in item &&
            hoveredState?.label === item.label &&
            Boolean(hoveredState?.dropdown);

          return (
            <HeaderNavItem
              key={item.label}
              {...item}
              className={cn(
                itemClassName,
                "group-has-[.header-nav-item:hover]:not-hover:text-text-muted!",
                "group-has-aria-expanded:not-hover:not-aria-expanded:text-text-muted!"
              )}
              onMouseEnter={() => openItem(item)}
              onMouseLeave={allowDropdowns ? clearHoveredState : undefined}
              {...(allowDropdowns &&
                "dropdown" in item && {
                  "aria-expanded": isOpen,
                  ...(isOpen && { "aria-controls": "header-dropdown-panel" }),
                  onKeyDown: (event: React.KeyboardEvent) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      if (isOpen) closeMenu();
                      else openItem(item);
                    } else if (event.key === "Escape") {
                      closeMenu();
                    }
                  },
                })}
            />
          );
        })}
      </div>

      <AnimatePresence>
        {allowDropdowns && hoveredState?.dropdown && (
          <HeaderDropdown
            {...hoveredState.dropdown}
            direction={hoveredState.direction}
            label={hoveredState.label}
            onMouseEnter={() => clearHoveredState.cancel()}
            onMouseLeave={clearHoveredState}
            panelRef={panelRef}
          />
        )}
      </AnimatePresence>

      <CommandMenu onBeforeOpen={prepareForCommandMenu} />
    </>
  );
}
