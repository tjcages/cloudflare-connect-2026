import type { IHeaderNavItem } from "../HeaderNavItem";
import { connectResourcesMenu } from "./resources-menu";

/** Client-side Connect nav — menus must be built here (functions don't serialize via Astro props). */
export const connectNavItems: IHeaderNavItem[] = [
  { label: "Agenda", href: "/connect#agenda" },
  { label: "Speakers", href: "/connect#speakers" },
  {
    label: "Resources",
    dropdown: { menu: connectResourcesMenu },
  },
];
