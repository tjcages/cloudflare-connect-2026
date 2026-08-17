import HeaderMenuBannerTexture from "./HeaderMenuBannerTexture";

export default function HeaderMenuBanner() {
  return (
    <div className="relative flex h-140 justify-end px-40 before:inside-border-t before:border-border-default">
      <HeaderMenuBannerTexture />

      <div className="relative self-end py-32 text-end text-[26px]/[28px] font-medium tracking-[-0.65px]">
        Connect <div className="text-orange-900">2026</div>
      </div>
    </div>
  );
}
