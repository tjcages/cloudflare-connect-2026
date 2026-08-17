import {
  SYNTAX_TONES,
  type SyntaxTone,
} from "@/components/_animations/container-stream/tones";
import Icon from "@/components/icon/Icon";
import cn from "classnames";
import {
  Fragment,
  type ComponentPropsWithoutRef,
  type CSSProperties,
  type ReactNode,
  type Ref,
} from "react";
import AgentCursor from "./_svg/agent-cursor.svg?react";
import AppChart from "./_svg/AppChart.svg?react";
import AppLines from "./_svg/AppLines.svg?react";
import statusDots from "./_svg/status-dots.svg?url";
import type { BrowserGridVariant, BrowserVariant } from "./types";

export type BrowserProps = Omit<
  ComponentPropsWithoutRef<"div">,
  "className"
> & {
  variant?: BrowserVariant;
  reveal?: boolean;
  link?: boolean;
  /** Collapses the address icon without changing the variant. */
  loading?: boolean;
  className?: string | string[] | null;
  viewport?: ReactNode;
  ref?: Ref<HTMLDivElement>;
  "data-active"?: boolean;
};

const lights = [
  "group-data-active/browser:bg-red-900",
  "group-data-active/browser:bg-orange-800 group-data-active/browser:delay-60 group-data-active/browser:before:delay-60",
  "group-data-active/browser:bg-green-900 group-data-active/browser:delay-120 group-data-active/browser:before:delay-120",
];

const addressLabels: Partial<Record<BrowserVariant, string>> = {
  syntax: "Container",
  sandbox: "Sandbox",
  "sandbox-2": "Sandbox",
  stream: "Sandbox",
};

const appBars = [
  "left-6 h-15 bg-darker/5",
  "left-11 h-21 bg-darker/5",
  "left-16 h-7 bg-darker/5",
  "left-21 h-12 bg-(--color-dynamic-purple-6)",
  "left-26 h-17 bg-(--color-dynamic-purple-6)",
  "left-31 h-12 bg-(--color-dynamic-purple-6)",
  "left-36 h-8 bg-darker/5",
  "left-41 h-20 bg-darker/5",
  "left-46 h-9 bg-darker/5",
  "left-51 h-17 bg-darker/5",
];

const gridLines: Record<BrowserGridVariant, readonly string[]> = {
  "grid-1": ["left-96 group-data-active/browser:delay-200"],
  "grid-2": [
    "left-48 group-data-active/browser:delay-200",
    "left-144 group-data-active/browser:delay-260",
  ],
  "grid-3": [
    "left-48 group-data-active/browser:delay-200",
    "left-96 group-data-active/browser:delay-260",
    "left-144 group-data-active/browser:delay-320",
  ],
  "grid-dots": [],
};

const gridHorizontalDelay: Record<BrowserGridVariant, string> = {
  "grid-1": "group-data-active/browser:delay-260",
  "grid-2": "group-data-active/browser:delay-320",
  "grid-3": "group-data-active/browser:delay-380",
  "grid-dots": "",
};

const SEGMENT_POOL = 8;

// Figma splits the Sandbox window down the middle: code on the left of the rule
// at 96, and the container's own tiles on the right of it.
const sandboxTiles = [
  "top-12 left-107 bg-(--color-dynamic-blue-7) before:inner-border before:border-(--color-dynamic-blue-5) before:[transition:none]",
  "top-12 left-147 bg-darker/2",
  "top-52 left-107 bg-darker/2",
  "top-52 left-147 bg-darker/5",
];

const syntaxRows: {
  position: string;
  segments: { width: string; tone: SyntaxTone }[];
}[] = [
  {
    position: "top-15",
    segments: [
      { width: "w-11", tone: "purple" },
      { width: "w-6", tone: "neutral" },
      { width: "w-9", tone: "neutral" },
      { width: "w-4", tone: "neutral" },
      { width: "w-12", tone: "neutral" },
      { width: "w-9", tone: "orange" },
      { width: "w-9", tone: "neutral" },
    ],
  },
  {
    position: "top-24",
    segments: [
      { width: "w-9", tone: "neutral" },
      { width: "w-10", tone: "neutral" },
      { width: "w-5", tone: "neutral" },
      { width: "w-8", tone: "purple" },
      { width: "w-11", tone: "neutral" },
      { width: "w-6", tone: "neutral" },
      { width: "w-4", tone: "neutral" },
      { width: "w-15", tone: "blue" },
    ],
  },
  {
    position: "top-33",
    segments: [
      { width: "w-8", tone: "neutral" },
      { width: "w-12", tone: "orange" },
      { width: "w-3", tone: "neutral" },
      { width: "w-3", tone: "neutral" },
      { width: "w-8", tone: "neutral" },
      { width: "w-6", tone: "blue" },
    ],
  },
  {
    position: "top-51",
    segments: [
      { width: "w-15", tone: "orange" },
      { width: "w-14", tone: "neutral" },
      { width: "w-15", tone: "purple" },
      { width: "w-6", tone: "neutral" },
      { width: "w-11", tone: "neutral" },
      { width: "w-14", tone: "neutral" },
      { width: "w-13", tone: "purple" },
    ],
  },
  {
    position: "top-60",
    segments: [
      { width: "w-4", tone: "neutral" },
      { width: "w-8", tone: "neutral" },
      { width: "w-12", tone: "blue" },
      { width: "w-5", tone: "neutral" },
      { width: "w-6", tone: "neutral" },
      { width: "w-11", tone: "orange" },
      { width: "w-5", tone: "neutral" },
    ],
  },
  {
    position: "top-69",
    segments: [
      { width: "w-13", tone: "purple" },
      { width: "w-14", tone: "neutral" },
      { width: "w-7", tone: "neutral" },
      { width: "w-3", tone: "neutral" },
      { width: "w-9", tone: "neutral" },
      { width: "w-8", tone: "blue" },
    ],
  },
  {
    position: "top-78",
    segments: [
      { width: "w-11", tone: "neutral" },
      { width: "w-15", tone: "neutral" },
      { width: "w-7", tone: "blue" },
      { width: "w-4", tone: "neutral" },
      { width: "w-14", tone: "purple" },
    ],
  },
];

// The Sandbox window gives the code only the left 96, so it carries its own
// shorter rows rather than the full-width set clipped. Widths are Figma's, row
// for row; shuffleCode keeps every later window inside the same room.
const sandboxRows: typeof syntaxRows = [
  {
    position: "top-15",
    segments: [
      { width: "w-11", tone: "purple" },
      { width: "w-6", tone: "neutral" },
      { width: "w-9", tone: "neutral" },
      { width: "w-4", tone: "orange" },
    ],
  },
  {
    position: "top-24",
    segments: [
      { width: "w-9", tone: "neutral" },
      { width: "w-10", tone: "neutral" },
      { width: "w-5", tone: "blue" },
      { width: "w-8", tone: "neutral" },
      { width: "w-11", tone: "purple" },
      { width: "w-6", tone: "neutral" },
    ],
  },
  {
    position: "top-33",
    segments: [
      { width: "w-8", tone: "neutral" },
      { width: "w-12", tone: "orange" },
      { width: "w-3", tone: "neutral" },
      { width: "w-3", tone: "neutral" },
    ],
  },
  {
    position: "top-51",
    segments: [
      { width: "w-15", tone: "orange" },
      { width: "w-14", tone: "neutral" },
      { width: "w-6", tone: "purple" },
    ],
  },
  {
    position: "top-60",
    segments: [
      { width: "w-4", tone: "neutral" },
      { width: "w-8", tone: "blue" },
      { width: "w-12", tone: "neutral" },
      { width: "w-5", tone: "neutral" },
      { width: "w-11", tone: "purple" },
    ],
  },
  {
    position: "top-69",
    segments: [
      { width: "w-13", tone: "neutral" },
      { width: "w-7", tone: "neutral" },
      { width: "w-9", tone: "blue" },
    ],
  },
  {
    position: "top-78",
    segments: [
      { width: "w-11", tone: "neutral" },
      { width: "w-15", tone: "neutral" },
      { width: "w-7", tone: "neutral" },
      { width: "w-14", tone: "neutral" },
    ],
  },
];

const sandbox2Rows: { position: string; widths: string[] }[] = [
  { position: "top-15", widths: ["w-11", "w-6", "w-9", "w-4"] },
  { position: "top-24", widths: ["w-9", "w-10", "w-5", "w-8", "w-11", "w-6"] },
  { position: "top-33", widths: ["w-8", "w-12", "w-3", "w-3"] },
  { position: "top-51", widths: ["w-15", "w-14", "w-6"] },
  { position: "top-60", widths: ["w-4", "w-8", "w-12", "w-5", "w-11"] },
  { position: "top-69", widths: ["w-13", "w-7", "w-9"] },
  { position: "top-78", widths: ["w-11", "w-15", "w-7", "w-14"] },
];

export default function Browser({
  variant = "grid-1",
  reveal = true,
  link = true,
  loading = true,
  className,
  viewport,
  children,
  ref,
  "data-active": dataActive,
  ...attributes
}: BrowserProps) {
  const isSandbox = variant === "sandbox";
  const isSandbox2 = variant === "sandbox-2";
  const isStream = variant === "stream";
  const isSyntax = variant === "syntax" || isSandbox;
  const monoAddress = isSyntax || isSandbox2 || isStream;
  const specialAddress =
    variant === "site-3" || variant === "agent" || monoAddress;
  const loaderAddress = variant === "site-3" || monoAddress;
  const codeRows = isSandbox ? sandboxRows : syntaxRows;
  const isLineGrid =
    variant === "grid-1" || variant === "grid-2" || variant === "grid-3";

  return (
    <div
      {...attributes}
      ref={ref}
      className={cn([
        className,
        "group/browser relative shrink-0 overflow-clip bg-background-surface shadow-elevation-faint transition-all duration-450 ease-[cubic-bezier(0.6,0.6,0,1)]",
        "data-active:z-20 data-active:bg-background-base data-active:shadow-elevation-default",
      ])}
      data-active={reveal ? true : dataActive}
      data-browser-variant={variant}
    >
      <div className="absolute inset-x-8 top-8 flex h-16 items-center justify-between">
        <div className="relative h-16 w-40 shrink-0">
          <div className="absolute top-5 left-5 flex gap-6">
            {lights.map((light) => (
              <div
                key={light}
                className={cn([
                  "relative size-6 rounded-full transition-colors duration-450 ease-[cubic-bezier(0.6,0.6,0,1)] before:inside-border before:border-border-default before:duration-450 before:ease-[cubic-bezier(0.6,0.6,0,1)] group-data-active/browser:before:border-transparent",
                  light,
                ])}
              />
            ))}
          </div>
        </div>

        {link ? (
          <div
            className={cn([
              "relative flex h-16 shrink-0 items-center justify-center rounded-full bg-background-surface px-12 text-text-faint transition-all duration-450 ease-[cubic-bezier(0.6,0.6,0,1)] before:inner-border before:border-border-muted",
              "group-data-active/browser:text-text-subtle group-data-active/browser:delay-180",
              monoAddress
                ? "text-decorative-chip uppercase"
                : "text-label-chip",
              specialAddress &&
                "group-data-active/browser:pr-4 group-data-active/browser:pl-2",
            ])}
          >
            {specialAddress && (
              <div
                className={cn([
                  "relative h-16 w-0 shrink-0 opacity-0 transition-all duration-450 ease-[cubic-bezier(0.6,0.6,0,1)]",
                  loading &&
                    "group-data-active/browser:w-16 group-data-active/browser:opacity-100",
                  "after:inner-border-r after:border-border-muted",
                ])}
                data-browser-loader={loaderAddress ? "" : undefined}
              >
                <div className="overlay flex-center overflow-clip">
                  {loaderAddress ? (
                    <Icon
                      name="loader"
                      size={12}
                      className="animate-spin text-icon-faint [animation-duration:0.7s] [animation-timing-function:steps(8)] [&_path]:stroke-[1.667]"
                    />
                  ) : (
                    <AgentCursor
                      width="16"
                      height="16"
                      className="text-icon-faint"
                    />
                  )}
                </div>
              </div>
            )}

            <span
              className={cn([
                "relative whitespace-nowrap transition-[padding] duration-450 ease-[cubic-bezier(0.6,0.6,0,1)]",
                specialAddress && "group-data-active/browser:px-6",
              ])}
            >
              {" "}
              {addressLabels[variant] ?? "www"}{" "}
            </span>
          </div>
        ) : (
          <div />
        )}

        <div className="relative h-16 w-40 shrink-0">
          {variant === "grid-dots" && (
            <img
              className="opacity-0 transition-opacity duration-450 ease-[cubic-bezier(0.6,0.6,0,1)] group-data-active/browser:opacity-100 group-data-active/browser:delay-180"
              src={statusDots}
              width="40"
              height="16"
              alt=""
            />
          )}
        </div>
      </div>

      <div className="absolute top-32 right-8 bottom-8 left-8 bg-background-surface transition-colors duration-450 ease-[cubic-bezier(0.6,0.6,0,1)] group-data-active/browser:bg-background-base before:outside-border before:z-20 before:border-border-muted">
        <div className="overlay overflow-clip opacity-0 transition-opacity duration-450 ease-[cubic-bezier(0.6,0.6,0,1)] group-data-active/browser:opacity-100 group-data-active/browser:delay-150">
          {isLineGrid && (
            <>
              {gridLines[variant].map((line) => (
                <div
                  key={line}
                  className={cn([
                    "absolute inset-y-0 w-px origin-top scale-y-0 bg-border-muted transition-transform duration-450 ease-[cubic-bezier(0.6,0.6,0,1)] group-data-active/browser:scale-y-100",
                    line,
                  ])}
                />
              ))}
              <div
                className={cn([
                  "absolute inset-x-0 top-48 h-px origin-left scale-x-0 bg-border-muted transition-transform duration-450 ease-[cubic-bezier(0.6,0.6,0,1)] group-data-active/browser:scale-x-100",
                  gridHorizontalDelay[variant],
                ])}
              />
            </>
          )}

          {variant === "grid-dots" && (
            <div className="overlay bg-[radial-gradient(circle,color-mix(in_oklab,var(--color-darker)_16%,transparent)_0.75px,transparent_0.75px)] bg-size-[18px_18px] bg-position-[6px_6px]" />
          )}

          {(variant === "site-1" || variant === "agent") && (
            <>
              <div className="absolute top-12 left-12 h-5 w-15 rounded-4 bg-darker/5" />
              <div className="absolute top-13 left-1/2 flex -translate-x-1/2 gap-4">
                <div className="h-3 w-12 rounded-4 bg-darker/3" />
                <div className="h-3 w-16 rounded-4 bg-darker/3" />
                <div className="h-3 w-12 rounded-4 bg-darker/3" />
              </div>
              <div className="absolute top-12 right-12 flex gap-2">
                <div className="h-5 w-12 rounded-4 bg-darker/3" />
                <div className="h-5 w-15 rounded-4 bg-darker/3" />
              </div>
              <div className="absolute top-32 left-1/2 flex -translate-x-1/2 flex-col items-center">
                <div className="h-6 w-60 rounded-4 bg-darker/5" />
                <div className="mt-4 h-6 w-80 rounded-4 bg-darker/5" />
                <div className="mt-8 h-3 w-58 rounded-4 bg-darker/3" />
                <div className="mt-3 h-3 w-64 rounded-4 bg-darker/3" />
                <div className="mt-9 h-8 w-22 rounded-4 bg-darker/5" />
              </div>
            </>
          )}

          {variant === "site-2" && (
            <>
              <div className="absolute top-12 left-12 h-5 w-15 rounded-4 bg-darker/5" />
              <div className="absolute top-12 right-12 flex gap-2">
                <div className="h-5 w-12 rounded-4 bg-darker/3" />
                <div className="h-5 w-15 rounded-4 bg-darker/3" />
              </div>
              <div className="absolute top-13 left-1/2 flex -translate-x-1/2 gap-4">
                <div className="h-3 w-12 rounded-4 bg-darker/3" />
                <div className="h-3 w-16 rounded-4 bg-darker/3" />
                <div className="h-3 w-12 rounded-4 bg-darker/3" />
              </div>
              <div className="absolute top-32 left-20">
                <div className="h-6 w-42 rounded-4 bg-darker/5" />
                <div className="mt-4 h-6 w-52 rounded-4 bg-darker/5" />
                <div className="mt-8 h-3 w-58 rounded-4 bg-darker/3" />
                <div className="mt-3 h-3 w-64 rounded-4 bg-darker/3" />
                <div className="mt-9 h-8 w-22 rounded-4 bg-darker/5" />
              </div>
              <div className="absolute top-32 right-58 h-20 w-20 rounded-4 bg-(--color-dynamic-blue-6)" />
              <div className="absolute top-62 right-58 size-20 rounded-full bg-(--color-dynamic-green-6)" />
              <div className="absolute top-32 right-20 h-50 w-28 rounded-4 bg-(--color-dynamic-purple-6)" />
            </>
          )}

          {variant === "site-3" && (
            <>
              <div className="absolute top-12 left-12 h-5 w-15 rounded-4 bg-darker/5" />
              <div className="absolute top-12 right-12 flex gap-2">
                <div className="h-5 w-12 rounded-4 bg-darker/3" />
                <div className="h-5 w-15 rounded-4 bg-darker/3" />
              </div>
              <div className="absolute top-13 left-1/2 flex -translate-x-1/2 gap-4">
                <div className="h-3 w-12 rounded-4 bg-darker/3" />
                <div className="h-3 w-16 rounded-4 bg-darker/3" />
                <div className="h-3 w-12 rounded-4 bg-darker/3" />
              </div>
              <div className="absolute top-30 left-20 h-6 w-40 rounded-4 bg-darker/5" />
              <div className="absolute top-40 left-20 h-6 w-57 rounded-4 bg-darker/5 opacity-20" />
              <div className="absolute top-31 right-27 h-3 w-51 rounded-4 bg-darker/3" />
              <div className="absolute top-37 right-20 h-3 w-58 rounded-4 bg-darker/3 opacity-20" />
              <div className="absolute top-48 right-56 h-8 w-22 rounded-4 bg-darker/5 opacity-20" />
              <div className="absolute top-66 left-20 h-49 w-152 rounded-6 bg-darker/2 opacity-20" />
            </>
          )}

          {variant === "app" && (
            <>
              <div className="absolute top-12 right-26 left-12 h-8 rounded-4 bg-darker/2" />
              <div className="absolute top-12 right-12 size-8 rounded-full bg-darker/3" />
              <div className="absolute top-30 left-12 h-6 w-24 rounded-4 bg-darker/2" />
              <div className="absolute top-39 left-12 h-6 w-17 rounded-4 bg-darker/5" />
              <div className="absolute top-48 left-12 h-6 w-20 rounded-4 bg-darker/2" />
              <div className="absolute bottom-12 left-12 size-6 rounded-4 bg-darker/2" />

              <div className="absolute top-30 right-80 h-32 w-60 rounded-4 before:inside-border before:border-darker/2">
                {appBars.map((bar) => (
                  <div
                    key={bar}
                    className={cn(["absolute bottom-5 w-px rounded-4", bar])}
                  />
                ))}
              </div>
              <div className="absolute top-30 right-12 h-32 w-60 rounded-4 before:inside-border before:border-darker/2">
                <AppChart className="absolute top-6 left-6 h-15 w-48 text-(--color-dynamic-blue-6)" />
                <AppLines className="absolute top-21 left-6 h-5 w-48 text-darker/7" />
              </div>
              <div className="absolute top-68 right-80 h-32 w-60 rounded-4 before:inside-border before:border-darker/2">
                <div className="absolute top-13 left-22 h-6 w-17 rounded-4 bg-darker/5" />
              </div>
              <div className="absolute top-68 right-12 h-32 w-60 rounded-4 before:inside-border before:border-darker/2" />
            </>
          )}

          {isSandbox2 && (
            <>
              <div
                className="absolute inset-y-0 left-0 w-96"
                data-sandbox-lines=""
              >
                {sandbox2Rows.map(({ position, widths }) => (
                  <div
                    key={position}
                    className={cn(["absolute left-15 flex gap-3", position])}
                  >
                    {widths.map((width, index) => (
                      <div
                        key={index}
                        className={cn([
                          "h-3 shrink-0 rounded-4 bg-darker/7",
                          width,
                        ])}
                        data-sandbox-bar=""
                      />
                    ))}
                  </div>
                ))}
              </div>

              <div className="absolute inset-y-0 right-0 w-96 before:inner-border-l before:border-border-default">
                <div
                  className="absolute inset-x-12 top-12"
                  data-sandbox-panel=""
                >
                  <div
                    className="h-7 w-72 rounded-4 bg-darker/2"
                    data-sandbox-bar=""
                  />
                  <div className="mt-11 flex gap-6">
                    <div
                      className="h-24 w-41 rounded-4 bg-darker/2"
                      data-sandbox-bar=""
                    />
                    <div
                      className="relative h-24 w-25 rounded-4 bg-(--color-dynamic-purple-7) before:inside-border before:border-(--color-dynamic-purple-5)"
                      data-sandbox-accent=""
                      data-sandbox-bar=""
                    />
                  </div>
                  <div
                    className="mt-6 h-24 w-72 rounded-4 bg-darker/2"
                    data-sandbox-bar=""
                  />
                </div>
              </div>
            </>
          )}

          {/* This wrapper is the offsetParent shuffleCode measures to decide how
              wide a row may be. On the Sandbox window its 96 is what keeps the
              code out of the tile panel; delete it and the rows silently run
              under the tiles. */}
          {isSyntax && (
            <div
              className={cn([
                "absolute inset-y-0 left-0",
                isSandbox ? "w-96" : "right-0",
              ])}
            >
              {codeRows.map(({ position, segments }, row) => (
                <Fragment key={position}>
                  {!isSandbox && (
                    <div
                      className={cn([
                        "absolute left-15 size-3 rounded-full bg-darker/7 opacity-20",
                        position,
                      ])}
                      data-syntax-dot={row}
                    />
                  )}
                  <div
                    className={cn([
                      "absolute flex gap-3",
                      isSandbox ? "left-15" : "left-26",
                      position,
                    ])}
                    data-syntax-row={row}
                  >
                    {Array.from({ length: SEGMENT_POOL }, (_, index) => {
                      const segment = segments[index];
                      const { width, tone } = segment ?? {
                        width: "w-8",
                        tone: "neutral" as const,
                      };
                      return (
                        <div
                          key={index}
                          className={cn([
                            "h-3 shrink-0 rounded-4 bg-(--syntax-tone) opacity-20",
                            width,
                          ])}
                          data-syntax-segment=""
                          data-syntax-tone={tone}
                          hidden={segment === undefined}
                          style={
                            {
                              "--syntax-tone": SYNTAX_TONES[tone],
                            } as CSSProperties
                          }
                        />
                      );
                    })}
                  </div>
                </Fragment>
              ))}
            </div>
          )}

          {isSandbox && (
            <>
              <div className="absolute inset-y-0 left-96 w-px origin-top scale-y-0 bg-border-default transition-transform duration-450 ease-[cubic-bezier(0.6,0.6,0,1)] group-data-active/browser:scale-y-100 group-data-active/browser:delay-200" />

              {sandboxTiles.map((tile, index) => (
                <div
                  key={tile}
                  className={cn([
                    "absolute size-32 translate-y-4 rounded-4 opacity-0 transition-[opacity,translate] duration-450 ease-[cubic-bezier(0.6,0.6,0,1)] data-lit:translate-y-0 data-lit:opacity-100",
                    tile,
                  ])}
                  data-sandbox-tile={index}
                />
              ))}
            </>
          )}
        </div>

        <div className="overlay overflow-clip">{viewport}</div>
      </div>

      {children}
    </div>
  );
}
