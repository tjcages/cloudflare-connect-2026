import type { FC, SVGProps } from "react";
import type { IconName } from "@/components/icon/icons.gen";

export type CommandMenuItemKind = "page" | "product" | "case-study" | "post";

export type CommandMenuItem = {
  id: string;
  label: string;
  description: string;
  href: string;
  iconName: IconName;
  kind: CommandMenuItemKind;
  logo?: FC<SVGProps<SVGSVGElement>>;
  logoClass?: string;
  cover?: string;
};

export type CommandMenuSearchRecord = CommandMenuItem & {
  groupId: string;
  groupLabel: string;
  groupOrder: number;
  keywords: string[];
  publishedAt?: string;
};

export type CommandMenuGroup = {
  id: string;
  label: string;
  items: CommandMenuItem[];
};

export type CommandMenuSearchResult = CommandMenuItem & {
  iconName: "resource-blog";
  kind: "post";
};
