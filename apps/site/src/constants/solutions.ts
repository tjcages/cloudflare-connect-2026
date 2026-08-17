import type { CatalogGroup, CatalogItem } from "@/components/catalog/types";

export const solutions = {
  ai: {
    iconName: "solution-ai",
    label: "AI",
    description: "Build intelligent applications with AI at the edge",
    href: "#",
  },
  frontends: {
    iconName: "solution-frontends",
    label: "Frontends",
    description: "Deploy frontend applications globally in seconds",
    href: "#",
  },
  platforms: {
    iconName: "solution-platforms",
    label: "Platforms",
    description: "Build platforms on Cloudflare's infrastructure",
    href: "#",
  },
  workflows: {
    iconName: "solution-workflows",
    label: "Workflows",
    description: "Orchestrate complex multi-step processes",
    href: "#",
  },
  agenticCommerce: {
    iconName: "solution-agentic-commerce",
    label: "Agentic Commerce",
    description: "",
    href: "#",
  },
  network: {
    iconName: "solution-network",
    label: "Network",
    description: "Global network services for performance",
    href: "#",
  },
  security: {
    iconName: "solution-security",
    label: "Security",
    description: "Protect your applications from threats",
    href: "#",
  },
  aiSecurity: {
    iconName: "solution-ai-security",
    label: "AI Security",
    description: "",
    href: "#",
  },
  financialServices: {
    iconName: "solution-financial-services",
    label: "Financial Services",
    description: "Secure digital infrastructure for modern services",
    href: "#",
  },
  healthcare: {
    iconName: "solution-healthcare",
    label: "Healthcare",
    description: "Secure and accelerate healthcare delivery",
    href: "#",
  },
  publicSector: {
    iconName: "solution-public-sector",
    label: "Public Sector",
    description: "Enhance cyber resilience, accelerate performance",
    href: "#",
  },
  retail: {
    iconName: "solution-retail",
    label: "Retail",
    description: "Build secure, high-performance retail experiences",
    href: "#",
  },
  saseForAirlines: {
    iconName: "solution-sase-for-airlines",
    label: "SASE for Airlines",
    description: "",
    href: "#",
  },
  saseForRetail: {
    iconName: "solution-sase-for-retail",
    label: "SASE for Retail",
    description: "",
    href: "#",
  },
} satisfies Record<string, CatalogItem>;

const solutionGroups = {
  byWorkload: {
    label: "By workload",
    slug: "by-workload",
    items: [
      solutions.ai,
      solutions.frontends,
      solutions.platforms,
      solutions.workflows,
    ],
    secondaryItems: [solutions.agenticCommerce],
  },
  byCapability: {
    label: "By capability",
    slug: "by-capability",
    items: [solutions.network, solutions.security],
    secondaryItems: [solutions.aiSecurity],
  },
  byIndustry: {
    label: "By industry",
    slug: "by-industry",
    items: [
      solutions.financialServices,
      solutions.healthcare,
      solutions.publicSector,
      solutions.retail,
    ],
    secondaryItems: [solutions.saseForAirlines, solutions.saseForRetail],
  },
} satisfies Record<string, CatalogGroup>;

export const headerSolutionGroups: CatalogGroup[] = [
  solutionGroups.byWorkload,
  solutionGroups.byCapability,
  solutionGroups.byIndustry,
];

export const catalogSolutionGroups: CatalogGroup[] = [
  solutionGroups.byWorkload,
  solutionGroups.byCapability,
  solutionGroups.byIndustry,
];
