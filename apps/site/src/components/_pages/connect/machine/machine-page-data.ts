import { REGISTER_URL, connectPillars, connectStats } from "../data";
import {
  convinceEmailTemplate,
  convincePageMeta,
  convinceSlackTemplate,
} from "../page-data/convince";
import { faqContactEmail, faqGroups, faqPageMeta } from "../page-data/faq";
import {
  partnerAwards,
  partnerExtend,
  partnerFaq,
  partnerPageMeta,
  partnerWhy,
} from "../page-data/partner";
import {
  connectSponsors,
  sponsorOpportunities,
  sponsorTiers,
  sponsorsPageMeta,
} from "../page-data/sponsors";
import {
  universityFaq,
  universityIncluded,
  universityPageMeta,
  universitySchedule,
  universityWhy,
} from "../page-data/university";

export type MachineLink = {
  label: string;
  href: string;
  detail?: string;
};

export type MachineSection =
  | {
      kind: "definitions";
      title: string;
      rows: { label: string; value: string; href?: string }[];
    }
  | {
      kind: "list";
      title: string;
      items: (string | MachineLink)[];
      ordered?: boolean;
    }
  | {
      kind: "cards";
      title: string;
      items: { title: string; body: string; meta?: string }[];
    }
  | {
      kind: "faq";
      title: string;
      items: { question: string; answer: string }[];
    }
  | {
      kind: "code";
      title: string;
      language: string;
      body: string;
    };

export type MachinePage = {
  path: string;
  title: string;
  description: string;
  eyebrow: string;
  sections: MachineSection[];
};

export const CONNECT_MACHINE_ROUTES: MachineLink[] = [
  { label: "home", href: "/connect/", detail: "event overview" },
  {
    label: "sponsors",
    href: "/connect/sponsors",
    detail: "event sponsors",
  },
  {
    label: "university",
    href: "/connect/cloudflare-university",
    detail: "full-day technical training",
  },
  {
    label: "partner-summit",
    href: "/connect/partner-summit",
    detail: "global partner summit",
  },
  {
    label: "faq",
    href: "/connect/faq",
    detail: "frequently asked questions",
  },
  {
    label: "convince-your-boss",
    href: "/connect/convince-your-boss",
    detail: "justification template",
  },
  {
    label: "badge",
    href: "/connect/badge",
    detail: "custom shareable attendee badge",
  },
  {
    label: "login",
    href: "/connect/login",
    detail: "Cloudflare account sign in",
  },
];

const pageLinks = CONNECT_MACHINE_ROUTES.map(({ href, detail }) => ({
  label: href,
  href,
  detail,
}));

const eventDefinitions: MachineSection = {
  kind: "definitions",
  title: "event",
  rows: [
    { label: "name", value: "Cloudflare Connect 2026" },
    { label: "dates", value: "2026-10-19 — 2026-10-21" },
    { label: "venue", value: "Moscone West, San Francisco, CA, USA" },
    { label: "duration", value: "3 days" },
    { label: "register", value: REGISTER_URL, href: REGISTER_URL },
    {
      label: "contact",
      value: "connect@cloudflare.com",
      href: "mailto:connect@cloudflare.com",
    },
  ],
};

const currentPage = (
  path: string,
  title: string,
  description: string
): MachineSection => ({
  kind: "definitions",
  title: "current-page",
  rows: [
    { label: "path", value: path, href: path },
    { label: "title", value: title },
    { label: "description", value: description },
    { label: "representation", value: "text/markdown; charset=utf-8" },
  ],
});

const pagesSection: MachineSection = {
  kind: "list",
  title: "pages",
  items: pageLinks,
};

const agentRules: MachineSection = {
  kind: "list",
  title: "for-agents",
  items: [
    "Register humans at the URL in event.register.",
    "Use the public pages listed above for event discovery.",
    "Direct unanswered questions to connect@cloudflare.com.",
    "Do not invent prices, dates, or speakers — use the published page data.",
  ],
};

const homePage: MachinePage = {
  path: "/connect/",
  title: "Cloudflare Connect 2026 — Where the Internet's builders connect",
  description:
    "Join us in San Francisco, October 19–21, 2026 at Moscone West for Cloudflare Connect 2026. Workshops, live demos, and conversations with the teams behind Cloudflare.",
  eyebrow: "event / overview",
  sections: [
    eventDefinitions,
    currentPage(
      "/connect/",
      "Cloudflare Connect 2026 — Where the Internet's builders connect",
      "Join us in San Francisco, October 19–21, 2026 at Moscone West for Cloudflare Connect 2026. Workshops, live demos, and conversations with the teams behind Cloudflare."
    ),
    {
      kind: "definitions",
      title: "pricing (USD)",
      rows: [
        { label: "conference-pass", value: "$595" },
        {
          label: "university",
          value: "$495  add-on, full-day technical training",
        },
        {
          label: "gov/mil/edu",
          value: "-$100  requires .gov / .mil / .edu email",
        },
        {
          label: "includes",
          value: "meals, exclusive event swag, evening party",
        },
      ],
    },
    {
      kind: "list",
      title: "tracks",
      items: [
        "Application — Connect & Protect",
        "Developer & AI — Build Smarter",
        "Networking & Security — Beyond SASE",
        "Platform & Governance — Connectivity Cloud",
      ],
    },
    {
      kind: "list",
      title: "agenda",
      items: [
        "mon 2026-10-19  Cloudflare University · Global Partner Summit · Welcome Reception",
        "tue 2026-10-20  Opening General Session · Breakouts · Hub · Knowledge Bar · Innovations Theatre",
        "wed 2026-10-21  Innovation General Session · Breakouts · Cloudflare After Dark",
        "wed 2026-10-21  Innovation General Session · Breakouts · func(tion)",
      ],
    },
    {
      kind: "cards",
      title: "why-connect",
      items: connectPillars.map((pillar) => ({
        title: pillar.title,
        body: pillar.body,
      })),
    },
    {
      kind: "definitions",
      title: "event-signal",
      rows: connectStats.map((stat) => ({
        label: stat.value,
        value: stat.description,
      })),
    },
    pagesSection,
    {
      kind: "definitions",
      title: "data-route",
      rows: [
        {
          label: "/connect/api/sponsors",
          value: "curated event sponsors JSON",
          href: "/connect/api/sponsors",
        },
      ],
    },
    agentRules,
  ],
};

const sponsorsPage: MachinePage = {
  path: "/connect/sponsors",
  title: sponsorsPageMeta.title.replace(" | Cloudflare", ""),
  description: sponsorsPageMeta.description,
  eyebrow: "event / sponsors",
  sections: [
    eventDefinitions,
    currentPage(
      "/connect/sponsors",
      sponsorsPageMeta.title,
      sponsorsPageMeta.description
    ),
    {
      kind: "cards",
      title: "sponsorship-opportunities",
      items: sponsorOpportunities.map((item) => ({
        title: item.title,
        body: item.body,
      })),
    },
    ...sponsorTiers.map<MachineSection>((tier) => ({
      kind: "list",
      title: `sponsors / ${tier.toLowerCase()}`,
      items: connectSponsors
        .filter((sponsor) => sponsor.tier === tier)
        .map((sponsor) => ({
          label: sponsor.name,
          href: sponsor.website,
          detail: sponsor.website.replace(/^https?:\/\//, ""),
        })),
    })),
    {
      kind: "definitions",
      title: "data-route",
      rows: [
        {
          label: "/connect/api/sponsors",
          value: "application/json",
          href: "/connect/api/sponsors",
        },
      ],
    },
    pagesSection,
  ],
};

const universityPage: MachinePage = {
  path: "/connect/cloudflare-university",
  title: universityPageMeta.title.replace(" | Cloudflare", ""),
  description: universityPageMeta.description,
  eyebrow: "event / training",
  sections: [
    eventDefinitions,
    currentPage(
      "/connect/cloudflare-university",
      universityPageMeta.title,
      universityPageMeta.description
    ),
    {
      kind: "definitions",
      title: "university-pass",
      rows: [
        { label: "date", value: "2026-10-19" },
        { label: "price", value: "$495 add-on" },
        {
          label: "format",
          value: "full-day, instructor-led technical training",
        },
        {
          label: "focus",
          value: "Application Security and Cloudflare One / Zero Trust",
        },
      ],
    },
    {
      kind: "cards",
      title: "why-attend",
      items: universityWhy.features.map((item) => ({
        title: item.title,
        body: item.body,
      })),
    },
    {
      kind: "cards",
      title: "schedule",
      items: universitySchedule.days.map((day) => ({
        title: day.title,
        body: day.body,
        meta: `${day.date} · ${day.label}`,
      })),
    },
    {
      kind: "cards",
      title: "included",
      items: universityIncluded.items.map((item) => ({
        title: item.title,
        body: item.body,
      })),
    },
    {
      kind: "definitions",
      title: "requirements",
      rows: [{ label: "laptop", value: universityIncluded.note }],
    },
    { kind: "faq", title: "faq", items: universityFaq },
    pagesSection,
  ],
};

const partnerPage: MachinePage = {
  path: "/connect/partner-summit",
  title: partnerPageMeta.title.replace(" | Cloudflare", ""),
  description: partnerPageMeta.description,
  eyebrow: "event / partners",
  sections: [
    eventDefinitions,
    currentPage(
      "/connect/partner-summit",
      partnerPageMeta.title,
      partnerPageMeta.description
    ),
    {
      kind: "definitions",
      title: "partner-summit",
      rows: [
        { label: "date", value: "2026-10-19" },
        { label: "venue", value: "Moscone West, San Francisco" },
        {
          label: "eligibility",
          value: "active Cloudflare partners in good standing",
        },
        { label: "price", value: "free for eligible partners" },
        {
          label: "featured-speaker",
          value: `${partnerWhy.featuredSpeaker.name} — ${partnerWhy.featuredSpeaker.role}`,
        },
      ],
    },
    {
      kind: "cards",
      title: "why-attend",
      items: partnerWhy.items.map((item) => ({
        title: item.title,
        body: item.body,
      })),
    },
    {
      kind: "cards",
      title: "program",
      items: [
        { title: partnerAwards.title, body: partnerAwards.body },
        { title: partnerExtend.title, body: partnerExtend.body },
      ],
    },
    { kind: "faq", title: "faq", items: partnerFaq },
    pagesSection,
  ],
};

const faqPage: MachinePage = {
  path: "/connect/faq",
  title: faqPageMeta.title.replace(" | Cloudflare", ""),
  description: faqPageMeta.description,
  eyebrow: "event / answers",
  sections: [
    eventDefinitions,
    currentPage("/connect/faq", faqPageMeta.title, faqPageMeta.description),
    ...faqGroups.map<MachineSection>((group) => ({
      kind: "faq",
      title: `faq / ${group.title.toLowerCase().replaceAll(" ", "-")}`,
      items: group.items,
    })),
    {
      kind: "definitions",
      title: "contact",
      rows: [
        {
          label: "unanswered-questions",
          value: faqContactEmail,
          href: `mailto:${faqContactEmail}`,
        },
      ],
    },
    pagesSection,
  ],
};

const convincePage: MachinePage = {
  path: "/connect/convince-your-boss",
  title: convincePageMeta.title.replace(" | Cloudflare", ""),
  description: convincePageMeta.description,
  eyebrow: "event / approval",
  sections: [
    eventDefinitions,
    currentPage(
      "/connect/convince-your-boss",
      convincePageMeta.title,
      convincePageMeta.description
    ),
    {
      kind: "definitions",
      title: "cost-estimate",
      rows: [
        { label: "registration", value: "$595" },
        { label: "flight", value: "$400–$800, depending on location" },
        { label: "hotel", value: "$350/night × 3 nights = $1,050" },
        { label: "meals", value: "$100/day × 3 days = $300" },
        { label: "total", value: "$2,345–$2,745" },
      ],
    },
    {
      kind: "code",
      title: "email-template",
      language: "text",
      body: convinceEmailTemplate,
    },
    {
      kind: "code",
      title: "slack-template",
      language: "text",
      body: convinceSlackTemplate,
    },
    pagesSection,
  ],
};

const badgePage: MachinePage = {
  path: "/connect/badge",
  title: "Badge — Cloudflare Connect 2026",
  description:
    "Customize a Connect 2026 attendee badge, add a logo, and copy or share the rendered card.",
  eyebrow: "event / utility",
  sections: [
    eventDefinitions,
    currentPage(
      "/connect/badge",
      "Badge — Cloudflare Connect 2026",
      "Customize a Connect 2026 attendee badge, add a logo, and copy or share the rendered card."
    ),
    {
      kind: "definitions",
      title: "badge",
      rows: [
        { label: "status", value: "You’re all set." },
        { label: "dates", value: "2026-10-19 — 2026-10-21" },
        { label: "venue", value: "Moscone West, San Francisco" },
        { label: "output", value: "shareable rendered card" },
      ],
    },
    {
      kind: "list",
      title: "controls",
      ordered: true,
      items: [
        "Choose a preset or custom badge color.",
        "Upload and position a logo.",
        "Copy the shareable card.",
        "Share the card to X.",
      ],
    },
    pagesSection,
  ],
};

const loginPage: MachinePage = {
  path: "/connect/login",
  title: "Sign in to Cloudflare | Connect 2026",
  description:
    "Cloudflare account sign-in with a Connect 2026 event registration panel.",
  eyebrow: "account / authentication",
  sections: [
    eventDefinitions,
    currentPage(
      "/connect/login",
      "Sign in to Cloudflare | Connect 2026",
      "Cloudflare account sign-in with a Connect 2026 event registration panel."
    ),
    {
      kind: "definitions",
      title: "authentication",
      rows: [
        { label: "social", value: "Google, Apple, GitHub" },
        { label: "enterprise", value: "SSO" },
        { label: "credentials", value: "email + password" },
        { label: "remember", value: "optional" },
        {
          label: "create-account",
          value: "https://dash.cloudflare.com/sign-up",
          href: "https://dash.cloudflare.com/sign-up",
        },
      ],
    },
    {
      kind: "definitions",
      title: "connect-promo",
      rows: [
        { label: "dates", value: "October 19–21, 2026" },
        { label: "venue", value: "Moscone West, San Francisco" },
        { label: "register", value: REGISTER_URL, href: REGISTER_URL },
      ],
    },
    pagesSection,
  ],
};

export const CONNECT_MACHINE_PAGES: Record<string, MachinePage> = {
  "/connect/": homePage,
  "/connect/sponsors": sponsorsPage,
  "/connect/cloudflare-university": universityPage,
  "/connect/partner-summit": partnerPage,
  "/connect/faq": faqPage,
  "/connect/convince-your-boss": convincePage,
  "/connect/badge": badgePage,
  "/connect/login": loginPage,
};

export const normalizeConnectPath = (pathname: string) => {
  if (pathname === "/connect" || pathname === "/connect/") return "/connect/";
  const normalized = pathname.replace(/\/$/, "");
  return CONNECT_MACHINE_PAGES[normalized] ? normalized : "/connect/";
};

export const getConnectMachinePage = (pathname: string) =>
  CONNECT_MACHINE_PAGES[normalizeConnectPath(pathname)];
