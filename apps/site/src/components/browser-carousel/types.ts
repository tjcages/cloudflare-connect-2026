import type { BrowserGridVariant } from "@/components/browser/types";

export type BrowserLogo = Readonly<{
  src: string;
  darkSrc?: string;
  width: number;
  height: number;
}>;

export type BrowserCarouselItem = Readonly<{
  id: string;
  variant: BrowserGridVariant;
  logos: readonly [BrowserLogo] | readonly [BrowserLogo, BrowserLogo];
}>;
