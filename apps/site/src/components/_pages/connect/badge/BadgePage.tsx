"use no memo";

import { StripesShader } from "@necatikcl/stripes-engine/react";
import { ConnectTwizzler } from "@tjcages/connect-twizzler/react";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import Button from "@/components/Button";
import {
  CopyFeedbackIcon,
  useCopyFeedback,
} from "@/components/copy-feedback/CopyFeedback";
import CornerDots from "@/components/CornerDots";
import Eyebrow from "@/components/Eyebrow";
import { asThemedEngineConfig } from "@/components/stripes-texture/config";
import type { IslandProps } from "@/types/island-props";
import { CONNECT_HERO_RAIN_SHADER_SOURCE } from "../hero/hero-rain-config";
import BadgeCustomizer from "./BadgeCustomizer";
import {
  badgeSharePath,
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
  const sharePath = badgeSharePath(params);
  const shareUrl =
    typeof window === "undefined"
      ? sharePath
      : `${window.location.origin}${sharePath}`;
  const { copied, copy } = useCopyFeedback(shareUrl);
  const twizzler = useMemo(
    () => applyThemeToTwizzler(view.theme),
    [view.theme]
  );
  const rainConfig = useMemo(
    () => applyThemeToRain(view.theme, view.hash),
    [view.hash, view.theme]
  );

  return (
    <div className="relative isolate mx-auto min-h-[calc(100svh-88px)] overflow-hidden before:inside-border-b before:border-border-default">
      <CornerDots count={4} faintClassName="z-30" />

      <div className="relative z-10 flex min-h-[calc(100svh-88px)] flex-col md:flex-row">
        <div className="flex w-full shrink-0 items-center px-24 py-32 md:w-420 md:px-64 md:py-0">
          <div className="flex w-full flex-col items-start">
            <Eyebrow direction="left" title="Badge" variant="faint" />
            <h1 className="mt-20 text-heading-h3 text-text-base">
              Your Connect
              <br />
              2026 badge
            </h1>
            <p className="mt-16 text-body-small text-text-default">
              The hero Twizzler and rain, printed straight onto the badge.
              Drag it to spin — the lanyard wiggles back.
            </p>
            <div className="mt-28 text-label-x-small text-text-muted">
              Color scheme
            </div>
            <div className="mt-12">
              <BadgeCustomizer onChange={setParams} params={params} />
            </div>
            <Button className="mt-28" onClick={copy} size="large" type="button">
              <CopyFeedbackIcon copied={copied} />
              <span>{copied ? "Copied" : "Copy badge link"}</span>
            </Button>
          </div>
        </div>

        <div className="relative min-h-520 w-full flex-1 md:min-h-0">
          {/* Offscreen hero stack rendered at the badge's portrait aspect so
              the ribbon composes for the card instead of being cropped from a
              wide canvas. Kept invisible; each frame is copied onto the 3D
              badge face. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute top-0 left-0 z-0 opacity-0"
            style={{ height: 900, width: 640 }}
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
