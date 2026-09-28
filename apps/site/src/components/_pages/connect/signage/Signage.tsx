import { useEffect, useRef, useState } from "react";
import WordFade from "@/components/_animations/shared/swap/WordFade";
import CornerDots from "@/components/CornerDots";
import ConnectHeaderLogo from "@/components/header/ConnectHeaderLogo";
import Scramble from "@/components/scramble/Scramble";
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
      <div className="signage-shader pointer-events-none absolute inset-x-0 bottom-0" aria-hidden="true">
        <ConnectHeroTwizzler
          posterSrc="/connect/twizzler-poster.png"
          defaults={CONNECT_HERO_TWIZZLER_DEFAULTS}
          rainDefaults={CONNECT_HERO_RAIN_DEFAULT}
        />
      </div>

      <div className="signage-frame pointer-events-none absolute before:inside-border before:border-border-default">
        <CornerDots count={4} />
      </div>

      <header className="signage-brand relative z-10 flex justify-center">
        <ConnectHeaderLogo />
      </header>

      <div className="signage-content relative z-10 flex flex-col items-center text-center">
        <h1 className="signage-title text-heading-hero text-text-base" aria-label="Exhibition Hall">
          <span aria-hidden="true">
            <WordFade initial text="Exhibition Hall" className="justify-center" />
          </span>
        </h1>

        <div className="signage-schedule" aria-label="Exhibition Hall hours">
          {scheduleVisible &&
            EXHIBITION_HOURS.map(({ day, hours }) => (
              <div className="signage-day" key={day}>
                <Scramble
                  className="signage-day-label text-decorative-small text-text-base"
                  preset="eyebrow-hero"
                  from="center"
                  text={day}
                />
                <Scramble
                  className="signage-hours text-decorative-small text-text-base"
                  preset="eyebrow-hero"
                  from="center"
                  text={hours}
                />
              </div>
            ))}
        </div>
        <div className="signage-happy-hour text-decorative-small text-text-base">
          {scheduleVisible && <Scramble preset="eyebrow-hero" from="center" text={HAPPY_HOUR} />}
        </div>
      </div>
    </section>
  );
}
