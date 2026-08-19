"use no memo";

import { StripesShader } from "@necatikcl/stripes-engine/react";
import { ConnectTwizzler } from "@tjcages/connect-twizzler/react";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import CornerDots from "@/components/CornerDots";
import Eyebrow from "@/components/Eyebrow";
import { asThemedEngineConfig } from "@/components/stripes-texture/config";
import type { IslandProps } from "@/types/island-props";
import { CONNECT_HERO_RAIN_SHADER_SOURCE } from "../hero/hero-rain-config";
import BadgeCustomizer from "./BadgeCustomizer";
import {
  DEFAULT_BADGE_PARAMS,
  parseBadgeSearch,
  resolveBadgeView,
  serializeBadgeSearch,
  type BadgeParams,
} from "./badge-params";
import { applyThemeToRain, applyThemeToTwizzler } from "./badge-themes";

const BadgeLanyard = lazy(() => import("./BadgeLanyard"));

export default function BadgePage(_props: IslandProps) {
  const twizzlerRef = useRef<HTMLCanvasElement>(null);
  const rainRef = useRef<HTMLCanvasElement>(null);
  const [params, setParams] = useState<BadgeParams>(DEFAULT_BADGE_PARAMS);
  const [hydrated, setHydrated] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    setParams(parseBadgeSearch(window.location.search));
    setHydrated(true);
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(media.matches);
    const onChange = () => setReducedMotion(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const next = serializeBadgeSearch(params);
    const url = `${window.location.pathname}${next}${window.location.hash}`;
    window.history.replaceState(null, "", url);
  }, [hydrated, params]);

  const view = useMemo(() => resolveBadgeView(params), [params]);
  const twizzler = useMemo(
    () => applyThemeToTwizzler(view.theme),
    [view.theme]
  );
  const rainConfig = useMemo(
    () => applyThemeToRain(view.theme, view.hash),
    [view.hash, view.theme]
  );

  return (
    <div className="relative isolate mx-auto min-h-760 overflow-hidden before:inside-border-b before:border-border-default md:min-h-[calc(100svh-88px)]">
      <CornerDots count={4} faintClassName="z-30" />

      <div className="relative z-10 flex min-h-760 flex-col md:min-h-[calc(100svh-88px)] md:flex-row">
        <div className="flex w-full shrink-0 items-center justify-center px-24 py-32 md:w-280 md:px-48 md:py-0">
          <div className="flex flex-col items-start gap-28">
            <Eyebrow direction="left" title="Badge" variant="faint" />
            <h1 className="sr-only">Connect 2026 badge</h1>
            <BadgeCustomizer onChange={setParams} params={params} />
          </div>
        </div>

        <div className="relative min-h-560 w-full flex-1 md:min-h-0">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-0 opacity-0"
          >
            <ConnectTwizzler
              canvasClassName="size-full"
              className="size-full"
              maxDpr={1.5}
              maxFps={30}
              paused={reducedMotion}
              posterSrc="/connect/twizzler-poster.png"
              ref={twizzlerRef}
              rootMargin="4000px"
              settings={twizzler}
            />
            <StripesShader
              autoPlay={!reducedMotion}
              className="absolute inset-0 size-full"
              config={asThemedEngineConfig(rainConfig)}
              label="badge-rain"
              maxDpr={1.5}
              ref={rainRef}
              rootMargin="4000px"
              shaderSource={CONNECT_HERO_RAIN_SHADER_SOURCE}
            />
          </div>

          <div className="absolute inset-0 z-10">
            <Suspense fallback={null}>
              {hydrated ? (
                <BadgeLanyard
                  fallback={view.theme.accent}
                  rainCanvas={rainRef}
                  reducedMotion={reducedMotion}
                  twizzlerCanvas={twizzlerRef}
                />
              ) : null}
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}
