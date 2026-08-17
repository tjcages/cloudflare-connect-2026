export const REGISTER_URL =
  "https://events.www.cloudflare.com/connect2026/begin";

export const connectMeta = {
  title: "Cloudflare Connect 2026 | Cloudflare",
  description:
    "Where the Internet's builders connect — keynotes, 100+ breakouts, University, and nights for the people building the next decade of the web. Oct 19–21, Moscone West, San Francisco.",
};

export const connectHero = {
  eyebrow: "Connect 2026",
  titleLines: ["Where the Internet's", "builders connect"],
  body: "Oct 19–21, 2026 · Moscone West, San Francisco. Keynotes, 100+ breakouts, University, and nights for the people building the next decade of the web.",
  primaryCta: { text: "Register Now", href: REGISTER_URL },
  secondaryCta: { text: "See the agenda", href: "/connect#agenda" },
};

export const connectPillars = [
  {
    iconName: "organisation" as const,
    title: "What to expect",
    body: "Keynotes, 100+ breakouts, University, Innovations Theatre, and evenings built for connections.",
  },
  {
    iconName: "lightbulb-duo" as const,
    title: "What you’ll learn",
    body: "Five tracks, one pass: agents to production, the instant web, stack consolidation, AI control, and advanced attacks.",
  },
  {
    iconName: "collaboration-pointer-left" as const,
    title: "Who you’ll meet",
    body: "5,000+ architects, developers, and security leaders. 40+ partners. Cloudflare engineers building the platform you ship on.",
  },
  {
    iconName: "rocket" as const,
    title: "The roadmap, first",
    body: "Leadership on AI, agents, and the platform — so you know where to place your bets.",
  },
  {
    iconName: "globe-3" as const,
    title: "Build on one platform",
    body: "Get infrastructure off your plate. Make the web instant. Ship agents faster — within 50ms of nearly everyone online.",
  },
  {
    iconName: "agents" as const,
    title: "Nights for connections",
    body: "Welcome Reception, func(tion), and evenings designed for the conversations that don’t fit in a session slot.",
  },
];

export const connectStats = [
  {
    value: "5k+",
    description: "Devs & security leaders in one place for three days.",
  },
  {
    value: "40+",
    description: "Ecosystem partners across the Connectivity Cloud.",
  },
  {
    value: "100+",
    description: "Sessions & workshops across every Connect track.",
  },
  {
    value: "3",
    description: "Days of keynotes, University, Hub, and Innovations Theatre.",
  },
];

export const connectSpeakers = [
  {
    name: "Matthew Prince",
    role: "Co-Founder & CEO, Cloudflare",
    image: "/connect/speakers/matthew-prince.webp",
  },
  {
    name: "Michelle Zatlyn",
    role: "Co-Founder & President, Cloudflare",
    image: "/connect/speakers/michelle-zatlyn.webp",
  },
  {
    name: "Rene Haas",
    role: "CEO, Arm",
    image: "/connect/speakers/rene-haas.webp",
  },
  {
    name: "Sarah Guo",
    role: "Founder, Conviction",
    image: "/connect/speakers/sarah-guo.webp",
  },
  {
    name: "Evan You",
    role: "Founder, VoidZero",
    image: "/connect/speakers/evan-you.webp",
  },
  {
    name: "Peter Steinberger",
    role: "Founder, OpenClaw · OpenAI",
    image: "/connect/speakers/peter-steinberger.webp",
  },
];

export const connectTickets = [
  {
    name: "Conference Pass",
    price: "$595",
    detail:
      "Full access to Connect 2026 — keynotes, breakouts, The Hub, Knowledge Bar, Innovations Theatre, meals, swag, and evening programming.",
    cta: "Register now",
    href: REGISTER_URL,
  },
  {
    name: "Cloudflare University",
    price: "+$495",
    detail:
      "Full-day technical training and certification for architects & engineers. Optional add-on to the Conference Pass.",
    cta: "Add University",
    href: REGISTER_URL,
  },
];

export const connectTicketIncludes = [
  "Meals",
  "Exclusive event swag",
  "Evening party",
];

export const connectTicketNote =
  "$100 off for government, military, nonprofit, and education (.gov / .mil / .org / .edu).";

/** Dot tint for an agenda slot — resolved to a class in Agenda.astro. */
export type AgendaSlotAccent = "info" | "orange" | "success";

export const connectAgenda: {
  day: string;
  date: string;
  slots: { label: string; accent: AgendaSlotAccent; items: string[] }[];
}[] = [
  {
    day: "Day 1",
    date: "Mon Oct 19",
    slots: [
      {
        label: "All day",
        accent: "success",
        items: ["Cloudflare University", "Global Partner Summit"],
      },
      {
        label: "Evening",
        accent: "orange",
        items: ["Welcome Reception"],
      },
    ],
  },
  {
    day: "Day 2",
    date: "Tue Oct 20",
    slots: [
      {
        label: "Morning",
        accent: "info",
        items: ["Opening General Session"],
      },
      {
        label: "All day",
        accent: "success",
        items: [
          "Breakout Sessions",
          "The Hub",
          "Knowledge Bar",
          "Innovations Theatre",
        ],
      },
    ],
  },
  {
    day: "Day 3",
    date: "Wed Oct 21",
    slots: [
      {
        label: "Morning",
        accent: "info",
        items: ["Innovation General Session"],
      },
      {
        label: "All day",
        accent: "success",
        items: [
          "Breakout Sessions",
          "The Hub",
          "Knowledge Bar",
          "Innovations Theatre",
        ],
      },
      {
        label: "Evening",
        accent: "orange",
        items: ["func(tion)"],
      },
    ],
  },
];

export const connectFaq = [
  {
    question: "When and where is Cloudflare Connect 2026?",
    answer:
      "October 19–21, 2026 at Moscone West in San Francisco. University and Partner Summit run on day one; main conference sessions run days two and three.",
  },
  {
    question: "What’s included in the Conference Pass?",
    answer:
      "Access to keynotes, breakouts, The Hub, Knowledge Bar, Innovations Theatre, meals, event swag, and evening programming. Cloudflare University is an optional add-on.",
  },
  {
    question: "What is Cloudflare University?",
    answer:
      "A full-day, instructor-led technical training and certification track for architects and engineers — available as a +$495 add-on to the Conference Pass.",
  },
  {
    question: "Is there a discount for nonprofit, education, or government?",
    answer:
      "Yes — $100 off with a qualifying .gov, .mil, .org, or .edu email when you register.",
  },
  {
    question: "Who should attend?",
    answer:
      "Developers, architects, security leaders, and partners building on or with Cloudflare — and anyone placing bets on AI, agents, and the Connectivity Cloud.",
  },
];
