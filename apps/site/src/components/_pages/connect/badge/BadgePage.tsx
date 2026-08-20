"use no memo";

import { StripesShader } from "@necatikcl/stripes-engine/react";
import { ConnectTwizzler } from "@tjcages/connect-twizzler/react";
import { usePanel } from "@tjcages/panels/dev";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { flushSync } from "react-dom";
import Button from "@/components/Button";
import { CopyFeedbackIcon } from "@/components/copy-feedback/CopyFeedback";
import CornerDots from "@/components/CornerDots";
import Icon from "@/components/icon/Icon";
import {
  cardStripes,
  cardTextureConfig,
  type StripeColors,
} from "@/components/_pages/case-studies/cards/texture-config";
import Scramble from "@/components/scramble/Scramble";
import { asThemedEngineConfig } from "@/components/stripes-texture/config";
import HeroGrid from "@/layouts/window-hero/_svg/Grid.svg?react";
import type { IslandProps } from "@/types/island-props";
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
  BADGE_PRINT_FIELD_SRC,
  badgeLogoPreviewSrc,
  badgeMarkSvg,
  badgeShaderPlateRaster,
  badgeShaderPlateSvg,
  prepareBadgeLogo,
  readLogoFile,
  svgToBlobUrl,
} from "./badge-logo";
import BadgePrintShader from "./BadgePrintShader";
import BadgeShareDock from "./BadgeShareDock";
import {
  badgeShareHeadline,
  badgeTweetUrl,
  captureHeroShare,
  copyCanvasImage,
} from "./badge-share";
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
  badgeMarkFill,
  hexToColorInt,
  type BadgeTheme,
} from "./badge-themes";
import { applyBadgeTwizzlerOverlay } from "./badge-twizzler-overlay";

type BadgeLogoSession =
  | { kind: "svg"; fileName: string; sourceSvg: string }
  | {
      kind: "raster";
      fileName: string;
      dataUrl: string;
      width: number;
      height: number;
    };

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
  const [tune, setTune] = usePanel({
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
  const logoRef = useRef<HTMLCanvasElement | null>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const shareUrlRef = useRef<string | null>(null);
  const copiedTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const logoSessionRef = useRef<BadgeLogoSession | null>(null);
  const seededLogo = useRef(false);
  const [params, setParams] = useState<BadgeParams>(DEFAULT_BADGE_PARAMS);
  const [hydrated, setHydrated] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [lowPower, setLowPower] = useState(false);
  const [shaderLive, setShaderLive] = useState(true);
  const [logo, setLogo] = useState<BadgeLogoSession | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [sharePreview, setSharePreview] = useState<{
    src: string;
    title: string;
  } | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareCapture, setShareCapture] = useState(false);

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
  const pageUrl =
    typeof window === "undefined"
      ? sharePath
      : `${window.location.origin}${sharePath}`;
  const twizzler = useMemo(
    () => applyBadgeTwizzlerOverlay(applyThemeToTwizzler(view.theme), tune),
    [tune, view.theme]
  );
  const rainConfig = useMemo(
    () => applyThemeToRain(view.theme, view.hash),
    [view.hash, view.theme]
  );
  const printW = lowPower ? 400 : 800;
  const printH = lowPower ? 300 : 600;
  const captureClass = lowPower ? "h-[300px] w-[400px]" : "h-[600px] w-[800px]";
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
    () => ({
      ...cardTextureConfig({
        stripes: cardStripes(themeToStripeColors(view.theme)),
        whitePoint: 0.8,
      }),
      maxFps: lowPower ? 10 : 30,
      clickWave: { enabled: false as const },
      cursorTrail: { enabled: false as const },
      reveal: { enabled: false as const },
      transform: {
        // Case-study lab renders used fit:width on the stripe stack.
        fit: "width" as const,
        zoom: tune.sourceZoom,
        panX: tune.sourcePanX,
        panY: tune.sourcePanY,
      },
    }),
    [lowPower, tune.sourcePanX, tune.sourcePanY, tune.sourceZoom, view.theme]
  );

  const logoMarkSrc = useMemo(() => {
    if (!logo || !tune.logoEnabled) return null;
    switch (logo.kind) {
      case "raster":
        return logo.dataUrl;
      case "svg":
        try {
          return svgToBlobUrl(
            badgeMarkSvg(logo.sourceSvg, badgeMarkFill(view.theme))
          );
        } catch {
          return null;
        }
      default: {
        const _exhaustive: never = logo;
        return _exhaustive;
      }
    }
  }, [logo, tune.logoEnabled, view.theme]);

  const logoPreviewSrc = useMemo(
    () => (logo ? badgeLogoPreviewSrc(logo) : null),
    [logo]
  );

  const plateSrc = useMemo(() => {
    if (!logo) return BADGE_PRINT_FIELD_SRC;
    try {
      switch (logo.kind) {
        case "raster":
          return svgToBlobUrl(
            badgeShaderPlateRaster(
              logo.dataUrl,
              { w: logo.width, h: logo.height },
              tune.sourceLight
            )
          );
        case "svg":
          return svgToBlobUrl(
            badgeShaderPlateSvg(logo.sourceSvg, tune.sourceLight)
          );
        default: {
          const _exhaustive: never = logo;
          return _exhaustive;
        }
      }
    } catch {
      return BADGE_PRINT_FIELD_SRC;
    }
  }, [logo, tune.sourceLight]);

  const replaceLogo = (next: BadgeLogoSession | null) => {
    logoSessionRef.current = next;
    setLogo(next);
  };

  const onLogoFile = (file: File) => {
    void (async () => {
      try {
        const next = await readLogoFile(file);
        if (next.kind === "svg") prepareBadgeLogo(next.sourceSvg);
        replaceLogo(next);
        setLogoError(null);
      } catch (error) {
        setLogoError(
          error instanceof Error ? error.message : "Could not read that file."
        );
      }
    })();
  };

  useEffect(
    () => () => {
      if (shareUrlRef.current) URL.revokeObjectURL(shareUrlRef.current);
      clearTimeout(copiedTimeoutRef.current);
    },
    []
  );

  const captureShareCard = useCallback(async () => {
    const title = badgeShareHeadline(view.name);
    const hero = heroRef.current;
    if (!hero) throw new Error("Could not capture the badge.");
    flushSync(() => setShareCapture(true));
    try {
      const canvas = await captureHeroShare(hero);
      const next = await copyCanvasImage(canvas);
      if (shareUrlRef.current) URL.revokeObjectURL(shareUrlRef.current);
      shareUrlRef.current = next.url;
      setSharePreview({ src: next.url, title });
      setShareCopied(next.copied);
      clearTimeout(copiedTimeoutRef.current);
      if (next.copied) {
        copiedTimeoutRef.current = setTimeout(
          () => setShareCopied(false),
          2000
        );
      }
      return title;
    } finally {
      flushSync(() => setShareCapture(false));
    }
  }, [view.name]);

  const onCopyShareable = () => {
    if (sharing) return;
    setSharing(true);
    void captureShareCard()
      .catch(() => undefined)
      .finally(() => setSharing(false));
  };

  const onShareX = () => {
    if (sharing) return;
    window.open(
      badgeTweetUrl(badgeShareHeadline(view.name), pageUrl),
      "_blank",
      "noopener,noreferrer"
    );
    setSharing(true);
    void captureShareCard().finally(() => setSharing(false));
  };

  const dismissShare = () => {
    setSharePreview(null);
    setShareCopied(false);
    if (shareUrlRef.current) {
      URL.revokeObjectURL(shareUrlRef.current);
      shareUrlRef.current = null;
    }
  };

  useEffect(() => {
    if (!hydrated || seededLogo.current) return;
    seededLogo.current = true;
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/connect/badge-demo-logo.svg");
        if (!response.ok) return;
        const sourceSvg = await response.text();
        prepareBadgeLogo(sourceSvg);
        if (cancelled || logoSessionRef.current) return;
        replaceLogo({
          kind: "svg",
          fileName: "Cloudflare.svg",
          sourceSvg,
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

      {hydrated && (tune.printTwizzler || tune.printRain) ? (
        <div
          aria-hidden="true"
          className={`pointer-events-none fixed top-0 -left-2000 z-0 ${captureClass}`}
        >
          {tune.printTwizzler ? (
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
          ) : null}
          {tune.printRain ? (
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
          ) : null}
        </div>
      ) : null}

      {hydrated ? (
        <BadgePrintShader
          canvasRef={logoRef}
          config={logoConfig}
          height={printH}
          maxDpr={lowPower ? 1 : 1.5}
          paused={reducedMotion || !shaderLive}
          src={plateSrc}
          width={printW}
        />
      ) : null}

      <div
        className="relative h-760 overflow-x-visible bg-background-base before:inside-border-b before:border-border-default max-lg:h-auto"
        ref={heroRef}
      >
        <HeroGrid
          aria-hidden="true"
          className="pointer-events-none absolute -top-0.5 -right-0.5 -z-10 h-641 w-401 text-border-default max-lg:hidden"
        />

        <div className="absolute inset-0 max-lg:relative max-lg:h-640">
          {hydrated ? (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 z-0 overflow-visible"
              data-share-hide=""
              hidden={shareCapture}
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

          <div className="absolute inset-0 z-1">
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
                  logoMarkSrc={logoMarkSrc}
                  printSrc={plateSrc}
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

        <div className="absolute inset-y-0 left-80 z-20 flex w-520 flex-col justify-center gap-40 max-lg:static max-lg:w-full max-lg:px-24 max-lg:py-64">
          <Scramble
            className="text-decorative-small text-text-faint"
            preset="eyebrow-hero"
            segments={[
              { text: "01 · ", className: "[word-spacing:4.75px]" },
              { text: "BADGE", className: "text-orange-900" },
            ]}
          />

          <div>
            <h1 className="mb-16 text-left text-heading-h1 text-balance text-text-base">
              Your Connect 2026 badge
            </h1>

            <div
              className="flex flex-col gap-24 text-body-large text-text-base max-lg:[&_br]:hidden"
              data-share-hide=""
              hidden={shareCapture}
            >
              <p>
                The case-study stripe shader, printed on the badge from your
                logo. <br />
                Grab it and pull — the lanyard wiggles back.
              </p>
              <p>
                Pick a color scheme — stripes and the logo follow it. Add your
                mark as a JPEG, WebP, PNG, or SVG.
              </p>
              <BadgeCustomizer
                error={logoError}
                fileName={logo?.fileName ?? null}
                logoScale={tune.logoScale}
                onChange={setParams}
                onClear={() => {
                  replaceLogo(null);
                  setLogoError(null);
                }}
                onFile={onLogoFile}
                onPanChange={(sourcePanX, sourcePanY) =>
                  setTune({ ...tune, sourcePanX, sourcePanY })
                }
                onScaleChange={(logoScale) => setTune({ ...tune, logoScale })}
                params={params}
                plateSrc={plateSrc}
                previewSrc={logoPreviewSrc}
                sourcePanX={tune.sourcePanX}
                sourcePanY={tune.sourcePanY}
              />
            </div>
          </div>

          <div
            className="flex gap-12 max-sm:flex-col"
            data-share-hide=""
            hidden={shareCapture}
          >
            <Button
              disabled={sharing}
              onClick={onCopyShareable}
              size="large"
              type="button"
            >
              <CopyFeedbackIcon copied={shareCopied} />
              <span>{shareCopied ? "Copied" : "Copy shareable card"}</span>
            </Button>
            <Button
              disabled={sharing}
              onClick={onShareX}
              size="large"
              type="button"
              variant="secondary"
            >
              <Icon name="x" size={20} />
              <span>Share on X</span>
            </Button>
          </div>
        </div>
      </div>

      <div className="h-80" />
      {sharePreview ? (
        <BadgeShareDock
          copied={shareCopied}
          onDismiss={dismissShare}
          src={sharePreview.src}
          title={sharePreview.title}
        />
      ) : null}
    </div>
  );
}
