import StripesTexture from "@/components/stripes-texture/StripesTexture";
import { MENU_BANNER_TEXTURE_CONFIG } from "./texture-config";

export default function HeaderMenuBannerTexture() {
  return (
    <StripesTexture
      className="overlay"
      config={MENU_BANNER_TEXTURE_CONFIG}
      label="menu-banner"
      src="/cta/texture.mp4"
    />
  );
}
