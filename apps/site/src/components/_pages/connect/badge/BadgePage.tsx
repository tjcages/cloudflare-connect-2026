"use no memo";

import { StripesShader } from "@necatikcl/stripes-engine/react";
import { ConnectTwizzler } from "@tjcages/connect-twizzler/react";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import Button from "@/components/Button";
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
  const face = useMemo(
    () => ({
      name: view.name,
      company: view.company,
      serial: view.serial,
      role: view.role,
      theme: view.theme,
      hash: view.hash,
    }),
    [view]
  );

  return (
    <div className="relative isolate mx-auto min-h-760 overflow-hidden before:inside-border-b before:border-border-default md:min-h-800">
      <CornerDots count={4} faintClassName="z-30" />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          maskImage:
            "linear-gradient(to bottom, transparent 8%, black 32%, black 100%)",
        }}
      >
        <ConnectTwizzler
          canvasClassName="size-full"
          className="size-full"
          maxDpr={1.5}
          maxFps={30}
          posterSrc="/connect/twizzler-poster.png"
          rootMargin="240px"
          settings={twizzler}
        />
        <StripesShader
          className="absolute inset-0 size-full"
          config={asThemedEngineConfig(rainConfig)}
          label="badge-rain"
          maxDpr={1.5}
          rootMargin="240px"
          shaderSource={CONNECT_HERO_RAIN_SHADER_SOURCE}
        />
      </div>

      <div className="relative z-10 flex flex-col gap-24 px-24 pt-48 pb-48 md:flex-row md:items-stretch md:gap-40 md:px-80 md:pt-64 md:pb-64">
        <div className="flex w-full shrink-0 flex-col md:w-400">
          <Eyebrow direction="left" title="Badge" variant="faint" />
          <h1 className="mt-24 text-heading-hero text-text-base">
            Your Connect
            <br />
            2026 badge
          </h1>
          <p className="mt-20 text-body-large text-text-base">
            Drag it. Flick it. Share a link — the Twizzler, rain, and badge
            colors follow the person on the URL.
          </p>
          <div className="mt-28 hidden md:block">
            <BadgeCustomizer
              onChange={setParams}
              params={params}
              serial={view.serial}
            />
          </div>
          <p className="mt-16 hidden text-body-x-small text-text-muted md:block">
            Drag the badge to spin it. Flick to bounce the lanyard.
          </p>
        </div>

        <div className="relative min-h-440 w-full flex-1 md:min-h-640">
          <Suspense fallback={null}>
            {hydrated ? (
              <BadgeLanyard face={face} reducedMotion={reducedMotion} />
            ) : null}
          </Suspense>
        </div>
      </div>

      <div className="relative z-10 px-24 pb-48 md:hidden">
        <BadgeCustomizer
          onChange={setParams}
          params={params}
          serial={view.serial}
        />
        <p className="mt-16 text-body-x-small text-text-muted">
          Drag the badge to spin it. Flick to bounce the lanyard.
        </p>
        <div className="mt-24">
          <Button href="/connect" size="large" variant="secondary">
            <span>Back to Connect</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
