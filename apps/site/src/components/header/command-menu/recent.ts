import type { CommandMenuItem, CommandMenuItemKind } from "./types";
import type { IconName } from "@/components/icon/icons.gen";

export type RecentEntry = {
  label: string;
  description: string;
  href: string;
  iconName: IconName;
  kind: CommandMenuItemKind;
  cover?: string;
  logoSlug?: string;
};

const storageKey = "command-menu-recent";
const maxEntries = 3;

const isEntry = (value: unknown): value is RecentEntry => {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.label === "string" &&
    typeof entry.description === "string" &&
    typeof entry.href === "string" &&
    typeof entry.iconName === "string" &&
    typeof entry.kind === "string"
  );
};

export const readRecent = (): RecentEntry[] => {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isEntry).slice(0, maxEntries);
  } catch {
    return [];
  }
};

export const pushRecent = (item: CommandMenuItem) => {
  const entry: RecentEntry = {
    label: item.label,
    description: item.description,
    href: item.href,
    iconName: item.iconName,
    kind: item.kind,
    cover: item.cover,
    logoSlug: item.href.startsWith("/case-studies/")
      ? item.href.slice("/case-studies/".length)
      : undefined,
  };

  const next = [
    entry,
    ...readRecent().filter((previous) => previous.href !== entry.href),
  ].slice(0, maxEntries);

  try {
    localStorage.setItem(storageKey, JSON.stringify(next));
  } catch {
    // Storage can be full or blocked; never let that stop the navigation.
  }
};
