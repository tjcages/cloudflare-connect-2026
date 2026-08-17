import { REGISTER_URL } from "../data";

export type ConnectSponsor = {
  name: string;
  website: string;
  tier: "Platinum" | "Gold" | "Exhibitor";
  logo: string;
};

export const sponsorsPageMeta = {
  title: "Sponsors - Cloudflare Connect 2026 | Cloudflare",
  description:
    "Cloudflare Connect 2026 Sponsors — thank you to our partners and supporters.",
};

export const sponsorsHero = {
  eyebrow: "Sponsors",
  title: "Sponsors",
  body: "Secure a seat at the table with the industry's most influential leaders and help solve the challenges of tomorrow.",
  primaryCta: { text: "Register Now", href: REGISTER_URL },
  secondaryCta: { text: "See opportunities", href: "#opportunities" },
};

export const sponsorOpportunities = [
  {
    iconName: "rocket" as const,
    title: "Showcase your innovations",
    body: "Position your solutions in front of a highly engaged audience through live demos, hands-on experiences, and high-visibility brand moments.",
  },
  {
    iconName: "collaboration-pointer-left" as const,
    title: "Build customer relationships",
    body: "Turn conversations into connections. Engage directly with decision-makers and practitioners to build trust, accelerate deals, and grow together.",
  },
  {
    iconName: "organisation" as const,
    title: "Connect with industry leaders",
    body: "Join a powerful network of partners, leaders, and innovators. Exchange insights, spark collaboration, and strengthen your position in the ecosystem.",
  },
];

export const connectSponsors: ConnectSponsor[] = [
  {
    name: "Sentinel One",
    website: "http://www.sentinelone.com",
    tier: "Platinum",
    logo: "/connect/sponsors/sentinel-one.png",
  },
  {
    name: "Ionix",
    website: "https://www.ionix.io/",
    tier: "Platinum",
    logo: "/connect/sponsors/ionix.png",
  },
  {
    name: "Wiz",
    website: "http://www.wiz.io",
    tier: "Gold",
    logo: "/connect/sponsors/wiz.gif",
  },
  {
    name: "Presidio",
    website: "https://www.presidio.com",
    tier: "Gold",
    logo: "/connect/sponsors/presidio.png",
  },
  {
    name: "China Mobile International Limited",
    website: "http://www.cmi.chinamobile.com",
    tier: "Exhibitor",
    logo: "/connect/sponsors/china-mobile.png",
  },
  {
    name: "Safenames",
    website: "https://www.safenames.net",
    tier: "Exhibitor",
    logo: "/connect/sponsors/safenames.svg",
  },
  {
    name: "TekStream",
    website: "http://www.TekStream.com",
    tier: "Exhibitor",
    logo: "/connect/sponsors/tekstream.png",
  },
  {
    name: "Ping Identity",
    website: "https://www.pingidentity.com/",
    tier: "Exhibitor",
    logo: "/connect/sponsors/ping.png",
  },
  {
    name: "BlackHawk Data",
    website: "https://blackhawk11.com/",
    tier: "Exhibitor",
    logo: "/connect/sponsors/blackhawk.png",
  },
  {
    name: "Consortium",
    website: "https://consortium.com",
    tier: "Exhibitor",
    logo: "/connect/sponsors/consortium.png",
  },
  {
    name: "Radius",
    website: "https://www.radiuschannels.com/",
    tier: "Exhibitor",
    logo: "/connect/sponsors/radius-channels.svg",
  },
  {
    name: "Arctiq",
    website: "https://arctiq.com/",
    tier: "Exhibitor",
    logo: "/connect/sponsors/arctiq.png",
  },
];

export const sponsorTiers = ["Platinum", "Gold", "Exhibitor"] as const;
