import type { IconName } from "@/components/icon/icons.gen";

export type AutomationEvent = {
  trigger: string;
  result: string;
  icon: IconName;
  iconClass?: string;
};

export const AUTOMATION_EVENTS: AutomationEvent[] = [
  {
    trigger: "New user",
    result: "Welcome email sent",
    icon: "product-email-service",
  },
  {
    trigger: "Payment received",
    result: "Invoice created",
    icon: "file-text",
  },
  {
    trigger: "Form submitted",
    result: "CRM lead created",
    icon: "user-added",
  },
  {
    trigger: "Order placed",
    result: "Fulfillment started",
    icon: "3d-package",
  },
  {
    trigger: "Error detected",
    result: "Team notified",
    icon: "bell-2-active",
    iconClass: "text-purple-900",
  },
];
