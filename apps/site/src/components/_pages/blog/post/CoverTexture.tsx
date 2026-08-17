import StripesTexture from "@/components/stripes-texture/StripesTexture";
import type { IslandProps } from "@/types/island-props";
import { COVER_TEXTURE_CONFIG } from "./cover-texture-config";

interface Props {
  src: string;
  className?: string;
}

export default function CoverTexture({ src, className }: IslandProps<Props>) {
  return (
    <StripesTexture
      className={className}
      config={COVER_TEXTURE_CONFIG}
      label="post-cover"
      src={src}
    />
  );
}
