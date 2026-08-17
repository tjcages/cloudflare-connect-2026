import cn from "classnames";
import { useEffect, useState } from "react";

import Icon from "@/components/icon/Icon";
import type { IconName } from "@/components/icon/icons.gen";
import { applyTheme, type Theme } from "@/components/theme/theme-transition";

const themes: { value: Theme; icon: IconName; label: string }[] = [
  { value: "system", icon: "imac", label: "System theme" },
  { value: "light", icon: "sun-low", label: "Light theme" },
  { value: "dark", icon: "moon", label: "Dark theme" },
];

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    const sync = () =>
      setTheme((localStorage.getItem("theme") as Theme | null) ?? "system");
    sync();
    requestAnimationFrame(() => setSettled(true));
    window.addEventListener("themechange", sync);
    return () => window.removeEventListener("themechange", sync);
  }, []);

  useEffect(() => {
    if (theme !== "system") return;
    const query = matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, [theme]);

  const index = themes.findIndex(({ value }) => value === theme);

  return (
    <div
      aria-label="Theme"
      className="relative flex h-40 w-120 items-center rounded-full bg-background-faint"
      role="radiogroup"
    >
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute top-0 left-0 size-40 p-1 [view-transition-name:theme-thumb]",
          settled &&
            "transition-transform duration-250 ease-[cubic-bezier(0.6,0.6,0,1)]",
          index === 1 && "translate-x-40",
          index === 2 && "translate-x-80"
        )}
      >
        <span className="block size-full rounded-full bg-background-base shadow-toggle-selected" />
      </span>

      {themes.map(({ value, icon, label }, position) => (
        <button
          aria-checked={value === theme}
          aria-label={label}
          className="relative z-10 flex-center size-40 cursor-pointer p-1"
          key={value}
          onClick={() => {
            setTheme(value);
            localStorage.setItem("theme", value);
            applyTheme(value);
          }}
          role="radio"
          type="button"
        >
          <span
            className={cn(
              "flex-center size-full rounded-full transition-colors duration-250",
              "in-[button:focus-visible]:shadow-button-tertiary-focus",
              value === theme
                ? "text-icon-base"
                : "text-icon-muted hover:text-icon-base"
            )}
            style={{ viewTransitionName: `theme-icon-${position}` }}
          >
            <Icon name={icon} />
          </span>
        </button>
      ))}
    </div>
  );
}
