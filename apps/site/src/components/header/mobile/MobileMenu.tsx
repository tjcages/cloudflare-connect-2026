import cn from "classnames";
import { useCallback, useEffect, useState } from "react";
import Icon from "@/components/icon/Icon";
import type { IslandProps } from "@/types/island-props";
import type { CatalogGroup } from "@/components/catalog/types";
import { headerProductGroups } from "@/constants/products";
import { headerResourceGroups } from "@/constants/resources";
import { headerSolutionGroups } from "@/constants/solutions";
import { connectResourceGroups } from "../connect/resources-data";

type MobileNavSection =
  | { label: string; href: string }
  | {
      label: string;
      groups: Pick<CatalogGroup, "label" | "items">[];
      seeAllLabel?: string;
      seeAllHref?: string;
    };

const defaultSections: MobileNavSection[] = [
  {
    label: "Products",
    groups: headerProductGroups,
    seeAllLabel: "See all products",
    seeAllHref: "/products",
  },
  {
    label: "Solutions",
    groups: headerSolutionGroups,
    seeAllLabel: "See all solutions",
    seeAllHref: "/solutions",
  },
  {
    label: "Resources",
    groups: headerResourceGroups,
    seeAllLabel: "See all resources",
    seeAllHref: "/resources",
  },
  { label: "Enterprise", href: "#" },
  { label: "Pricing", href: "#" },
];

const connectSections: MobileNavSection[] = [
  { label: "Agenda", href: "/connect#agenda" },
  { label: "Speakers", href: "/connect#speakers" },
  {
    label: "Resources",
    groups: connectResourceGroups,
  },
];

export default function MobileMenu({
  variant = "default",
}: IslandProps<{ variant?: "default" | "connect" }>) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const sections = variant === "connect" ? connectSections : defaultSections;

  const close = useCallback(() => {
    setOpen(false);
    setExpanded(null);
  }, []);

  useEffect(() => {
    document.body.classList.toggle("overflow-hidden", open);
    return () => document.body.classList.remove("overflow-hidden");
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };

    // Close when the viewport crosses back into the desktop header layout.
    const desktop = matchMedia("(min-width: 992px)");
    const onDesktop = () => {
      if (desktop.matches) close();
    };

    window.addEventListener("keydown", onKeyDown);
    desktop.addEventListener("change", onDesktop);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      desktop.removeEventListener("change", onDesktop);
    };
  }, [open, close]);

  return (
    <>
      <button
        aria-controls="mobile-menu-panel"
        aria-expanded={open}
        aria-label={open ? "Close menu" : "Open menu"}
        className="relative flex-center size-32 cursor-pointer rounded-full outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--color-orange-900)]"
        onClick={() => (open ? close() : setOpen(true))}
        type="button"
      >
        <span className="relative block h-10 w-16">
          <span
            className={cn(
              "absolute left-0 block h-1.5 w-16 rounded-full bg-icon-base transition-all duration-200",
              open ? "top-4 rotate-45" : "top-0"
            )}
          />
          <span
            className={cn(
              "absolute left-0 block h-1.5 w-16 rounded-full bg-icon-base transition-all duration-200",
              open ? "top-4 -rotate-45" : "top-8"
            )}
          />
        </span>
      </button>

      <div
        className={cn(
          "fixed inset-x-0 top-80 bottom-0 z-60 overflow-y-auto overscroll-contain bg-background-base transition-opacity duration-200",
          open ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        id="mobile-menu-panel"
      >
        <nav aria-label="Mobile" className="flex flex-col px-16 py-8">
          {sections.map((section) => {
            if ("href" in section) {
              return (
                <a
                  className="relative flex items-center justify-between py-16 text-label-medium text-text-base before:inside-border-b before:border-border-muted"
                  href={section.href}
                  key={section.label}
                  onClick={close}
                >
                  {section.label}
                </a>
              );
            }

            const isExpanded = expanded === section.label;

            return (
              <div key={section.label}>
                <button
                  aria-expanded={isExpanded}
                  className="relative flex w-full cursor-pointer items-center justify-between py-16 text-label-medium text-text-base before:inside-border-b before:border-border-muted"
                  onClick={() => setExpanded(isExpanded ? null : section.label)}
                  type="button"
                >
                  {section.label}
                  <Icon
                    className={cn(
                      "transition-transform duration-200",
                      isExpanded && "rotate-180"
                    )}
                    name="chevron-down-small"
                  />
                </button>

                {isExpanded && (
                  <div className="relative flex flex-col gap-24 py-20 before:inside-border-b before:border-border-muted">
                    {section.groups.map((group) => (
                      <div key={group.label}>
                        <div className="mb-8 text-decorative-small text-text-muted">
                          {group.label}
                        </div>

                        <ul className="flex flex-col">
                          {group.items.map((item) => (
                            <li key={item.label}>
                              <a
                                className="flex items-center gap-12 py-8 text-label-small text-text-default transition-colors hover:text-text-base"
                                href={item.href}
                                onClick={close}
                              >
                                <Icon
                                  className="shrink-0"
                                  name={item.iconName}
                                  variant="duo"
                                />
                                {item.label}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}

                    {section.seeAllHref && (
                      <a
                        className="flex items-center gap-2 text-label-small text-orange-900"
                        href={section.seeAllHref}
                        onClick={close}
                      >
                        {section.seeAllLabel}
                        <Icon name="chevron-right-small" />
                      </a>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </div>
    </>
  );
}
