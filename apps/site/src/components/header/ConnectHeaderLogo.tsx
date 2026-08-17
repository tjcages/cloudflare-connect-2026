import ConnectCloud from "@/assets/connect/connect-cloud.svg?react";

/** Figma Connect lockup (node 6:97): orange cloud + stacked wordmark → /connect */
export default function ConnectHeaderLogo() {
  return (
    <a
      aria-label="Cloudflare Connect 2026 home"
      className="flex items-center gap-12"
      href="/connect"
    >
      <ConnectCloud aria-hidden className="h-32 w-auto shrink-0" />
      <span className="flex flex-col leading-none">
        <span className="font-sans text-[18px] font-medium tracking-[-0.36px] text-orange-900">
          Cloudflare
        </span>
        <span className="font-sans text-[18px] font-normal tracking-[-0.36px] text-orange-900">
          Connect 2026
        </span>
      </span>
    </a>
  );
}
