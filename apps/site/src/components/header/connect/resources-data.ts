import type { IconName } from "@/components/icon/icons.gen";
import { REGISTER_URL } from "@/components/_pages/connect/data";

export type ConnectResourceItem = {
  iconName: IconName;
  label: string;
  description: string;
  href: string;
};

export type ConnectResourceGroup = {
  label: string;
  items: ConnectResourceItem[];
};

/** Solutions-style grouped links for the Connect Resources dropdown. */
export const connectResourceGroups: ConnectResourceGroup[] = [
  {
    label: "At the event",
    items: [
      {
        iconName: "organisation",
        label: "University",
        description: "Full-day technical training and certification",
        href: "/connect/cloudflare-university",
      },
      {
        iconName: "buildings",
        label: "Partner Summit",
        description: "Day-one summit for Cloudflare partners",
        href: "/connect/partner-summit",
      },
      {
        iconName: "money-hand",
        label: "Sponsors",
        description: "Meet the partners powering Connect 2026",
        href: "/connect/sponsors",
      },
    ],
  },
  {
    label: "Plan your trip",
    items: [
      {
        iconName: "info-simple",
        label: "FAQs",
        description: "Registration, venue, and what to expect",
        href: "/connect/faq",
      },
      {
        iconName: "file-text",
        label: "Convince your boss",
        description: "Talking points to get budget approval",
        href: "/connect/convince-your-boss",
      },
      {
        iconName: "rocket",
        label: "Register",
        description: "Conference pass and University add-on",
        href: REGISTER_URL,
      },
    ],
  },
];
