import ConnectCloud from "@/assets/connect/connect-cloud.svg?react";
import {
  BADGE_SHARE_DATE,
  BADGE_SHARE_HEADLINE,
  BADGE_SHARE_VENUE,
} from "./badge-share";

/** Share-card lockup only. Live overlay stays the customizer copy. */
export default function BadgeShareCopy() {
  const headlineLines = BADGE_SHARE_HEADLINE.split("\n");
  const headlineTop = headlineLines[0] ?? BADGE_SHARE_HEADLINE;
  const headlineBottom = headlineLines[1];

  return (
    <div
      className="flex h-full flex-col justify-between py-80 text-left text-orange-900 opacity-0 max-lg:py-48 group-data-[share-capturing]/share:max-lg:py-80"
      data-share-copy=""
    >
      <div className="flex items-center gap-16">
        <span className="shrink-0" data-share-logo="">
          <ConnectCloud aria-hidden className="h-48 w-auto" />
        </span>
        <span className="flex flex-col leading-none">
          <span
            className="font-sans text-[24px] font-medium tracking-[-0.48px]"
            data-share-stamp=""
          >
            Cloudflare
          </span>
          <span
            className="font-sans text-[24px] font-normal tracking-[-0.48px]"
            data-share-stamp=""
          >
            Connect 2026
          </span>
        </span>
      </div>

      <div className="flex flex-col gap-32">
        <p className="text-heading-hero" data-share-stamp="">
          {headlineTop}
          {headlineBottom ? (
            <>
              <br />
              {headlineBottom}
            </>
          ) : null}
        </p>
        <p className="text-heading-h3" data-share-stamp="">
          {BADGE_SHARE_VENUE[0]}
          <br />
          {BADGE_SHARE_VENUE[1]}
        </p>
      </div>

      <p className="text-heading-h3" data-share-stamp="">
        {BADGE_SHARE_DATE}
      </p>
    </div>
  );
}
