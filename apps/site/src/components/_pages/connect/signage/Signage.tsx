import {
  type CSSProperties,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import CornerDots from "@/components/CornerDots";
import Eyebrow from "@/components/Eyebrow";
import GridArea from "@/components/GridArea";
import { rainLayer } from "@/components/scramble/rain";
import { setIntervalOnVisible } from "@/utils/visibility-timers";
import ConnectHeroTwizzler from "../hero/ConnectHeroTwizzler";
import { CONNECT_HERO_RAIN_DEFAULT } from "../hero/rain-control-settings";
import { CONNECT_HERO_TWIZZLER_DEFAULTS } from "../hero/twizzler-defaults";
import { HUB_HOURS, HAPPY_HOUR_LABEL, HAPPY_HOUR_TIME } from "./schedule";
import "./signage.css";

export default function Signage() {
  const root = useRef<HTMLElement>(null);
  const [animationCycle, setAnimationCycle] = useState(0);

  useEffect(() => {
    const cycle = setIntervalOnVisible({
      element: root.current,
      interval: 30000,
      callback: () => setAnimationCycle((current) => current + 1),
    });
    return cycle.cleanup;
  }, []);

  const sweepDirection = animationCycle % 2 === 0 ? 1 : -1;
  // `?day=monday|tuesday|wednesday` renders one day's sign; no param shows all days.
  const dayParam = useSearchParam("day");
  // `?layout=horizontal` puts the title left and stacks larger cards on the right.
  const layout =
    useSearchParam("layout") === "horizontal" ? "horizontal" : "row";
  const matched = HUB_HOURS.filter(({ day }) =>
    day.toLowerCase().startsWith(dayParam)
  );
  const days = matched.length ? matched : HUB_HOURS;
  // Every card is an eyebrow label over plain lines; Happy Hour rides with Tuesday.
  const cards: Card[] = days.map((entry) => ({
    label: entry.day,
    lines: "note" in entry ? [entry.note, entry.hours] : [entry.hours],
  }));
  if (days.some((entry) => "happyHour" in entry)) {
    cards.push({ label: HAPPY_HOUR_LABEL, lines: [HAPPY_HOUR_TIME] });
  }
  const fit = fitEms(cards);
  // The static HTML can't know the URL params, so the logo and content stay
  // hidden until the client render applies them, then fade in (no layout flash).
  const ready = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  );

  return (
    <section
      className="connect-signage relative isolate overflow-hidden"
      ref={root}
      aria-label="Cloudflare Connect Signage"
      data-layout={layout}
      data-ready={ready || undefined}
    >
      <GridArea
        className="signage-surround-grid inset-0 bg-background-muted"
        borderColor="dashed"
      />
      <div className="signage-frame relative isolate overflow-hidden bg-background-base before:inside-border before:border-border-default">
        <CornerDots count={4} />
        <div
          className="signage-shader pointer-events-none absolute inset-0"
          aria-hidden="true"
        >
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
            <h1
              className="signage-title text-heading-hero text-text-base"
              aria-label="The Hub"
            >
              <RainText
                text="The Hub"
                headline
                cycle={animationCycle}
                direction={sweepDirection}
              />
            </h1>
          </div>

          <div
            className="signage-schedule relative"
            aria-label="The Hub hours"
            style={
              { "--fit-w": fit.width, "--fit-h": fit.height } as CSSProperties
            }
          >
            <div className="signage-days relative grid grid-cols-3 gap-16">
              {cards.map(({ label, lines }) => (
                <div
                  className="signage-day relative flex items-center justify-center bg-background-base before:inside-border before:border-border-default"
                  key={label}
                >
                  <div className="signage-fit flex flex-col items-center text-decorative-small text-text-base">
                    <div className="signage-day-label">
                      <Eyebrow
                        className="signage-eyebrow"
                        direction="center"
                        fluid
                      >
                        <RainText
                          text={label}
                          cycle={animationCycle}
                          direction={sweepDirection}
                          noiseColor="var(--color-text-inverse)"
                        />
                      </Eyebrow>
                    </div>
                    {lines.map((line) => (
                      <div className="signage-hours" key={line}>
                        <RainText
                          text={line}
                          cycle={animationCycle}
                          direction={sweepDirection}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const noopSubscribe = () => () => {};

type Card = { label: string; lines: string[] };

// Card text is monospace, so its box in em follows from character counts alone.
// These mirror signage.css (line-height 1.2, eyebrow 0.85em + 0.5em gap). The
// CSS divides each card's space by them.
const CHAR_EM = 0.61;
const LINE_EM = 1.2;
const EYEBROW_SCALE = 0.85;
// Badge padding (12/12) plus four 2px ticks and their 4px outward offsets.
const EYEBROW_CHROME_EM = 1 + 8 / 12 + 8 / 12;

/** One em box shared by every visible card, so all cards use the same type size. */
function fitEms(cards: Card[]) {
  const boxes = cards.map(({ label, lines }) => ({
    width: Math.max(
      EYEBROW_SCALE * (label.length * CHAR_EM + EYEBROW_CHROME_EM),
      ...lines.map((line) => line.length * CHAR_EM)
    ),
    height: EYEBROW_SCALE * (16 / 12) + 0.5 + lines.length * LINE_EM,
  }));
  return {
    width: Math.max(...boxes.map((box) => box.width)),
    height: Math.max(...boxes.map((box) => box.height)),
  };
}

function useSearchParam(name: string) {
  return useSyncExternalStore(
    noopSubscribe,
    () => new URLSearchParams(location.search).get(name)?.toLowerCase() ?? "",
    () => ""
  );
}

/** The code-snippet sweep paints over a reserved text box, so it cannot reflow the layout. */
function RainText({
  text,
  headline = false,
  cycle = 0,
  direction = 1,
  noiseColor = "var(--color-orange-900)",
}: {
  text: string;
  headline?: boolean;
  cycle?: number;
  direction?: number;
  noiseColor?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
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
        noiseColor,
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
  }, [text, headline, cycle, direction, noiseColor]);

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
