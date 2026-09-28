import { useEffect, useLayoutEffect, useRef, useState } from "react";
import CornerDots from "@/components/CornerDots";
import GridArea from "@/components/GridArea";
import { rainLayer } from "@/components/scramble/rain";
import { setIntervalOnVisible, setTimeoutOnVisible } from "@/utils/visibility-timers";
import ConnectHeroTwizzler from "../hero/ConnectHeroTwizzler";
import { CONNECT_HERO_RAIN_DEFAULT } from "../hero/rain-control-settings";
import { CONNECT_HERO_TWIZZLER_DEFAULTS } from "../hero/twizzler-defaults";
import { EXHIBITION_HOURS, HAPPY_HOUR_LABEL, HAPPY_HOUR_TIME } from "./schedule";
import "./signage.css";

export default function Signage() {
  const root = useRef<HTMLElement>(null);
  const [scheduleVisible, setScheduleVisible] = useState(false);
  const [animationCycle, setAnimationCycle] = useState(0);

  useEffect(() => {
    const reveal = setTimeoutOnVisible({
      element: root.current,
      timeout: 1100,
      callback: () => setScheduleVisible(true),
    });
    const cycle = setIntervalOnVisible({
      element: root.current,
      interval: 30000,
      callback: () => setAnimationCycle((current) => current + 1),
    });
    return () => {
      reveal?.();
      cycle.cleanup();
    };
  }, []);

  const sweepDirection = animationCycle % 2 === 0 ? 1 : -1;

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

        <header className="signage-brand relative z-20 flex justify-center">
          <a aria-label="Cloudflare Connect 2026 home" href="/connect">
            <img alt="" src="/connect/signage-logo.svg" />
          </a>
        </header>

        <div className="signage-content relative z-10 text-center">
          <div className="signage-title-region flex items-center justify-center">
            <h1 className="signage-title text-heading-hero text-text-base" aria-label="Exhibition Hall">
              <RainText text="Exhibition Hall" headline cycle={animationCycle} direction={sweepDirection} />
            </h1>
          </div>

          <div className="signage-schedule relative" aria-label="Exhibition Hall hours">
            <div className="signage-days relative grid grid-cols-3 gap-16">
              {EXHIBITION_HOURS.map(({ day, hours }) => (
                <div
                  className="signage-day relative flex flex-col items-center justify-center bg-background-base p-8 before:inside-border before:border-border-default"
                  key={day}
                >
                  <div className="signage-day-label text-decorative-small text-text-base">
                    <RainText text={day} active={scheduleVisible} cycle={animationCycle} direction={sweepDirection} />
                  </div>
                  <div className="signage-hours text-decorative-small text-text-base">
                    <RainText text={hours} active={scheduleVisible} cycle={animationCycle} direction={sweepDirection} />
                  </div>
                </div>
              ))}
            </div>
            <div
              className="signage-happy-hour relative flex items-center justify-center bg-background-base p-8 text-decorative-small text-text-base before:inside-border before:border-border-default"
              aria-label={`${HAPPY_HOUR_LABEL}, ${HAPPY_HOUR_TIME}`}
            >
              <div className="signage-happy-hour-label">
                <RainText
                  text={HAPPY_HOUR_LABEL}
                  active={scheduleVisible}
                  cycle={animationCycle}
                  direction={sweepDirection}
                />
              </div>
              <span className="signage-happy-hour-separator" aria-hidden="true">
                ·
              </span>
              <div className="signage-happy-hour-time">
                <RainText
                  text={HAPPY_HOUR_TIME}
                  active={scheduleVisible}
                  cycle={animationCycle}
                  direction={sweepDirection}
                />
              </div>
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
  headline = false,
  cycle = 0,
  direction = 1,
}: {
  text: string;
  active?: boolean;
  headline?: boolean;
  cycle?: number;
  direction?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !active) return;
    let cancelled = false;
    let stop: (() => void) | undefined;
    // Measure the actual brand font, including on a cold first load.
    void document.fonts.ready.then(() => {
      if (cancelled) return;
      ({ stop } = rainLayer({
        layerEl: el,
        underHtml: "",
        toHtml: text,
        direction,
        background: "transparent",
        noiseColor: "var(--color-orange-900)",
        durationScale: headline ? 3 : 1.6,
        replay: cycle > 0,
        ...(headline && {
          sweepDuration: 450,
          orderedSweep: true,
          noiseDurationMs: 70,
          sweepEase: (progress: number) => progress,
          preserveCharacterWidths: true,
        }),
      }));
    });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [text, active, headline, cycle, direction]);

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
