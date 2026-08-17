import type { SvgComponent } from "astro/types";
import type { FC, SVGProps } from "react";
import type { Stripe } from "@necatikcl/stripes-engine";
import anadoluEfesTexture from "../cards/_textures/anadolu-efes.svg?url";
import canvaTexture from "../cards/_textures/canva.svg?url";
import deliveryHeroTexture from "../cards/_textures/delivery-hero.svg?url";
import discordTexture from "../cards/_textures/discord.svg?url";
import dockerTexture from "../cards/_textures/docker.svg?url";
import elementorTexture from "../cards/_textures/elementor.svg?url";
import envatoTexture from "../cards/_textures/envato.svg?url";
import liveblocksTexture from "../cards/_textures/liveblocks.svg?url";
import shopifyTexture from "../cards/_textures/shopify.svg?url";
import skyscannerTexture from "../cards/_textures/skyscanner.svg?url";
import teamviewerTexture from "../cards/_textures/teamviewer.svg?url";
import uniswapTexture from "../cards/_textures/uniswap.svg?url";
import vscoTexture from "../cards/_textures/vsco.svg?url";
import {
  CASE_CARDS,
  MONO_STRIPE_COLORS,
  MONO_WHITE_POINT,
  type CaseCardData,
  type CaseCardName,
} from "../cards/data";
import { cardStripes } from "../cards/texture-config";
import AnadoluEfesLogo from "./_svg/anadolu-efes.svg";
import BitsoLogo from "./_svg/bitso.svg";
import CanvaLogo from "./_svg/canva.svg";
import CarrefourLogo from "./_svg/carrefour.svg";
import CybernewsLogo from "./_svg/cybernews.svg";
import DeliveryHeroLogo from "./_svg/delivery-hero.svg";
import DiscordLogo from "./_svg/discord.svg";
import DockerLogo from "./_svg/docker.svg";
import ElementorLogo from "./_svg/elementor.svg";
import EnvatoLogo from "./_svg/envato.svg";
import EslLogo from "./_svg/esl.svg";
import FullscriptLogo from "./_svg/fullscript.svg";
import LiveblocksLogo from "./_svg/liveblocks.svg";
import MitsubishiGasChemicalLogo from "./_svg/mitsubishi-gas-chemical.svg";
import ModIoLogo from "./_svg/mod-io.svg";
import OnetrustLogo from "./_svg/onetrust.svg";
import PolestarLogo from "./_svg/polestar.svg";
import ShopifyLogo from "./_svg/shopify.svg";
import SkyscannerLogo from "./_svg/skyscanner.svg";
import SquizLogo from "./_svg/squiz.svg";
import StackOverflowLogo from "./_svg/stack-overflow.svg";
import TeamviewerLogo from "./_svg/teamviewer.svg";
import UniswapLogo from "./_svg/uniswap.svg";
import VscoLogo from "./_svg/vsco.svg";
import ZendeskLogo from "./_svg/zendesk.svg";
import bitsoTexture from "../cards/_textures/bitso.svg?url";
import carrefourTexture from "../cards/_textures/carrefour.svg?url";
import cybernewsTexture from "../cards/_textures/cybernews.svg?url";
import eslTexture from "../cards/_textures/esl.svg?url";
import fullscriptTexture from "../cards/_textures/fullscript.svg?url";
import mitsubishiGasChemicalTexture from "../cards/_textures/mitsubishi-gas-chemical.svg?url";
import modIoTexture from "../cards/_textures/mod-io.svg?url";
import onetrustTexture from "../cards/_textures/onetrust.svg?url";
import polestarTexture from "../cards/_textures/polestar.svg?url";
import squizTexture from "../cards/_textures/squiz.svg?url";
import stackOverflowTexture from "../cards/_textures/stack-overflow.svg?url";
import zendeskTexture from "../cards/_textures/zendesk.svg?url";
import { storyStripes } from "./story-stripes";

export type StoryBanner = {
  stripes: Stripe[];
  whitePoint?: number;
  sparkleStripe?: CaseCardData["sparkleStripe"];
  stripeGradient?: readonly number[];
  texture: string;
  Logo: FC<SVGProps<SVGSVGElement>> | SvgComponent;
  brandClass: string;
  cardClass: string;
  logoClass?: string;
  wordmark: boolean;
};

function fromCard(
  name: CaseCardName,
  texture: string,
  Logo: SvgComponent,
  logoClass?: string
): StoryBanner {
  const card: CaseCardData = CASE_CARDS[name];

  return {
    stripes: cardStripes(card.stripeColors),
    whitePoint: card.whitePoint,
    sparkleStripe: card.sparkleStripe,
    stripeGradient: card.stripeGradient,
    texture,
    Logo,
    brandClass: `story-brand-${name}`,
    cardClass: `case-card-${name}`,
    logoClass,
    wordmark: true,
  };
}

const BANNERS: Record<string, StoryBanner> = {
  skyscanner: fromCard("skyscanner", skyscannerTexture, SkyscannerLogo),
  shopify: fromCard("shopify", shopifyTexture, ShopifyLogo),
  uniswap: {
    ...fromCard("uniswap", uniswapTexture, UniswapLogo),
    logoClass: "*:size-112",
    wordmark: false,
  },
  discord: fromCard("discord", discordTexture, DiscordLogo),
  "anadolu-efes": fromCard(
    "anadolu-efes",
    anadoluEfesTexture,
    AnadoluEfesLogo,
    "scale-118"
  ),
  "delivery-hero": fromCard(
    "delivery-hero",
    deliveryHeroTexture,
    DeliveryHeroLogo,
    "scale-118"
  ),
  envato: fromCard("envato", envatoTexture, EnvatoLogo, "scale-118"),
  canva: fromCard("canva", canvaTexture, CanvaLogo, "scale-118"),
  teamviewer: fromCard(
    "teamviewer",
    teamviewerTexture,
    TeamviewerLogo,
    "scale-118"
  ),
  vsco: {
    ...fromCard("vsco", vscoTexture, VscoLogo),
    logoClass: "*:size-112",
    wordmark: false,
  },
  liveblocks: fromCard(
    "liveblocks",
    liveblocksTexture,
    LiveblocksLogo,
    "scale-118"
  ),
  elementor: fromCard(
    "elementor",
    elementorTexture,
    ElementorLogo,
    "scale-118"
  ),
  docker: fromCard("docker", dockerTexture, DockerLogo, "scale-118"),
  "stack-overflow": {
    stripes: storyStripes(
      0xf48024,
      0xffbe5c,
      [0.039, 0.088, 0.141, 0.239, 0.335, 0.374, 0.423]
    ),
    texture: stackOverflowTexture,
    Logo: StackOverflowLogo,
    brandClass: "story-brand-stack-overflow",
    cardClass: "case-card-stack-overflow",
    logoClass: "*:size-112",
    wordmark: false,
  },
  squiz: {
    stripes: storyStripes(
      0x001822,
      0x96f2a9,
      [0.02, 0.2, 0.369, 0.451, 0.486, 0.51, 0.541]
    ),
    texture: squizTexture,
    Logo: SquizLogo,
    brandClass: "story-brand-squiz",
    cardClass: "case-card-squiz",
    logoClass: "*:size-112",
    wordmark: false,
  },
  "mod-io": {
    stripes: storyStripes(
      0x0891a8,
      0x4fe0f4,
      [0.02, 0.063, 0.11, 0.157, 0.204, 0.239, 0.275]
    ),
    texture: modIoTexture,
    Logo: ModIoLogo,
    brandClass: "story-brand-mod-io",
    cardClass: "case-card-mod-io",
    logoClass: "*:size-112",
    wordmark: false,
  },
  zendesk: {
    stripes: storyStripes(
      0x03363d,
      0x3fd6c5,
      [0.02, 0.149, 0.22, 0.31, 0.337, 0.365, 0.396]
    ),
    texture: zendeskTexture,
    Logo: ZendeskLogo,
    brandClass: "story-brand-zendesk",
    cardClass: "case-card-zendesk",
    logoClass: "*:size-112",
    wordmark: false,
  },
  carrefour: {
    stripes: storyStripes(
      0x004e9f,
      0x4aa6f5,
      [0.02, 0.071, 0.118, 0.227, 0.306, 0.369, 0.431]
    ),
    texture: carrefourTexture,
    Logo: CarrefourLogo,
    brandClass: "story-brand-carrefour",
    cardClass: "case-card-carrefour",
    logoClass: "*:size-112",
    wordmark: false,
  },
  polestar: {
    stripes: cardStripes(MONO_STRIPE_COLORS),
    whitePoint: MONO_WHITE_POINT,
    texture: polestarTexture,
    Logo: PolestarLogo,
    brandClass: "story-brand-polestar",
    cardClass: "case-card-polestar",
    logoClass: "*:size-112",
    wordmark: false,
  },
  onetrust: {
    stripes: storyStripes(
      0x4a8f2c,
      0x9fe86a,
      [0.02, 0.106, 0.192, 0.275, 0.376, 0.384, 0.408]
    ),
    texture: onetrustTexture,
    Logo: OnetrustLogo,
    brandClass: "story-brand-onetrust",
    cardClass: "case-card-onetrust",
    logoClass: "*:size-112",
    wordmark: false,
  },
  esl: {
    stripes: storyStripes(
      0x1d1d1b,
      0xffff09,
      [0.02, 0.141, 0.329, 0.431, 0.482, 0.514, 0.529]
    ),
    texture: eslTexture,
    Logo: EslLogo,
    brandClass: "story-brand-esl",
    cardClass: "case-card-esl",
    logoClass: "*:size-112",
    wordmark: false,
  },
  bitso: {
    stripes: storyStripes(
      0x5463ff,
      0xafbdff,
      [0.02, 0.2, 0.204, 0.251, 0.329, 0.392, 0.431]
    ),
    texture: bitsoTexture,
    Logo: BitsoLogo,
    brandClass: "story-brand-bitso",
    cardClass: "case-card-bitso",
    logoClass: "*:size-112",
    wordmark: false,
  },
  "mitsubishi-gas-chemical": {
    stripes: storyStripes(
      0xe60012,
      0xff5140,
      [0.02, 0.09, 0.224, 0.394, 0.478, 0.541, 0.612]
    ),
    texture: mitsubishiGasChemicalTexture,
    Logo: MitsubishiGasChemicalLogo,
    brandClass: "story-brand-mitsubishi-gas-chemical",
    cardClass: "case-card-mitsubishi-gas-chemical",
    logoClass: "*:size-112",
    wordmark: false,
  },
  fullscript: {
    stripes: storyStripes(
      0x729a3f,
      0xb9e26a,
      [0.035, 0.149, 0.2, 0.247, 0.278, 0.29, 0.31]
    ),
    texture: fullscriptTexture,
    Logo: FullscriptLogo,
    brandClass: "story-brand-fullscript",
    cardClass: "case-card-fullscript",
    logoClass: "*:size-112",
    wordmark: false,
  },
  cybernews: {
    stripes: cardStripes(MONO_STRIPE_COLORS),
    whitePoint: MONO_WHITE_POINT,
    texture: cybernewsTexture,
    Logo: CybernewsLogo,
    brandClass: "story-brand-cybernews",
    cardClass: "case-card-cybernews",
    logoClass: "*:size-112",
    wordmark: false,
  },
};

export function getStoryBanner(slug: string): StoryBanner | undefined {
  return BANNERS[slug];
}
