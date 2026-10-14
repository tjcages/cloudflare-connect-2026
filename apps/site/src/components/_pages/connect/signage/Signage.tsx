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
import type { SofiLayer } from "../sofi-stadium/layers";
import { CONNECT_HERO_TWIZZLER_DEFAULTS } from "../hero/twizzler-defaults";
import { HUB_HOURS } from "./schedule";
import "./signage.css";

declare global {
  interface Window {
    /** Export hook driven by scripts/export-signage.mjs. */
    signageExport?: { frames: number; step(): void; replay(): void };
  }
}

/** Exported videos loop every LOOP_SEC; each loop starts a text sweep. */
const EXPORT_FPS = 60;
const EXPORT_LOOP_SEC = 20;

export default function Signage() {
  const root = useRef<HTMLElement>(null);
  const [animationCycle, setAnimationCycle] = useState(0);
  // `?export` swaps the live shader for deterministic, seamlessly looping layers
  // and hands the text sweeps to the exporter (see scripts/export-signage.mjs).
  const exporting = useSyncExternalStore(
    noopSubscribe,
    () => new URLSearchParams(location.search).has("export"),
    () => false
  );

  useEffect(() => {
    if (exporting) return;
    const cycle = setIntervalOnVisible({
      element: root.current,
      interval: 30000,
      callback: () => setAnimationCycle((current) => current + 1),
    });
    return cycle.cleanup;
  }, [exporting]);

  // Exports always sweep left to right (even cycles).
  const sweepDirection = animationCycle % 2 === 0 ? 1 : -1;
  // `?day=monday|tuesday|wednesday` renders one day's sign; no param shows all days.
  const dayParam = useSearchParam("day");
  const matched = HUB_HOURS.filter(({ day }) =>
    day.toLowerCase().startsWith(dayParam)
  );
  const days = matched.length ? matched : HUB_HOURS;
  // Every card is an eyebrow label over plain lines; a day with no lines has no card.
  const cards: Card[] = days.flatMap(({ day, lines, sponsor }) =>
    lines.length ? [{ label: day, lines: [...lines], sponsor }] : []
  );
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
      data-empty={cards.length === 0 || undefined}
      data-ready={ready || undefined}
      data-export={exporting || undefined}
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
          {exporting ? (
            <ExportShader
              onReplay={() => setAnimationCycle((current) => current + 2)}
            />
          ) : (
            <ConnectHeroTwizzler
              posterSrc="/connect/twizzler-poster.png"
              defaults={CONNECT_HERO_TWIZZLER_DEFAULTS}
              rainDefaults={CONNECT_HERO_RAIN_DEFAULT}
            />
          )}
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
              {cards.map(({ label, lines, sponsor }) => (
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
                    {sponsor && (
                      <div className="signage-sponsor flex flex-col items-center">
                        <div className="signage-sponsor-label">
                          <RainText
                            text="Brought to you by"
                            cycle={animationCycle}
                            direction={sweepDirection}
                          />
                        </div>
                        <img
                          className="signage-sponsor-logo"
                          alt={sponsor.name}
                          src={sponsor.logo}
                          style={{ height: `${sponsor.height ?? SPONSOR_LOGO_EM}em` }}
                        />
                      </div>
                    )}
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

/**
 * The hero's Twizzler + rain stack, rendered frame by frame by the SoFi Stadium
 * layers (sine phases quantized to the loop, rain crossfaded into its start) at
 * full device resolution, under the same top fade as ConnectHeroTwizzler.
 */
function ExportShader({ onReplay }: { onReplay: () => void }) {
  const host = useRef<HTMLDivElement>(null);
  const { topFadePct, topFadeOffsetPct } = CONNECT_HERO_RAIN_DEFAULT;

  useEffect(() => {
    let cancelled = false;
    let layers: SofiLayer[] = [];
    void import("../sofi-stadium/layers").then(({ createLayer }) => {
      const el = host.current;
      if (cancelled || !el) return;
      const width = Math.round(el.clientWidth * devicePixelRatio);
      const options = { aspect: 40 / 9, loopSec: EXPORT_LOOP_SEC };
      layers = (["twizzler", "rain"] as const).map((name) => {
        const layer = createLayer(name, width, options);
        layer.canvas.className = "absolute inset-0 size-full";
        el.appendChild(layer.canvas);
        return layer;
      });
      window.signageExport = {
        frames: EXPORT_FPS * EXPORT_LOOP_SEC,
        step: () => layers.forEach((layer) => layer.step()),
        replay: onReplay,
      };
    });
    return () => {
      cancelled = true;
      delete window.signageExport;
      for (const layer of layers) {
        layer.canvas.remove();
        layer.dispose();
      }
    };
    // onReplay only bumps state through a functional update; mount once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="absolute inset-0"
      ref={host}
      style={{
        maskImage: `linear-gradient(to bottom, transparent ${topFadeOffsetPct}%, black ${Math.min(100, topFadeOffsetPct + topFadePct)}%)`,
      }}
    />
  );
}

type Card = {
  label: string;
  lines: string[];
  sponsor?: { name: string; logo: string; aspect: number; height?: number };
};

// Card text is monospace, so its box in em follows from character counts alone.
// These mirror signage.css (line-height 1.2, eyebrow 0.85em + 0.5em gap). The
// CSS divides each card's space by them.
const CHAR_EM = 0.61;
const LINE_EM = 1.2;
const EYEBROW_SCALE = 0.85;
// Sponsor block: label at 0.6em, 0.4em gap, logo 2.2em tall (or its own height), 0.7em above it all.
const SPONSOR_LABEL_SCALE = 0.6;
const SPONSOR_LOGO_EM = 2.2;
const SPONSOR_GAPS_EM = 0.7 + SPONSOR_LABEL_SCALE * LINE_EM + 0.4;
// Badge padding (12/12) plus four 2px ticks and their 4px outward offsets.
const EYEBROW_CHROME_EM = 1 + 8 / 12 + 8 / 12;

/** One em box shared by every visible card, so all cards use the same type size. */
function fitEms(cards: Card[]) {
  const boxes = cards.map(({ label, lines, sponsor }) => ({
    width: Math.max(
      EYEBROW_SCALE * (label.length * CHAR_EM + EYEBROW_CHROME_EM),
      ...lines.map((line) => line.length * CHAR_EM),
      sponsor
        ? Math.max(
            SPONSOR_LABEL_SCALE * "Brought to you by".length * CHAR_EM,
            (sponsor.height ?? SPONSOR_LOGO_EM) * sponsor.aspect
          )
        : 0
    ),
    height:
      EYEBROW_SCALE * (16 / 12) +
      0.5 +
      lines.length * LINE_EM +
      (sponsor ? SPONSOR_GAPS_EM + (sponsor.height ?? SPONSOR_LOGO_EM) : 0),
  }));
  return {
    width: Math.max(0, ...boxes.map((box) => box.width)),
    height: Math.max(0, ...boxes.map((box) => box.height)),
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
