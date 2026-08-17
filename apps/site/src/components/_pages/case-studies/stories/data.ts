import type { FC, SVGProps } from "react";
import { caseStudyLogos } from "@/components/_pages/case-studies/logos/logos";
import type { IconName } from "@/components/icon/icons.gen";

export type StoryFacetKey = "region" | "industry" | "product" | "useCase";

export const regionOptions = [
  "Asia-Pacific",
  "Europe, Middle East & Africa",
  "Latin America & the Caribbean",
  "North America",
] as const;

export const industryOptions = [
  "Education",
  "Financial Services",
  "Gaming",
  "Healthcare & Life Sciences",
  "High Technology",
  "Hosting",
  "Manufacturing",
  "Media & Entertainment",
  "Public Interest",
  "Public Sector",
  "Publishing",
  "Travel & Leisure",
  "eCommerce",
] as const;

export const useCaseOptions = [
  "Accelerate Digital Properties",
  "Deliver Rich Media Experiences",
  "Deploy Custom Code at the Edge",
  "Enable Zero Trust Security for Workforce",
  "Enhance Cloud Email Security",
  "Protect Network Infrastructure",
  "Secure Website & Applications",
  "Secure Workforce Applications, Devices and Networks",
  "Stop Phishing & BEC Attacks",
] as const;

export type RegionName = (typeof regionOptions)[number];
export type IndustryName = (typeof industryOptions)[number];
export type UseCaseName = (typeof useCaseOptions)[number];

export type Story = {
  company: string;
  logo: FC<SVGProps<SVGSVGElement>>;
  products: ProductName[];
  industry: IndustryName;
  region: RegionName;
  useCases: UseCaseName[];
  href: string;
};

export const storyFacets: {
  key: StoryFacetKey;
  label: string;
  plural: string;
  icon: IconName;
  panelWidthClass: string;
}[] = [
  {
    key: "region",
    label: "Region",
    plural: "regions",
    icon: "globe",
    panelWidthClass: "w-280",
  },
  {
    key: "industry",
    label: "Industry",
    plural: "industries",
    icon: "buildings",
    panelWidthClass: "w-280",
  },
  {
    key: "product",
    label: "Products",
    plural: "products",
    icon: "square-grid-circle",
    panelWidthClass: "w-280",
  },
  {
    key: "useCase",
    label: "Use cases",
    plural: "use cases",
    icon: "lightbulb",
    panelWidthClass: "w-320",
  },
];

export const productIcons = {
  WAF: "product-waf",
  "DDoS Protection": "product-ddos-protection",
  Access: "product-access",
  Workers: "product-workers",
  "Workers AI": "product-workers-ai",
  "Durable Objects": "product-durable-objects",
  Queues: "product-queues",
  "Workers KV": "product-kv",
  CDN: "product-cdn",
  "Bot Management": "product-bot-management",
  "China Network": "product-china-network",
  Spectrum: "product-spectrum",
  "Argo Smart Routing": "product-argo-smart-routing",
  DNS: "product-dns",
  "Email Routing": "product-email-routing",
  R2: "product-r2",
  Images: "product-images",
  Stream: "product-stream",
  "Load Balancing": "product-load-balancing",
  "Cache Reserve": "product-cache-reserve",
  "Rate Limiting": "product-rate-limiting",
  "Magic Transit": "product-magic-transit",
  Gateway: "product-gateway",
  Web3: "product-web3",
  SSL: "product-ssl",
  Turnstile: "product-turnstile",
  "Browser Isolation": "product-browser-isolation",
  Pages: "product-cloudflare-pages",
} satisfies Record<string, IconName>;

export type ProductName = keyof typeof productIcons;

export const stories: Story[] = [
  {
    company: "Stack Overflow",
    logo: caseStudyLogos["stack-overflow"],
    products: ["WAF", "DDoS Protection"],
    industry: "High Technology",
    region: "North America",
    useCases: ["Secure Website & Applications"],
    href: "/case-studies/stack-overflow",
  },
  {
    company: "Canva",
    logo: caseStudyLogos["canva"],
    products: ["Access", "Workers", "R2", "Images", "Stream"],
    industry: "High Technology",
    region: "Asia-Pacific",
    useCases: [
      "Enable Zero Trust Security for Workforce",
      "Deploy Custom Code at the Edge",
      "Deliver Rich Media Experiences",
    ],
    href: "/case-studies/canva",
  },
  {
    company: "Squiz",
    logo: caseStudyLogos["squiz"],
    products: ["CDN", "Workers", "Load Balancing", "Cache Reserve"],
    industry: "High Technology",
    region: "Asia-Pacific",
    useCases: [
      "Accelerate Digital Properties",
      "Deploy Custom Code at the Edge",
    ],
    href: "/case-studies/squiz",
  },
  {
    company: "Mod.io",
    logo: caseStudyLogos["mod-io"],
    products: ["CDN", "WAF", "DDoS Protection", "Rate Limiting"],
    industry: "Gaming",
    region: "Asia-Pacific",
    useCases: [
      "Accelerate Digital Properties",
      "Secure Website & Applications",
    ],
    href: "/case-studies/mod-io",
  },
  {
    company: "Zendesk",
    logo: caseStudyLogos["zendesk"],
    products: ["CDN", "DDoS Protection", "Load Balancing"],
    industry: "High Technology",
    region: "North America",
    useCases: [
      "Accelerate Digital Properties",
      "Secure Website & Applications",
    ],
    href: "/case-studies/zendesk",
  },
  {
    company: "Carrefour",
    logo: caseStudyLogos["carrefour"],
    products: ["Bot Management", "WAF"],
    industry: "eCommerce",
    region: "Europe, Middle East & Africa",
    useCases: ["Secure Website & Applications"],
    href: "/case-studies/carrefour",
  },
  {
    company: "Polestar",
    logo: caseStudyLogos["polestar"],
    products: ["China Network", "Workers", "CDN", "Argo Smart Routing"],
    industry: "Travel & Leisure",
    region: "Europe, Middle East & Africa",
    useCases: [
      "Accelerate Digital Properties",
      "Deploy Custom Code at the Edge",
    ],
    href: "/case-studies/polestar",
  },
  {
    company: "OneTrust",
    logo: caseStudyLogos["onetrust"],
    products: ["Access", "Workers"],
    industry: "High Technology",
    region: "North America",
    useCases: [
      "Enable Zero Trust Security for Workforce",
      "Deploy Custom Code at the Edge",
    ],
    href: "/case-studies/onetrust",
  },
  {
    company: "ESL",
    logo: caseStudyLogos["esl"],
    products: ["Spectrum", "Argo Smart Routing", "Magic Transit"],
    industry: "Gaming",
    region: "Europe, Middle East & Africa",
    useCases: ["Protect Network Infrastructure"],
    href: "/case-studies/esl",
  },
  {
    company: "Bitso",
    logo: caseStudyLogos["bitso"],
    products: ["Argo Smart Routing", "Access", "Gateway"],
    industry: "Financial Services",
    region: "Latin America & the Caribbean",
    useCases: [
      "Protect Network Infrastructure",
      "Enable Zero Trust Security for Workforce",
    ],
    href: "/case-studies/bitso",
  },
  {
    company: "Mitsubishi Gas Chemical",
    logo: caseStudyLogos["mitsubishi-gas-chemical"],
    products: ["CDN", "DNS", "WAF", "SSL"],
    industry: "Manufacturing",
    region: "Asia-Pacific",
    useCases: [
      "Accelerate Digital Properties",
      "Secure Website & Applications",
    ],
    href: "/case-studies/mitsubishi-gas-chemical",
  },
  {
    company: "Fullscript",
    logo: caseStudyLogos["fullscript"],
    products: ["WAF", "Bot Management", "Turnstile", "Rate Limiting"],
    industry: "High Technology",
    region: "North America",
    useCases: ["Secure Website & Applications"],
    href: "/case-studies/fullscript",
  },
  {
    company: "Cybernews",
    logo: caseStudyLogos["cybernews"],
    products: ["Access", "Workers", "Browser Isolation", "Pages"],
    industry: "Media & Entertainment",
    region: "Europe, Middle East & Africa",
    useCases: [
      "Enable Zero Trust Security for Workforce",
      "Deploy Custom Code at the Edge",
      "Secure Workforce Applications, Devices and Networks",
    ],
    href: "/case-studies/cybernews",
  },
];
