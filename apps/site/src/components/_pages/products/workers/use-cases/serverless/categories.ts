import type { IconName } from "@/components/icon/icons.gen";

export const CATEGORIES = [
  { label: "Authentication", icon: "product-access" },
  { label: "Rate limiting", icon: "clock-snooze" },
  { label: "Routing", icon: "merged-simple" },
  { label: "Caching", icon: "server-2" },
] as const satisfies ReadonlyArray<{ label: string; icon: IconName }>;
