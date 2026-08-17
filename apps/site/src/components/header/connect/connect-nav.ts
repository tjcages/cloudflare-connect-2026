import type { IHeaderNavItem } from "../HeaderNavItem";
import { connectResourcesMenu } from "./resources-menu";

/** Client-side Connect nav — menus must be built here (functions don't serialize via Astro props). */
export const connectNavItems: IHeaderNavItem[] = [
  { label: "Agenda", href: "#agenda" },
  { label: "Speakers", href: "#speakers" },
  { label: "Sessions", href: "#agenda" },
  {
    label: "Resources",
    dropdown: { menu: connectResourcesMenu },
  },
];
