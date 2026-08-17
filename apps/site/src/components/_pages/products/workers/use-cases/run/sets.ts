import type { IconName } from "@/components/icon/icons.gen";

export type RunSet = {
  labels: [string, string, string];
  icons: [IconName, IconName, IconName];
};

export type RunRowState = "pending" | "running" | "active" | "done";

export const boxDelay = (row: 1 | 2 | 3, box: "chip" | "pill") =>
  ((row - 1) * 2 + (box === "pill" ? 1 : 0)) * 0.075;

export const RUN_SETS: RunSet[] = [
  {
    labels: ["Event", "Workers", "Background Job"],
    icons: ["commits", "product-workers", "server-2"],
  },
  {
    labels: ["Webhook", "Queues", "Payment Sync"],
    icons: ["cloud-api", "product-queues", "money-hand"],
  },
  {
    labels: ["Cron Trigger", "Workflows", "Nightly Report"],
    icons: ["clock-snooze", "product-workflows", "newspaper-2"],
  },
  {
    labels: ["Alarm", "Durable Objects", "Session Cleanup"],
    icons: ["exclamation-circle", "product-durable-objects", "archive"],
  },
];
