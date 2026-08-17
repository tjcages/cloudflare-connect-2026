import type { ImageMetadata } from "astro";
import bhanuTejaPachipulusu from "@/assets/quote/bhanu-teja-pachipulusu.png";
import duncanDavidson from "@/assets/quote/duncan-davidson.png";
import emilAhlback from "@/assets/quote/emil-ahlback.png";
import intercomTextureDark from "@/assets/quote/intercom-dark.png";
import intercomTexture from "@/assets/quote/intercom.png";
import jordanNeill from "@/assets/quote/jordan-neill.png";
import laurieVoss from "@/assets/quote/laurie-voss.png";
import leaguedTextureDark from "@/assets/quote/leagued-dark.png";
import leaguedTexture from "@/assets/quote/leagued.png";
import liveblocksTexture from "@/assets/quote/liveblocks.png";
import lovableTextureDark from "@/assets/quote/lovable-dark.png";
import lovableTexture from "@/assets/quote/lovable.png";
import nanGuo from "@/assets/quote/nan-guo.png";
import npmTextureDark from "@/assets/quote/npm-dark.png";
import npmTexture from "@/assets/quote/npm.png";
import shopifyTextureDark from "@/assets/quote/shopify-dark.png";
import shopifyTexture from "@/assets/quote/shopify.png";
import sitegptTextureDark from "@/assets/quote/sitegpt-dark.png";
import sitegptTexture from "@/assets/quote/sitegpt.png";
import zendeskTextureDark from "@/assets/quote/zendesk-dark.png";
import zendeskTexture from "@/assets/quote/zendesk.png";
import type { QuoteBrand } from "./texture-config";

interface QuotePreset {
  paragraphs: string[];
  author?: {
    name: string;
    role: string;
    company: string;
    avatar?: ImageMetadata;
    initials?: string;
  };
  cardClassName?: string;
  texture: ImageMetadata;
  textureDark?: ImageMetadata;
}

export const QUOTE_PRESETS: Record<QuoteBrand, QuotePreset> = {
  shopify: {
    paragraphs: [
      "For Shopify, the real challenge is not about how many different pieces of complex technology we can use but the opposite.",
      "Cloudflare helps us find a simple way to achieve something very complex that we can scale and maintain.",
    ],
    author: {
      name: "Duncan Davidson",
      role: "VP of Developer Productivity",
      company: "Shopify",
      avatar: duncanDavidson,
    },
    texture: shopifyTexture,
    textureDark: shopifyTextureDark,
  },
  lovable: {
    paragraphs: [
      "We needed a reliable way to capture screenshots at scale, and Cloudflare Browser Rendering solved it with a single API call.",
      "It was remarkably easy to implement and handles all our traffic without a hiccup.",
    ],
    author: {
      name: "Emil Ahlbäck",
      role: "Founding Engineer",
      company: "Lovable",
      avatar: emilAhlback,
    },
    texture: lovableTexture,
    textureDark: lovableTextureDark,
  },
  intercom: {
    paragraphs: [
      "Cloudflare's toolkit is accelerating that movement even faster. Their clear documentation, purpose-built tools, and developer-first platform helped Intercom go from concept to production in under a day.",
    ],
    author: {
      name: "Jordan Neill",
      role: "SVP Engineering",
      company: "Intercom",
      avatar: jordanNeill,
    },
    texture: intercomTexture,
    textureDark: intercomTextureDark,
  },
  zendesk: {
    paragraphs: [
      "Like Zendesk, innovation is in Cloudflare’s DNA — it mirrors our beautifully simple development ethos with the connectivity cloud, a powerful, yet simple-to-implement, end-to-end solution that does all the heavy lifting, so we don’t need to.",
    ],
    author: {
      name: "Nan Guo",
      role: "Senior Vice President of Engineering",
      company: "Zendesk",
      avatar: nanGuo,
    },
    texture: zendeskTexture,
    textureDark: zendeskTextureDark,
  },
  npm: {
    paragraphs: [
      "Over 10 million developers around the world rely on the npm Registry to download packages over 1 billion times a day.",
      "We invested in Cloudflare Workers to improve our global performance, and now with the Cloudflare Workers globally available key-value store (Cloudflare Workers KV), we can make performance improvements that used to be impossible.",
    ],
    author: {
      name: "Laurie Voss",
      role: "Co-founder and Chief Data Officer",
      company: "npm",
      avatar: laurieVoss,
    },
    cardClassName: "h-640",
    texture: npmTexture,
    textureDark: npmTextureDark,
  },
  liveblocks: {
    paragraphs: [
      "Cloudflare released Durable Objects at just the right time for us. Without Cloudflare, hosting WebSocket servers might have required at least four additional people just for management.",
      "Using Durable Objects, we can provide serverless capabilities without a dedicated team.",
    ],
    texture: liveblocksTexture,
  },
  leagued: {
    paragraphs: [
      "Choosing Cloudflare as our serverless provider was a no-brainer. Workers KV took just 15 minutes to get up and running.",
      "The ability to quickly spin up a Worker, deploy it to production, and scale effortlessly has been invaluable.",
    ],
    author: {
      name: "Sammi Sinno",
      role: "CEO",
      company: "Leagued",
      initials: "SS",
    },
    texture: leaguedTexture,
    textureDark: leaguedTextureDark,
  },
  sitegpt: {
    paragraphs: [
      "We use Cloudflare for everything – storage, cache, queues, and most importantly for training data and deploying the app on the edge, so I can ensure the product is reliable and fast.",
      "It's also been the most affordable option, with competitors costing more for a single day's worth of requests than Cloudflare costs in a month.",
    ],
    author: {
      name: "Bhanu Teja Pachipulusu",
      role: "Founder",
      company: "SiteGPT",
      avatar: bhanuTejaPachipulusu,
    },
    cardClassName: "h-640",
    texture: sitegptTexture,
    textureDark: sitegptTextureDark,
  },
};
