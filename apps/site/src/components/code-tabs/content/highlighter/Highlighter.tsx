import cn from "classnames";
import { AnimatePresence, motion, usePresence } from "motion/react";
import {
  type CSSProperties,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  CopyFeedbackIcon,
  useCopyFeedback,
} from "@/components/copy-feedback/CopyFeedback";
import GridArea from "@/components/GridArea";
import ScrollArea from "@/components/ScrollArea";
import { scrambleChars } from "@/components/scramble/chars";
import { rainLayer } from "@/components/scramble/rain";
import { useRainLayerStack } from "@/components/scramble/use-rain-layer-stack";
import { isTerminalLanguage } from "../data";
import HtmlIcon from "./_svg/HtmlIcon.svg?react";
import JsIcon from "./_svg/JsIcon.svg?react";
import PyIcon from "./_svg/PyIcon.svg?react";
import TsIcon from "./_svg/TsIcon.svg?react";
import "./Highlighter.css";

type IconTransition = "file" | "from-terminal" | "to-terminal";

const FILE_ICON_VARIANTS = {
  initial: (transition: IconTransition) => ({
    filter: "blur(3px)",
    opacity: 0,
    x: transition === "from-terminal" ? -8 : 0,
  }),
  animate: { filter: "blur(0px)", opacity: 1, x: 0 },
  exit: (transition: IconTransition) => ({
    filter: "blur(3px)",
    opacity: 0,
    x: transition === "to-terminal" ? 8 : 0,
  }),
};

const FILE_META: Record<
  string,
  { name: string; icon?: typeof TsIcon; iconKey?: string }
> = {
  typescript: { name: "index.ts", icon: TsIcon, iconKey: "typescript" },
  tsx: { name: "index.tsx", icon: TsIcon, iconKey: "typescript" },
  javascript: { name: "index.js", icon: JsIcon, iconKey: "javascript" },
  jsx: { name: "index.jsx", icon: JsIcon, iconKey: "javascript" },
  python: { name: "main.py", icon: PyIcon, iconKey: "python" },
  html: { name: "index.html", icon: HtmlIcon, iconKey: "html" },
  json: { name: "data.json" },
};

function ChromeLabel({
  animateIn,
  children,
  className,
}: {
  animateIn: boolean;
  children: ReactNode;
  className?: string;
}) {
  const [isPresent, safeToRemove] = usePresence();
  const ref = useRef<HTMLSpanElement>(null);
  const animateInRef = useRef(animateIn);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (isPresent) {
      if (!animateInRef.current) return;
      return scrambleChars(el, "cipher", undefined, { duration: 450 });
    }

    return scrambleChars(el, "cipher", undefined, {
      conceal: true,
      duration: 450,
      onComplete: safeToRemove,
    });
  }, [isPresent, safeToRemove]);

  return (
    <span className={className} ref={ref}>
      {children}
    </span>
  );
}

function MorphLabel({ className, text }: { className?: string; text: string }) {
  const labelRef = useRef<HTMLSpanElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const shown = useRef(text);
  const [width, setWidth] = useState<number>();

  useLayoutEffect(() => {
    const el = labelRef.current;
    const measure = measureRef.current;
    if (!el || !measure) return;

    setWidth(measure.getBoundingClientRect().width);
    if (shown.current === text) return;

    const morphFrom = shown.current;
    shown.current = text;
    // Own the target text outright — a superseded run's restore may have put
    // the previous label back into the DOM after React committed this one.
    el.textContent = text;
    return scrambleChars(el, "cipher", undefined, { duration: 450, morphFrom });
  }, [text]);

  return (
    <motion.span
      animate={width === undefined ? undefined : { width }}
      className={cn("relative inline-flex shrink-0", className)}
      initial={false}
      transition={{ width: { duration: 0.45, ease: [0.6, 0.6, 0, 1] } }}
    >
      <span className="whitespace-pre" ref={labelRef}>
        {text}
      </span>
      <span
        aria-hidden="true"
        className="invisible absolute whitespace-pre"
        ref={measureRef}
      >
        {text}
      </span>
    </motion.span>
  );
}

export default function CodeTabsContentHighlighter({
  className,
  code,
  html,
  language,
  terminalLabel,
  fileName,
  direction = 1,
}: {
  className?: string;
  language: string;
  code: string;
  html: string;
  terminalLabel?: string;
  fileName?: string;
  direction?: number;
}) {
  const terminal = isTerminalLanguage(language);
  const meta = FILE_META[language];
  const FileIcon = meta?.icon;
  const fileLabel = (fileName ?? meta?.name ?? "file").toUpperCase();
  const { copied, copy } = useCopyFeedback(code);
  const hydrated = useRef(false);
  const previousTerminal = useRef(terminal);
  const iconTransition: IconTransition =
    previousTerminal.current === terminal
      ? "file"
      : terminal
        ? "to-terminal"
        : "from-terminal";

  useEffect(() => {
    hydrated.current = true;
  }, []);

  useLayoutEffect(() => {
    previousTerminal.current = terminal;
  }, [terminal]);

  return (
    <div
      className={cn(
        "relative flex-center h-full min-w-0 shrink grow basis-560 p-40 max-lg:basis-auto max-lg:p-16",
        className
      )}
    >
      <GridArea className="overlay bg-background-surface" />

      <div
        className="z-10 h-400 w-full bg-(--code-card-background) text-text-base shadow-elevation-default [transition:--code-card-background_450ms_cubic-bezier(0.6,0.6,0,1),--code-card-border_450ms_cubic-bezier(0.6,0.6,0,1)]"
        style={
          {
            "--code-card-background": terminal
              ? "var(--color-background-terminal)"
              : "var(--color-background-base)",
            "--code-card-border": terminal
              ? "color-mix(in srgb, #ffffff 4%, var(--color-background-terminal))"
              : "var(--color-border-default)",
          } as CSSProperties
        }
      >
        <div className="relative z-10 flex h-40 items-center pl-12 before:inside-border-b before:border-(--code-card-border) before:[transition:none]">
          <div className="flex gap-6 p-5">
            <span className="size-6 rounded-full bg-orange-900" />
            <span className="size-6 rounded-full bg-orange-800" />
            <span className="size-6 rounded-full bg-green-900" />
          </div>

          <div className="relative flex h-40 flex-1 items-center">
            <AnimatePresence initial={false}>
              {terminal && (
                <div
                  className="absolute inset-y-0 right-16 flex items-center text-decorative-small text-text-loud uppercase"
                  key="terminal-label"
                >
                  <ChromeLabel animateIn={hydrated.current}>
                    {terminalLabel ?? language}
                  </ChromeLabel>
                </div>
              )}
            </AnimatePresence>
          </div>

          <div
            className={cn(
              "pointer-events-none absolute inset-0 flex items-center text-decorative-small",
              // 68px matches where the dots + a 16px rest leave the bare label.
              terminal ? "pl-68" : "justify-center"
            )}
          >
            <motion.div
              className="relative flex items-center gap-12"
              layout="position"
              transition={{
                layout: { duration: 0.45, ease: [0.6, 0.6, 0, 1] },
              }}
            >
              <AnimatePresence
                custom={iconTransition}
                initial={false}
                mode="popLayout"
              >
                {!terminal && FileIcon && (
                  <motion.span
                    animate="animate"
                    className="flex-center"
                    custom={iconTransition}
                    exit="exit"
                    initial="initial"
                    key={meta.iconKey}
                    transition={{
                      duration: 0.25,
                      ease: [0.6, 0.6, 0, 1],
                    }}
                    variants={FILE_ICON_VARIANTS}
                  >
                    <FileIcon />
                  </motion.span>
                )}
              </AnimatePresence>

              <MorphLabel
                className="text-text-default transition-colors duration-450 ease-[cubic-bezier(0.6,0.6,0,1)]"
                text={terminal ? "TERMINAL" : fileLabel}
              />
            </motion.div>
          </div>

          <div className="relative size-40 before:inside-border-l before:border-(--code-card-border) before:[transition:none]">
            <button
              aria-label={copied ? "Copied" : "Copy code"}
              className={cn(
                "absolute top-0 left-0 size-40 cursor-pointer transition-colors duration-450 ease-[cubic-bezier(0.6,0.6,0,1)]",
                terminal ? "text-icon-inverse" : "text-orange-900"
              )}
              onClick={copy}
              type="button"
            >
              <CopyFeedbackIcon
                className="overlay flex-center"
                copied={copied}
              />
            </button>
          </div>
        </div>

        <InlineHighlighter
          code={code}
          direction={direction}
          html={html}
          terminal={terminal}
        />
      </div>
    </div>
  );
}

export function InlineHighlighter({
  code,
  html,
  className,
  direction = 1,
  terminal = false,
}: {
  code: string;
  html: string;
  className?: string;
  direction?: number;
  terminal?: boolean;
}) {
  const { displayed, pendingCount, transition } = useRainLayerStack(
    { code, html },
    html
  );
  const stackRef = useRef<HTMLDivElement>(null);
  const numbersRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    viewportRef.current?.scrollTo({ top: 0, left: 0, behavior: "smooth" });

    const stack = stackRef.current;
    if (!stack || !numbersRef.current) return;

    const incomingLayerRef: { current: HTMLElement | null } = {
      current: null,
    };

    const handle = transition({
      key: html,
      value: { code, html },
      createLayer: () => {
        const layer = document.createElement("div");
        layer.className = "absolute top-0 left-0 whitespace-pre";
        stack.appendChild(layer);
        incomingLayerRef.current = layer;
        return layer;
      },
      start: ({ layer, onComplete, under }) =>
        rainLayer({
          layerEl: layer,
          numbersEl: numbersRef.current ?? undefined,
          underHtml: under.html,
          toHtml: html,
          direction,
          background: "var(--code-card-background)",
          onComplete,
        }),
    });

    if (handle) {
      const lineHeight = Number.parseFloat(getComputedStyle(stack).lineHeight);
      stack.style.minHeight = `${handle.rows * lineHeight}px`;

      const incomingWidth = incomingLayerRef.current?.scrollWidth ?? 0;
      if (incomingWidth > 0) {
        stack.style.minWidth = `${incomingWidth}px`;
      }
    }
  }, [code, html, direction, transition]);

  useEffect(() => {
    if (pendingCount === 0 && stackRef.current) {
      stackRef.current.style.minHeight = "";
      stackRef.current.style.minWidth = "";
    }
  }, [pendingCount]);

  const lineCount = displayed.code.split("\n").length;

  return (
    // No background here: the card's dark elevation ring is an inset shadow,
    // and an opaque child would cover it along the body edges.
    <div className="relative">
      <ScrollArea horizontal className="z-10 h-360" viewportRef={viewportRef}>
        <div className={cn(className, "flex gap-32 py-16 pr-32")}>
          <div
            className={cn(
              "sticky left-0 z-10 flex w-36 shrink-0 flex-col bg-(--code-card-background) pl-16 text-right text-code-default [transition:color_450ms_cubic-bezier(0.6,0.6,0,1)] after:pointer-events-none after:absolute after:inset-y-0 after:left-full after:w-32 after:bg-linear-to-r after:from-(--code-card-background) after:from-50% after:to-(--code-card-background)/0",
              terminal ? "text-text-loud" : "text-text-subtle"
            )}
            key={displayed.code}
            ref={numbersRef}
          >
            {Array.from({ length: lineCount }, (_, i) => (
              <span key={i}>{i + 1}</span>
            ))}
          </div>
          <div className="relative min-w-0 text-code-default" ref={stackRef}>
            <div
              className="whitespace-pre"
              dangerouslySetInnerHTML={{ __html: displayed.html }}
            />
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
