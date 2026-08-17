import StripesTexture from "@/components/stripes-texture/StripesTexture";
import type { IslandProps } from "@/types/island-props";
import { QUOTE_TEXTURE_CONFIGS, type QuoteBrand } from "./texture-config";

interface Props {
  brand: QuoteBrand;
  src: string;
  darkSrc?: string;
}

export default function QuoteTexture({
  brand,
  src,
  darkSrc,
}: IslandProps<Props>) {
  return (
    <StripesTexture
      className="pointer-events-none size-full"
      config={QUOTE_TEXTURE_CONFIGS[brand]}
      darkSrc={darkSrc}
      label="quote"
      src={src}
    />
  );
}
