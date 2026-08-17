import cn from "classnames";
import type { CSSProperties } from "react";
import type { Archetype } from "./archetypes";

const panel =
  "overlay bg-background-base opacity-0 data-active:opacity-100 data-revealing:z-10";

// Every var below is re-rolled by `randomize` in archetypes.ts once a panel is
// swapped in. These are what the panel renders with before that ever runs — on
// the server, and on the first paint of a browser that opens already active.
const defaults = {
  "--browser-accent": "var(--color-dynamic-blue-6)",
  "--browser-chart-bar-1": "9px",
  "--browser-chart-bar-2": "15px",
  "--browser-chart-bar-3": "7px",
  "--browser-chart-bar-4": "18px",
  "--browser-chart-bar-5": "22px",
  "--browser-chart-bar-6": "16px",
  "--browser-chart-bar-7": "11px",
  "--browser-chart-bar-8": "20px",
  "--browser-chart-bar-9": "8px",
  "--browser-chart-bar-10": "14px",
  "--browser-block-width-1": "60px",
  "--browser-block-width-2": "74px",
  "--browser-block-width-3": "54px",
  "--browser-tile-1":
    "color-mix(in oklab, var(--color-darker) 3%, transparent)",
  "--browser-tile-2":
    "color-mix(in oklab, var(--color-darker) 5%, transparent)",
  "--browser-tile-3": "var(--browser-accent)",
  "--browser-tile-4":
    "color-mix(in oklab, var(--color-darker) 5%, transparent)",
  "--browser-tile-5":
    "color-mix(in oklab, var(--color-darker) 3%, transparent)",
  "--browser-tile-6":
    "color-mix(in oklab, var(--color-darker) 5%, transparent)",
} as CSSProperties;

const chartBars = [
  "left-6 h-(--browser-chart-bar-1) bg-darker/5",
  "left-11 h-(--browser-chart-bar-2) bg-darker/5",
  "left-16 h-(--browser-chart-bar-3) bg-darker/5",
  "left-21 h-(--browser-chart-bar-4) bg-(--browser-accent)",
  "left-26 h-(--browser-chart-bar-5) bg-(--browser-accent)",
  "left-31 h-(--browser-chart-bar-6) bg-(--browser-accent)",
  "left-36 h-(--browser-chart-bar-7) bg-darker/5",
  "left-41 h-(--browser-chart-bar-8) bg-darker/5",
  "left-46 h-(--browser-chart-bar-9) bg-darker/5",
  "left-51 h-(--browser-chart-bar-10) bg-darker/5",
];

const tileRows = [
  ["bg-(--browser-tile-1)", "bg-(--browser-tile-2)", "bg-(--browser-tile-3)"],
  ["bg-(--browser-tile-4)", "bg-(--browser-tile-5)", "bg-(--browser-tile-6)"],
];

export default function BrowserContent({ initial }: { initial?: Archetype }) {
  const on = (name: Archetype) => (initial === name ? true : undefined);
  return (
    <>
      <div
        className={panel}
        data-browser-archetype="marketing"
        data-active={on("marketing")}
        style={defaults}
      >
        <div className="absolute top-12 left-12 h-5 w-15 rounded-4 bg-darker/5" />
        <div className="absolute top-13 left-1/2 flex -translate-x-1/2 gap-4">
          <div className="h-3 w-12 rounded-4 bg-darker/3" />
          <div className="h-3 w-16 rounded-4 bg-darker/3" />
          <div className="h-3 w-12 rounded-4 bg-darker/3" />
        </div>
        <div className="absolute top-12 right-12 flex gap-2">
          <div className="h-5 w-12 rounded-4 bg-darker/3" />
          <div className="h-5 w-15 rounded-4 bg-(--browser-accent)" />
        </div>

        <div className="absolute top-30 left-12">
          <div className="h-6 w-(--browser-block-width-1) rounded-4 bg-darker/5" />
          <div className="mt-4 h-6 w-(--browser-block-width-2) rounded-4 bg-darker/5" />
          <div className="mt-8 h-3 w-84 rounded-4 bg-darker/3" />
          <div className="mt-3 h-3 w-76 rounded-4 bg-darker/3" />
        </div>

        <div
          className="absolute top-70 left-12 h-8 w-22 rounded-4 bg-(--browser-accent)"
          data-click-target=""
        />

        <div className="absolute top-30 left-124 h-50 w-56 rounded-4 bg-darker/3" />
      </div>

      <div
        className={panel}
        data-browser-archetype="dashboard"
        data-active={on("dashboard")}
        style={defaults}
      >
        <div className="absolute top-10 right-24 left-10 h-6 rounded-4 bg-darker/2" />
        <div className="absolute top-10 right-10 size-6 rounded-full bg-(--browser-accent)" />

        <div className="absolute top-24 left-10 flex flex-col gap-4">
          <div className="h-4 w-22 rounded-4 bg-darker/2" />
          <div
            className="h-4 w-14 rounded-4 bg-(--browser-accent)"
            data-click-target=""
          />
          <div className="h-4 w-17 rounded-4 bg-darker/2" />
          <div className="h-4 w-12 rounded-4 bg-darker/2" />
        </div>

        <div className="absolute top-24 left-40 h-36 w-66 rounded-4 before:inside-border before:border-darker/2">
          {chartBars.map((bar) => (
            <div
              key={bar}
              className={cn(["absolute bottom-6 w-px rounded-4", bar])}
            />
          ))}
        </div>

        <div className="absolute top-24 left-114 h-36 w-68 rounded-4 before:inside-border before:border-darker/2">
          <div className="absolute top-5 left-1/2 flex-center size-22 -translate-x-1/2 rounded-full bg-(--browser-accent)">
            <div className="size-10 rounded-full bg-background-base" />
          </div>
          <div className="absolute right-6 bottom-5 left-6 h-3 rounded-4 bg-darker/3" />
        </div>

        <div className="absolute top-66 left-40 h-20 w-66 rounded-4 before:inside-border before:border-darker/2">
          <div className="absolute top-5 left-6 h-4 w-20 rounded-4 bg-darker/5" />
          <div className="absolute top-12 left-6 h-3 w-32 rounded-4 bg-darker/3" />
        </div>

        <div className="absolute top-66 left-114 h-20 w-68 rounded-4 before:inside-border before:border-darker/2">
          <div
            className="absolute top-5 left-6 h-4 w-16 rounded-4 bg-(--browser-accent)"
            data-click-target=""
          />
          <div className="absolute top-12 left-6 h-3 w-36 rounded-4 bg-darker/3" />
        </div>
      </div>

      <div
        className={panel}
        data-browser-archetype="article"
        data-active={on("article")}
        style={defaults}
      >
        <div className="absolute top-12 left-12 h-5 w-15 rounded-4 bg-darker/5" />
        <div className="absolute top-13 left-1/2 flex -translate-x-1/2 gap-4">
          <div className="h-3 w-12 rounded-4 bg-darker/3" />
          <div className="h-3 w-16 rounded-4 bg-darker/3" />
          <div className="h-3 w-12 rounded-4 bg-darker/3" />
        </div>
        <div className="absolute top-12 right-12 h-5 w-15 rounded-4 bg-darker/3" />

        <div className="absolute top-28 left-12 h-56 w-px bg-darker/5" />

        <div className="absolute top-28 left-24 h-6 w-(--browser-block-width-2) rounded-4 bg-darker/5" />

        <div className="absolute top-40 left-24 flex flex-col gap-3">
          <div className="h-3 w-(--browser-block-width-1) rounded-4 bg-darker/3" />
          <div className="h-3 w-140 rounded-4 bg-darker/3" />
          <div className="h-3 w-120 rounded-4 bg-darker/3" />
        </div>

        <div
          className="absolute top-60 left-24 h-22 w-140 rounded-4 bg-(--browser-accent)"
          data-click-target=""
        />

        <div className="absolute top-86 left-24 h-3 w-100 rounded-4 bg-darker/3" />
      </div>

      <div
        className={panel}
        data-browser-archetype="media"
        data-active={on("media")}
        style={defaults}
      >
        <div className="absolute top-12 left-12 h-5 w-15 rounded-4 bg-darker/5" />
        <div className="absolute top-13 left-1/2 flex -translate-x-1/2 gap-4">
          <div className="h-3 w-12 rounded-4 bg-darker/3" />
          <div className="h-3 w-16 rounded-4 bg-darker/3" />
        </div>
        <div className="absolute top-12 right-12 flex gap-2">
          <div className="h-5 w-12 rounded-4 bg-darker/3" />
          <div className="size-5 rounded-full bg-(--browser-accent)" />
        </div>

        {tileRows.map((tiles, rowIndex) => (
          <div
            key={rowIndex}
            className={cn([
              "absolute left-12 flex gap-6",
              rowIndex === 0 ? "top-28" : "top-60",
            ])}
          >
            {tiles.map((tile) => (
              <div
                key={tile}
                className={cn(["h-26 w-52 rounded-4", tile])}
                data-click-target=""
              />
            ))}
          </div>
        ))}
      </div>
    </>
  );
}
