import { useEffect, useState } from "react";
import cloudflareFooterTexture from "@/assets/footer/cloudflare-footer.png";
import StripesTexture from "@/components/stripes-texture/StripesTexture";
import {
  FOOTER_SHADER_CURRENT,
  FOOTER_SHADER_SETTINGS_EVENT,
  footerTextureConfigFromSettings,
  loadFooterShaderSettings,
  type FooterShaderSettings,
} from "./footer-shader-controls";

export default function FooterTexture() {
  const [settings, setSettings] = useState<FooterShaderSettings>(FOOTER_SHADER_CURRENT);

  useEffect(() => {
    setSettings(loadFooterShaderSettings());
    const onSettings = (event: Event) => {
      setSettings((event as CustomEvent<FooterShaderSettings>).detail);
    };
    window.addEventListener(FOOTER_SHADER_SETTINGS_EVENT, onSettings);
    return () => {
      window.removeEventListener(FOOTER_SHADER_SETTINGS_EVENT, onSettings);
    };
  }, []);

  return (
    <div className="overlay z-10" style={{ opacity: settings.shaderOpacity }}>
      <StripesTexture
        className="size-full"
        config={footerTextureConfigFromSettings(settings)}
        label="footer"
        src={cloudflareFooterTexture.src}
      />
    </div>
  );
}
