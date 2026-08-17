export type ReplyPhase = "idle" | "working" | "resolved";

export type ReplyPillDetail = { phase: ReplyPhase; index: number };

export const ACTIONS: { working: string; result: string }[] = [
  { working: "Replying...", result: "Automatically replied" },
  { working: "Forwarding...", result: "Forwarded to support" },
  { working: "Updating CRM...", result: "CRM updated" },
  { working: "Notifying Slack...", result: "Slack notified" },
];
