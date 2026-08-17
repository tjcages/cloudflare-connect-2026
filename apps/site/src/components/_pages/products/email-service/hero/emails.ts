import type { IconName } from "@/components/icon/icons.gen";
import { rnd } from "@/utils/random";

export interface EmailKind {
  id: string;
  title: string;
  subtitle: string;
  icon: IconName;
  address: string;
  via: string;
  steps: readonly [string, string, string, string];
  preview: {
    fromName: string;
    fromAddress: string;
    toName: string;
    toAddress: string;
    subject: string;
    heading: string;
    body: string;
    cta: string;
    note: string;
  };
}

export const EMAILS = [
  {
    id: "verification",
    title: "Verification Email",
    subtitle: "Signup Flow",
    icon: "circle-check",
    address: "jane@acme.com",
    via: "via Worker",
    steps: [
      "Creating user",
      "Generating verification token",
      "Building email",
      "Sending verification email",
    ],
    preview: {
      fromName: "Acme",
      fromAddress: "noreply@acme.com",
      toName: "Jane Doe",
      toAddress: "jane@acme.com",
      subject: "Please verify your email address",
      heading: "Welcome, Jane!",
      body: "Thanks for joining Acme. <br />Verify your email to activate your account.",
      cta: "Verify Email",
      note: "Expires in 1 hour.",
    },
  },
  {
    id: "welcome",
    title: "Welcome Email",
    subtitle: "User Signup",
    icon: "raising-hand-4-finger",
    address: "alex@acme.com",
    via: "via Worker",
    steps: [
      "Account activated",
      "Preferences loaded",
      "Email personalized",
      "Sending welcome email",
    ],
    preview: {
      fromName: "Acme",
      fromAddress: "hello@acme.com",
      toName: "Alex Morgan",
      toAddress: "alex@acme.com",
      subject: "Welcome to Acme",
      heading: "You're all set, Alex!",
      body: "Your Acme workspace is ready. <br />Invite your team to start.",
      cta: "Open Dashboard",
      note: "Just reply if you need help.",
    },
  },
  {
    id: "magic-link",
    title: "Magic Link",
    subtitle: "Passwordless Login",
    icon: "chain-link-3",
    address: "sam@acme.com",
    via: "via Worker",
    steps: [
      "Identity checked",
      "Magic token generated",
      "Secure link built",
      "Magic link sent",
    ],
    preview: {
      fromName: "Acme Security",
      fromAddress: "security@acme.com",
      toName: "Sam Lee",
      toAddress: "sam@acme.com",
      subject: "Your secure sign-in link",
      heading: "Sign in to Acme",
      body: "A sign-in was requested. <br />Continue without a password.",
      cta: "Sign In Securely",
      note: "Expires in 15 minutes.",
    },
  },
  {
    id: "invoice",
    title: "Invoice #1048",
    subtitle: "PDF Attachment",
    icon: "file-pdf",
    address: "billing@client.com",
    via: "via REST API",
    steps: [
      "Invoice generated",
      "PDF attached",
      "Recipient validated",
      "Invoice sent",
    ],
    preview: {
      fromName: "Acme Billing",
      fromAddress: "billing@acme.com",
      toName: "Client Billing",
      toAddress: "billing@client.com",
      subject: "Invoice #1048",
      heading: "Invoice #1048",
      body: "Amount due: $4,280 <br />Due August 30, 2026. Invoice attached.",
      cta: "View Invoice",
      note: "invoice-1048.pdf • 428 KB",
    },
  },
  {
    id: "monthly-report",
    title: "Monthly Report",
    subtitle: "Scheduled Digest",
    icon: "chart-up",
    address: "team@acme.com",
    via: "via SMTP",
    steps: [
      "Metrics collected",
      "Charts rendered",
      "Images embedded",
      "Monthly report sent",
    ],
    preview: {
      fromName: "Acme Reports",
      fromAddress: "reports@acme.com",
      toName: "Acme Team",
      toAddress: "team@acme.com",
      subject: "Your monthly performance report",
      heading: "July at a glance",
      body: "Revenue grew 12.4% this month. <br />Your full report is ready.",
      cta: "View Report",
      note: "Includes charts and images.",
    },
  },
  {
    id: "agent-run",
    title: "Agent Run Complete",
    subtitle: "Task Automation",
    icon: "cursor-ai",
    address: "dev@acme.com",
    via: "via Agent",
    steps: [
      "Task received",
      "Sandbox prepared",
      "Tests passed",
      "Sending run report",
    ],
    preview: {
      fromName: "Acme Agent",
      fromAddress: "agent@acme.com",
      toName: "Developer Team",
      toAddress: "dev@acme.com",
      subject: "Agent completed: Create API service",
      heading: "Your agent finished the task",
      body: "Sandbox run finished. <br />6 files changed, 12 tests passed.",
      cta: "View Agent Run",
      note: "Run #agt_8B42 • 2m 14s",
    },
  },
] as const satisfies readonly EmailKind[];

export const ROW_HEIGHT = 80;
export const ROW_HEIGHT_RUNNING = 124;

export const ARM_DELAY_MS = 500;
const STEP_MS = 1000;
export const SETTLE_MS = 1100;
export const OPENING_MS = 1400;

// Nothing in the card moves while a badge is mid-swap, but it leads the badge
// by a tenth or the two read as one following the other.
const BADGE_SWAP = 0.25;
export const PREVIEW_DELAY = BADGE_SWAP - 0.1;

// Long enough for the stroke to withdraw (0.28) and the badge to fade behind
// it (0.22 + 0.2) before the row closes over them.
export const ROW_COLLAPSE_MS = 500;

// The card is taller than the viewport, so this stop keeps 20px of padding
// below it and lets its top scroll away.
export const SCROLL_TO = -140;
export const SCROLL_HOLD = 0.45;
export const SCROLL_DURATION = 1;

// The badge's whole job is what happens under it: swap out, reveal the body,
// travel, settle. Give that step the time it takes, so the next badge lands as
// the card brightens rather than partway down the scroll.
const SCROLL_BEAT_MS = (SCROLL_HOLD + SCROLL_DURATION + 0.3) * 1000;

export const STEP_DURATIONS = [
  STEP_MS + 500,
  STEP_MS,
  SCROLL_BEAT_MS,
  STEP_MS * 2,
] as const;

export interface Ghosts {
  header: readonly number[];
  body: readonly number[];
}

// Header bars share a 240px column, card bars a 132px one — the ceilings stay
// clear of both so a long draw can never run past its container.
export const SEED_GHOSTS: Ghosts = {
  header: [186, 142, 214],
  body: [112, 80, 120],
};

export const makeGhosts = (): Ghosts => {
  const span = (min: number, max: number) => Math.round(rnd(min, max));
  return {
    header: [span(140, 214), span(110, 186), span(160, 226)],
    body: [span(94, 120), span(62, 100), span(104, 124)],
  };
};
