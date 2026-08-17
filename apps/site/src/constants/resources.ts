import type { CatalogGroup, CatalogItem } from "@/components/catalog/types";

export const resources = {
  blog: {
    iconName: "resource-blog",
    label: "Blog",
    description: "Product updates, launch posts, and technical deep dives.",
    href: "#",
  },
  engineeringBlog: {
    iconName: "resource-engineering-blog",
    label: "Engineering Blog",
    description:
      "Implementation details and behind-the-scenes engineering stories.",
    href: "#",
  },
  learningCenter: {
    iconName: "resource-learning-center",
    label: "Learning Center",
    description:
      "Concept explainers and practical guides for modern web architecture.",
    href: "#",
  },
  caseStudies: {
    iconName: "resource-case-studies",
    label: "Case Studies",
    description: "How teams use Cloudflare in production across industries.",
    href: "#",
  },
  developerDocumentation: {
    iconName: "resource-developer-documentation",
    label: "Developer Documentation",
    description:
      "Product docs, tutorials, and examples for every Cloudflare service.",
    href: "#",
  },
  apiReference: {
    iconName: "resource-api-reference",
    label: "API Reference",
    description: "Endpoints, schemas, and auth details for Cloudflare APIs.",
    href: "#",
  },
  referenceArchitectures: {
    iconName: "resource-reference-architectures",
    label: "Reference Architectures",
    description: "Architecture patterns and best practices",
    href: "#",
  },
  communityForum: {
    iconName: "resource-community-forum",
    label: "Community Forum",
    description: "Connect with other developers and experts",
    href: "#",
  },
  cloudflareRadar: {
    iconName: "resource-cloudflare-radar",
    label: "Cloudflare Radar",
    description: "Internet traffic and security trends",
    href: "#",
  },
  events: {
    iconName: "resource-events",
    label: "Events",
    description:
      "Upcoming talks, webinars, and  in-person sessions from Cloudflare.",
    href: "#",
  },
  startups: {
    iconName: "resource-startups",
    label: "Startups",
    description: "Explore startups resources and opportunities.",
    href: "#",
  },
  partners: {
    iconName: "resource-partners",
    label: "Partners",
    description: "Explore partners resources and opportunities.",
    href: "#",
  },
  press: {
    iconName: "resource-press",
    label: "Press",
    description:
      "Company announcements, newsroom updates, a d media resources.",
    href: "#",
  },
  careers: {
    iconName: "resource-careers",
    label: "Careers",
    description: "Explore careers resources and opportunities.",
    href: "#",
  },
  support: {
    iconName: "resource-support",
    label: "Support",
    description: "Explore support resources and opportunities.",
    href: "#",
  },
  status: {
    iconName: "resource-status",
    label: "Status",
    description: "Explore status resources and opportunities.",
    href: "#",
  },
  aiSecurity: {
    iconName: "solution-ai-security",
    label: "AI Security",
    description: "",
    href: "#",
  },
  communityPrograms: {
    iconName: "resource-community-programs",
    label: "Community Programs",
    description: "",
    href: "#",
  },
  globalNetwork: {
    iconName: "resource-global-network",
    label: "Global Network",
    description: "",
    href: "#",
  },
  domainRegistration: {
    iconName: "resource-domain-registration",
    label: "Domain Registration",
    description: "",
    href: "#",
  },
  oneOneOneOne: {
    iconName: "resource-1-1-1-1",
    label: "1.1.1.1",
    description: "",
    href: "#",
  },
  enterprise: {
    iconName: "resource-enterprise",
    label: "Enterprise",
    description: "",
    href: "#",
  },
} satisfies Record<string, CatalogItem>;

const resourceGroups = {
  learn: {
    label: "Learn",
    slug: "learn",
    items: [
      resources.blog,
      resources.engineeringBlog,
      resources.learningCenter,
      resources.caseStudies,
    ],
  },
  build: {
    label: "Build",
    slug: "build",
    items: [
      resources.developerDocumentation,
      resources.apiReference,
      resources.referenceArchitectures,
      resources.communityForum,
    ],
    secondaryItems: [resources.aiSecurity],
  },
  explore: {
    label: "Explore",
    slug: "explore",
    items: [
      resources.cloudflareRadar,
      resources.events,
      resources.startups,
      resources.partners,
    ],
    secondaryItems: [
      resources.communityPrograms,
      resources.globalNetwork,
      resources.domainRegistration,
      resources.oneOneOneOne,
    ],
  },
  company: {
    label: "Company",
    slug: "company",
    items: [
      resources.press,
      resources.careers,
      resources.support,
      resources.status,
    ],
    secondaryItems: [resources.enterprise],
  },
} satisfies Record<string, CatalogGroup>;

export const headerResourceGroups: CatalogGroup[] = [
  resourceGroups.learn,
  resourceGroups.build,
  resourceGroups.explore,
  resourceGroups.company,
];

export const catalogResourceGroups: CatalogGroup[] = [
  resourceGroups.learn,
  resourceGroups.build,
  resourceGroups.explore,
  resourceGroups.company,
];
