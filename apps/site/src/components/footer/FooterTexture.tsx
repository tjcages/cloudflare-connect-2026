import cloudflareFooterTexture from "@/assets/footer/cloudflare-footer.png";
import StripesTexture from "@/components/stripes-texture/StripesTexture";
import { FOOTER_TEXTURE_CONFIG } from "./texture-config";

export default function FooterTexture() {
  return (
    <StripesTexture
      className="overlay z-10"
      config={FOOTER_TEXTURE_CONFIG}
      label="footer"
      src={cloudflareFooterTexture.src}
    />
  );
}
