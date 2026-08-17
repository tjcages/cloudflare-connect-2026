import type { IconName } from "@/components/icon/icons.gen";

export type CatalogItem = {
  iconName: IconName;
  label: string;
  description: string;
  href: string;
  isNew?: boolean;
};

export type CatalogGroup = {
  label: string;
  slug: string;
  items: CatalogItem[];
  secondaryItems?: CatalogItem[];
};
