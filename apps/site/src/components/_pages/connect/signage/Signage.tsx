import { useEffect, useRef, useState } from "react";
import WordFade from "@/components/_animations/shared/swap/WordFade";
import CornerDots from "@/components/CornerDots";
import Eyebrow from "@/components/Eyebrow";
import ConnectHeaderLogo from "@/components/header/ConnectHeaderLogo";
import Scramble from "@/components/scramble/Scramble";
import { setIntervalOnVisible, setTimeoutOnVisible } from "@/utils/visibility-timers";
import ConnectHeroTwizzler from "../hero/ConnectHeroTwizzler";
import { CONNECT_HERO_RAIN_DEFAULT } from "../hero/rain-control-settings";
import { CONNECT_HERO_TWIZZLER_DEFAULTS } from "../hero/twizzler-defaults";
import { SIGNAGE_DATE, SIGNAGE_HOLD_MS, SIGNAGE_SESSIONS } from "./sessions";
import "./signage.css";

export default function Signage() {
  const root = useRef<HTMLElement>(null);
  const [index, setIndex] = useState(0);
  const [scheduleVisible, setScheduleVisible] = useState(false);
  const session = SIGNAGE_SESSIONS[index];

  useEffect(() => {
    const reveal = setTimeoutOnVisible({
      element: root.current,
      timeout: 1100,
      callback: () => setScheduleVisible(true),
    });
    const cycle = setIntervalOnVisible({
      element: root.current,
      interval: SIGNAGE_HOLD_MS,
      callback: () => setIndex((current) => (current + 1) % SIGNAGE_SESSIONS.length),
    });
    return () => {
      reveal?.();
      cycle?.cleanup();
    };
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
        <Eyebrow direction="center" title="Cloudflare Connect · Sessions" />
        <h1 className="signage-title text-heading-hero text-text-base" aria-label={session.lines.join(" ")}>
          <span aria-hidden="true">
            {session.lines.map((line, lineIndex) => (
              <WordFade key={lineIndex} initial text={line} className="justify-center" />
            ))}
          </span>
        </h1>

        <div className="signage-schedule flex flex-col items-center" aria-label="Tuesday, October 20 session schedule">
          {scheduleVisible &&
            SIGNAGE_SESSIONS.map((item, itemIndex) => (
              <div
                className={`signage-session text-decorative-small ${itemIndex === index ? "text-orange-900" : "text-text-base"}`}
                key={item.id}
                aria-current={itemIndex === index ? "true" : undefined}
              >
                <span className="signage-session-dot" aria-hidden="true" />
                <Scramble
                  key={`${item.id}-${index}`}
                  preset="eyebrow-hero"
                  from="center"
                  text={`${item.time} · ${item.speaker}`}
                />
              </div>
            ))}
        </div>
      </div>

      <footer className="signage-footer relative z-10 flex items-center justify-between text-decorative-small text-text-base">
        <Scramble text={SIGNAGE_DATE} />
        <Scramble key={session.id} text={`${String(index + 1).padStart(2, "0")} / 02 · ${session.track}`} />
      </footer>
    </section>
  );
}
