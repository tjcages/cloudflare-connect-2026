import { useEffect, useLayoutEffect, useRef, useState } from "react";
import CornerDots from "@/components/CornerDots";
import GridArea from "@/components/GridArea";
import DashedLine from "@/components/dashed-line/DashedLine";
import DashedLineGrid from "@/components/dashed-line/DashedLineGrid";
import ConnectHeaderLogo from "@/components/header/ConnectHeaderLogo";
import { rainLayer } from "@/components/scramble/rain";
import { setIntervalOnVisible, setTimeoutOnVisible } from "@/utils/visibility-timers";
import ConnectHeroTwizzler from "../hero/ConnectHeroTwizzler";
import { CONNECT_HERO_RAIN_DEFAULT } from "../hero/rain-control-settings";
import { CONNECT_HERO_TWIZZLER_DEFAULTS } from "../hero/twizzler-defaults";
import { EXHIBITION_HOURS, HAPPY_HOUR } from "./schedule";
import "./signage.css";

export default function Signage() {
  const root = useRef<HTMLElement>(null);
  const [scheduleVisible, setScheduleVisible] = useState(false);
  const [titleCycle, setTitleCycle] = useState(0);

  useEffect(() => {
    const reveal = setTimeoutOnVisible({
      element: root.current,
      timeout: 1100,
      callback: () => setScheduleVisible(true),
    });
    const cycle = setIntervalOnVisible({
      element: root.current,
      interval: 30000,
      callback: () => setTitleCycle((current) => current + 1),
    });
    return () => {
      reveal?.();
      cycle.cleanup();
    };
  }, []);

  return (
    <section
      className="connect-signage relative isolate overflow-hidden"
      ref={root}
      aria-label="Cloudflare Connect Signage"
    >
      <GridArea className="inset-0 bg-background-muted" />
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

        <div className="signage-content relative z-10 text-center">
          <div className="signage-title-region flex items-center justify-center">
            <h1 className="signage-title text-heading-hero text-text-base" aria-label="Exhibition Hall">
              <RainText text="Exhibition Hall" cycle={titleCycle} direction={titleCycle % 2 === 0 ? 1 : -1} />
            </h1>
          </div>

          <div
            className="signage-schedule relative bg-background-base before:inside-border before:border-border-default"
            aria-label="Exhibition Hall hours"
          >
            <div className="signage-days relative grid grid-cols-3">
              {EXHIBITION_HOURS.map(({ day, hours }) => (
                <div className="signage-day flex flex-col items-center justify-center p-8" key={day}>
                  <div className="signage-day-label text-decorative-small text-text-base">
                    <RainText text={day} active={scheduleVisible} />
                  </div>
                  <div className="signage-hours text-decorative-small text-text-base">
                    <RainText text={hours} active={scheduleVisible} />
                  </div>
                </div>
              ))}
              <DashedLineGrid columns={3} rows={1} />
            </div>
            <div className="signage-happy-hour relative flex items-center justify-center p-8 text-decorative-small text-text-base">
              <DashedLine direction="horizontal" className="absolute inset-x-0 top-0 text-border-dashed" />
              <RainText text={HAPPY_HOUR} active={scheduleVisible} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/** The code-snippet sweep paints over a reserved text box, so it cannot reflow the layout. */
function RainText({
  text,
  active = true,
  cycle = 0,
  direction = 1,
}: {
  text: string;
  active?: boolean;
  cycle?: number;
  direction?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !active) return;
    const { stop } = rainLayer({
      layerEl: el,
      underHtml: "",
      toHtml: text,
      direction,
      background: "transparent",
    });
    return stop;
  }, [text, active, cycle, direction]);

  return (
    <span
      className="relative inline-block whitespace-pre"
      aria-label={text}
      data-rain-cycle={cycle}
      data-rain-direction={direction}
    >
      <span className="invisible" aria-hidden="true">
        {text}
      </span>
      <span className="absolute inset-0" aria-hidden="true" ref={ref} />
    </span>
  );
}
