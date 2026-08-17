import StripesTexture from "@/components/stripes-texture/StripesTexture";
import type { IslandProps } from "@/types/island-props";
import { cardTextureConfig, type CardTextureOverrides } from "./texture-config";

interface Props {
  src: string;
  overrides: CardTextureOverrides;
  className?: string;
}

export default function CardTexture({
  src,
  overrides,
  className,
}: IslandProps<Props>) {
  return (
    <StripesTexture
      className={className}
      config={cardTextureConfig(overrides)}
      label="card"
      src={src}
    />
  );
}
