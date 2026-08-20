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

const BadgeLanyard = lazy(() => import("./BadgeBillboard"));

export default function BadgePage(_props: IslandProps) {
  const twizzlerRef = useRef<HTMLCanvasElement>(null);
  const rainRef = useRef<HTMLCanvasElement>(null);
  const [params, setParams] = useState<BadgeParams>(DEFAULT_BADGE_PARAMS);
  const [hydrated, setHydrated] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [lowPower, setLowPower] = useState(false);
  const [shaderLive, setShaderLive] = useState(true);

  useEffect(() => {
    setParams(parseBadgeSearch(window.location.search));
    setHydrated(true);
    setLowPower(
      window.matchMedia("(max-width: 991px), (pointer: coarse)").matches
    );
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(motion.matches);
    const onMotion = () => setReducedMotion(motion.matches);
    motion.addEventListener("change", onMotion);
    return () => motion.removeEventListener("change", onMotion);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const next = serializeBadgeSearch(params);
    const url = `${window.location.pathname}${next}${window.location.hash}`;
    window.history.replaceState(null, "", url);
  }, [hydrated, params]);

  useEffect(() => {
    if (!lowPower) {
      setShaderLive(true);
      return;
    }
    setShaderLive(true);
    const id = window.setTimeout(() => setShaderLive(false), 2200);
    return () => window.clearTimeout(id);
  }, [lowPower, params]);

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
  const captureClass = lowPower
    ? "h-[450px] w-[300px]"
    : "h-[900px] w-[640px]";

  return (
    <div className="relative isolate mx-auto min-h-760 max-w-1200 overflow-hidden before:inside-border-b before:border-border-default">
      <CornerDots count={4} faintClassName="z-30" />

      {hydrated ? (
        <div
          aria-hidden="true"
          className={`pointer-events-none fixed top-0 left-[-2000px] z-0 ${captureClass}`}
        >
          <ConnectTwizzler
            canvasClassName="size-full"
            className="size-full"
            maxDpr={lowPower ? 1 : 1.5}
            maxFps={lowPower ? 10 : 30}
            paused={reducedMotion || !shaderLive}
            posterSrc="/connect/twizzler-poster.png"
            ref={twizzlerRef}
            rootMargin="4000px"
            settings={twizzler}
          />
          <StripesShader
            autoPlay={!reducedMotion && shaderLive}
            className="absolute inset-0 size-full"
            config={asThemedEngineConfig({
              ...rainConfig,
              maxFps: lowPower ? 10 : 30,
            })}
            label="badge-rain"
            maxDpr={lowPower ? 1 : 1.5}
            ref={rainRef}
            rootMargin="4000px"
            shaderSource={CONNECT_HERO_RAIN_SHADER_SOURCE}
          />
        </div>
      ) : null}

      <div className="absolute inset-0 z-0 max-lg:relative max-lg:h-520">
        <Suspense fallback={null}>
          {hydrated ? (
            <BadgeLanyard
              identity={{
                accent: view.theme.accent,
                company: view.company,
                name: view.name,
                role: view.role.label,
                serial: view.serial,
              }}
              lowPower={lowPower}
              rainCanvas={rainRef}
              reducedMotion={reducedMotion}
              shaderLive={shaderLive}
              twizzlerCanvas={twizzlerRef}
            />
          ) : null}
        </Suspense>
      </div>

      <div className="relative z-10 flex justify-between px-80 pt-80 pb-160 pointer-events-none max-lg:flex-col max-lg:gap-40 max-lg:px-24 max-lg:pt-32 max-lg:pb-80 max-lg:pointer-events-auto">
        <div className="flex w-440 shrink-0 flex-col items-start pointer-events-auto max-lg:w-full">
          <Eyebrow direction="left" title="Badge" variant="faint" />
          <h1 className="mt-24 text-heading-hero text-text-base">
            Your Connect 2026 badge
          </h1>
          <p className="mt-20 text-body-large text-text-base">
            The hero Twizzler and rain, printed on the badge. Grab it and pull
            — the lanyard wiggles back.
          </p>
          <div className="mt-40 text-label-x-small text-text-muted">
            Color scheme
          </div>
          <div className="mt-12">
            <BadgeCustomizer onChange={setParams} params={params} />
          </div>
          <Button className="mt-40" onClick={copy} size="large" type="button">
            <CopyFeedbackIcon copied={copied} />
            <span>{copied ? "Copied" : "Copy badge link"}</span>
          </Button>
        </div>
      </div>
      <div className="h-80 max-lg:hidden" />
    </div>
  );
}
