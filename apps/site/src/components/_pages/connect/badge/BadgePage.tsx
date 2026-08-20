"use no memo";

import { StripesShader } from "@necatikcl/stripes-engine/react";
import { ConnectTwizzler } from "@tjcages/connect-twizzler/react";
import { usePanel } from "@tjcages/panels/dev";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import Button from "@/components/Button";
import {
  CopyFeedbackIcon,
  useCopyFeedback,
} from "@/components/copy-feedback/CopyFeedback";
import CornerDots from "@/components/CornerDots";
import {
  cardStripes,
  cardTextureConfig,
  type StripeColors,
} from "@/components/_pages/case-studies/cards/texture-config";
import Scramble from "@/components/scramble/Scramble";
import { asThemedEngineConfig } from "@/components/stripes-texture/config";
import HeroGrid from "@/layouts/window-hero/_svg/Grid.svg?react";
import type { IslandProps } from "@/types/island-props";
import { REGISTER_URL } from "../data";
import { CONNECT_HERO_RAIN_SHADER_SOURCE } from "../hero/hero-rain-config";
import {
  BADGE_BACKDROP_CONFIG,
  BADGE_BACKDROP_SHADER_SOURCE,
} from "./badge-backdrop-config";
import {
  BADGE_TUNE_DEFAULTS,
  BADGE_TUNE_FIELDS,
  BADGE_TUNE_PANEL_ID,
} from "./badge-tune";
import BadgeCustomizer from "./BadgeCustomizer";
import {
  prepareBadgeLogo,
  readSvgFile,
  revokeLogoUrl,
  svgToBlobUrl,
} from "./badge-logo";
import BadgeLogoUpload from "./BadgeLogoUpload";
import {
  badgeSharePath,
  DEFAULT_BADGE_PARAMS,
  parseBadgeSearch,
  resolveBadgeView,
  serializeBadgeSearch,
  type BadgeParams,
} from "./badge-params";
import {
  applyThemeToRain,
  applyThemeToTwizzler,
  hexToColorInt,
  type BadgeTheme,
} from "./badge-themes";

type BadgeLogoSession = {
  fileName: string;
  textureUrl: string;
  markUrl: string;
};

function revokeLogo(session: BadgeLogoSession | null) {
  if (!session) return;
  revokeLogoUrl(session.textureUrl);
  revokeLogoUrl(session.markUrl);
}

function themeToStripeColors(theme: BadgeTheme): StripeColors {
  const hexes = theme.stripeHexes;
  const fallback = theme.accent;
  return [
    hexToColorInt(hexes[0] ?? fallback),
    hexToColorInt(hexes[1] ?? fallback),
    hexToColorInt(hexes[2] ?? fallback),
    hexToColorInt(hexes[3] ?? fallback),
    hexToColorInt(hexes[4] ?? fallback),
    hexToColorInt(hexes[5] ?? fallback),
    hexToColorInt(hexes[6] ?? fallback),
    hexToColorInt(hexes[7] ?? fallback),
  ];
}

const BadgeLanyard = lazy(() => import("./BadgeLanyard"));

export default function BadgePage(_props: IslandProps) {
  const [tune] = usePanel({
    id: BADGE_TUNE_PANEL_ID,
    title: "Badge",
    defaults: BADGE_TUNE_DEFAULTS,
    fields: BADGE_TUNE_FIELDS,
    defaultOpen: true,
    defaultTheme: "dark",
    prompts: [],
  });
  const twizzlerRef = useRef<HTMLCanvasElement>(null);
  const rainRef = useRef<HTMLCanvasElement>(null);
  const logoRef = useRef<HTMLCanvasElement>(null);
  const logoSessionRef = useRef<BadgeLogoSession | null>(null);
  const seededLogo = useRef(false);
  const [params, setParams] = useState<BadgeParams>(DEFAULT_BADGE_PARAMS);
  const [hydrated, setHydrated] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [lowPower, setLowPower] = useState(false);
  const [shaderLive, setShaderLive] = useState(true);
  const [logo, setLogo] = useState<BadgeLogoSession | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);

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

  useEffect(() => {
    return () => revokeLogo(logoSessionRef.current);
  }, []);

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
  const logoCaptureClass = lowPower
    ? "h-[128px] w-[320px]"
    : "h-[256px] w-[640px]";
  const backdropConfig = useMemo(() => {
    if (!lowPower) {
      return asThemedEngineConfig({
        ...BADGE_BACKDROP_CONFIG,
        maxFps: 30,
      });
    }
    return asThemedEngineConfig({
      ...BADGE_BACKDROP_CONFIG,
      maxFps: 10,
      background: {
        ...BADGE_BACKDROP_CONFIG.background,
        meteors: { enabled: false },
      },
      flames: { enabled: false },
      frames: { enabled: false },
    });
  }, [lowPower]);
  const logoConfig = useMemo(
    () =>
      asThemedEngineConfig({
        ...cardTextureConfig({
          stripes: cardStripes(themeToStripeColors(view.theme)),
        }),
        maxFps: lowPower ? 10 : 30,
        clickWave: { enabled: false },
        cursorTrail: { enabled: false },
        reveal: { enabled: false },
      }),
    [lowPower, view.theme]
  );

  const replaceLogo = (next: BadgeLogoSession | null) => {
    revokeLogo(logoSessionRef.current);
    logoSessionRef.current = next;
    setLogo(next);
  };

  const onLogoFile = (file: File) => {
    void (async () => {
      try {
        const prepared = prepareBadgeLogo(await readSvgFile(file));
        replaceLogo({
          fileName: file.name,
          markUrl: svgToBlobUrl(prepared.markSvg),
          textureUrl: svgToBlobUrl(prepared.textureSvg),
        });
        setLogoError(null);
      } catch (error) {
        setLogoError(
          error instanceof Error ? error.message : "Could not read that SVG."
        );
      }
    })();
  };

  useEffect(() => {
    if (!hydrated || seededLogo.current) return;
    seededLogo.current = true;
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/connect/badge-demo-logo.svg");
        if (!response.ok) return;
        const prepared = prepareBadgeLogo(await response.text());
        if (cancelled || logoSessionRef.current) return;
        replaceLogo({
          fileName: "Cloudflare.svg",
          markUrl: svgToBlobUrl(prepared.markSvg),
          textureUrl: svgToBlobUrl(prepared.textureSvg),
        });
      } catch {
        // Upload still works without the demo mark.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrated]);

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

      {hydrated && logo && tune.logoEnabled ? (
        <div
          aria-hidden="true"
          className={`pointer-events-none fixed top-0 left-[-2000px] z-0 ${logoCaptureClass}`}
        >
          <StripesShader
            autoPlay={!reducedMotion}
            className="size-full"
            config={logoConfig}
            label="badge-logo"
            maxDpr={lowPower ? 1 : 1.5}
            mediaKind="image"
            preloadRootMargin="4000px"
            ref={logoRef}
            rootMargin="4000px"
            src={logo.textureUrl}
          />
        </div>
      ) : null}

      <div className="relative h-640 overflow-x-visible before:inside-border-b before:border-border-default max-lg:h-auto">
        <HeroGrid
          aria-hidden="true"
          className="pointer-events-none absolute -top-0.5 -right-0.5 -z-10 h-641 w-401 text-border-default max-lg:hidden"
        />

        <div className="absolute inset-0 max-lg:relative max-lg:h-520">
          {hydrated ? (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 z-0 overflow-visible"
            >
              <div
                className="absolute top-0 right-0 h-full w-720 max-lg:w-full"
                style={{
                  maskImage: `radial-gradient(ellipse ${tune.backdropMaskW}% ${tune.backdropMaskH}% at ${tune.backdropMaskX}% ${tune.backdropMaskY}%, #000 16%, transparent 72%)`,
                  transform: `scale(${tune.backdropZoom})`,
                  transformOrigin: `${tune.backdropMaskX}% ${tune.backdropMaskY}%`,
                  WebkitMaskImage: `radial-gradient(ellipse ${tune.backdropMaskW}% ${tune.backdropMaskH}% at ${tune.backdropMaskX}% ${tune.backdropMaskY}%, #000 16%, transparent 72%)`,
                }}
              >
                <StripesShader
                  autoPlay={!reducedMotion && shaderLive}
                  className="size-full"
                  config={backdropConfig}
                  label="badge-backdrop"
                  maxDpr={lowPower ? 1 : 1.25}
                  rootMargin="200px"
                  shaderSource={BADGE_BACKDROP_SHADER_SOURCE}
                />
              </div>
            </div>
          ) : null}

          <div className="absolute inset-0 z-[1]">
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
                  logoCanvas={logoRef}
                  logoMarkSrc={
                    tune.logoEnabled ? (logo?.markUrl ?? null) : null
                  }
                  lowPower={lowPower}
                  rainCanvas={rainRef}
                  reducedMotion={reducedMotion}
                  shaderLive={shaderLive}
                  tune={tune}
                  twizzlerCanvas={twizzlerRef}
                />
              ) : null}
            </Suspense>
          </div>
        </div>

        <div className="absolute bottom-80 left-80 z-20 flex w-520 flex-col gap-40 max-lg:static max-lg:w-full max-lg:px-24 max-lg:py-64">
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
                Pick a color scheme. The Cloudflare mark is printed through the
                same case-study stripe texture — swap it with your own SVG.
              </p>
              <BadgeCustomizer onChange={setParams} params={params} />
              <BadgeLogoUpload
                error={logoError}
                fileName={logo?.fileName ?? null}
                onClear={() => {
                  replaceLogo(null);
                  setLogoError(null);
                }}
                onFile={onLogoFile}
              />
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
