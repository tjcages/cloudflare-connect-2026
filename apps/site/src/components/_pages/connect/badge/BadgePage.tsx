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
import Scramble from "@/components/scramble/Scramble";
import { asThemedEngineConfig } from "@/components/stripes-texture/config";
import HeroGrid from "@/layouts/window-hero/_svg/Grid.svg?react";
import type { IslandProps } from "@/types/island-props";
import { REGISTER_URL } from "../data";
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
    <div className="relative mx-auto max-w-1200">
      <Scramble
        className="absolute top-0 left-full h-80 w-max px-40 py-30 text-decorative-small-high text-text-faint select-none"
        text="Hero"
      />
      <Scramble
        className="absolute top-0 right-full h-80 w-max px-40 py-30 text-decorative-small-high text-text-faint select-none"
        group="sec"
        text="SEC 0.{n}"
      />
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

      <div className="relative h-640 before:inside-border-b before:border-border-default max-lg:h-auto">
        <HeroGrid
          aria-hidden="true"
          className="pointer-events-none absolute -top-0.5 -right-0.5 -z-10 h-641 w-401 text-border-default max-lg:hidden"
        />

        <div className="absolute top-0 right-0 h-640 w-560 max-lg:relative max-lg:h-520 max-lg:w-full">
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

        <div className="absolute bottom-80 left-80 flex w-520 flex-col gap-40 max-lg:static max-lg:w-full max-lg:px-24 max-lg:py-64">
          <Scramble
            className="text-decorative-small text-text-faint"
            preset="eyebrow-hero"
            segments={[
              { text: "01 · ", className: "[word-spacing:4.75px]" },
              { text: "BADGE", className: "text-orange-900" },
            ]}
          />

          <div>
            <h1 className="mb-16 text-heading-h1 text-text-base max-lg:[&_br]:hidden">
              Your Connect 2026
              <br />
              badge
            </h1>

            <div className="flex flex-col gap-24 text-body-large text-text-base max-lg:[&_br]:hidden">
              <p>
                The hero Twizzler and rain, printed on the badge. <br />
                Grab it and pull — the lanyard wiggles back.
              </p>
              <p>
                Pick a color scheme, then copy the link to share <br />
                your badge.
              </p>
              <BadgeCustomizer onChange={setParams} params={params} />
            </div>
          </div>

          <div className="flex gap-12 max-sm:flex-col">
            <Button onClick={copy} size="large" type="button">
              <CopyFeedbackIcon copied={copied} />
              <span>{copied ? "Copied" : "Copy badge link"}</span>
            </Button>
            <Button href={REGISTER_URL} size="large" variant="secondary">
              <span>Register now</span>
            </Button>
          </div>
        </div>
      </div>

      <div className="h-80" />
    </div>
  );
}
