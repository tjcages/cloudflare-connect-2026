import { useEffect, useLayoutEffect, useRef, useState } from "react";
import CornerDots from "@/components/CornerDots";
import ConnectHeaderLogo from "@/components/header/ConnectHeaderLogo";
import { rainLayer } from "@/components/scramble/rain";
import { setTimeoutOnVisible } from "@/utils/visibility-timers";
import ConnectHeroTwizzler from "../hero/ConnectHeroTwizzler";
import { CONNECT_HERO_RAIN_DEFAULT } from "../hero/rain-control-settings";
import { CONNECT_HERO_TWIZZLER_DEFAULTS } from "../hero/twizzler-defaults";
import { EXHIBITION_HOURS, HAPPY_HOUR } from "./schedule";
import "./signage.css";

export default function Signage() {
  const root = useRef<HTMLElement>(null);
  const [scheduleVisible, setScheduleVisible] = useState(false);

  useEffect(() => {
    const reveal = setTimeoutOnVisible({
      element: root.current,
      timeout: 1100,
      callback: () => setScheduleVisible(true),
    });
    return () => reveal?.();
  }, []);

  return (
    <section
      className="connect-signage relative isolate overflow-hidden"
      ref={root}
      aria-label="Cloudflare Connect Signage"
    >
      <div className="signage-frame relative isolate overflow-hidden bg-background-base before:inside-border before:border-border-default">
        <CornerDots count={4} />
        <div className="signage-shader pointer-events-none absolute inset-0" aria-hidden="true">
          <ConnectHeroTwizzler
            posterSrc="/connect/twizzler-poster.png"
            defaults={CONNECT_HERO_TWIZZLER_DEFAULTS}
            rainDefaults={CONNECT_HERO_RAIN_DEFAULT}
          />
        </div>

        <header className="signage-brand relative z-10 flex justify-center">
          <ConnectHeaderLogo />
        </header>

        <div className="signage-content relative z-10 flex flex-col items-center text-center">
          <h1 className="signage-title text-heading-hero text-orange-1000" aria-label="Exhibition Hall">
            <RainText text="Exhibition Hall" />
          </h1>

          <div className="signage-schedule" aria-label="Exhibition Hall hours">
            {scheduleVisible &&
              EXHIBITION_HOURS.map(({ day, hours }) => (
                <div className="signage-day relative before:inside-border before:border-neutral-7/60" key={day}>
                  <div className="signage-day-label text-decorative-small text-text-base">
                    <RainText text={day} />
                  </div>
                  <div className="signage-hours text-decorative-small text-text-base">
                    <RainText text={hours} />
                  </div>
                </div>
              ))}
          </div>
          <div className="signage-happy-hour relative text-decorative-small text-text-base before:inside-border before:border-neutral-7/60">
            {scheduleVisible && <RainText text={HAPPY_HOUR} />}
          </div>
        </div>
      </div>
    </section>
  );
}

/** Uses the same 01 → orange → resolved sweep as the marketing code snippets. */
function RainText({ text }: { text: string }) {
  const ref = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { stop } = rainLayer({ layerEl: el, underHtml: "", toHtml: text, background: "transparent" });
    return stop;
  }, [text]);

  return (
    <span className="inline-block whitespace-pre" ref={ref}>
      {text}
    </span>
  );
}
