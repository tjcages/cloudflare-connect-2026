import cn from "classnames";
import type { BadgeParams } from "./badge-params";
import { BADGE_THEMES } from "./badge-themes";

export default function BadgeCustomizer({
  params,
  onChange,
}: {
  params: BadgeParams;
  onChange: (next: BadgeParams) => void;
}) {
  return (
    <div
      aria-label="Color"
      className="grid grid-cols-3 gap-12"
      role="radiogroup"
    >
      {BADGE_THEMES.map((theme) => {
        const selected = params.theme === theme.id;
        return (
          <button
            aria-checked={selected}
            aria-label={theme.label}
            className={cn(
              "flex size-48 items-center justify-center rounded-full transition-transform",
              selected
                ? "shadow-[inset_0_0_0_2px_var(--color-orange-900)]"
                : "hover:scale-105"
            )}
            key={theme.id}
            onClick={() => onChange({ ...params, theme: theme.id })}
            role="radio"
            type="button"
          >
            <span
              className="size-32 rounded-full"
              style={{
                background: `linear-gradient(135deg, ${theme.accent} 0%, ${theme.pair} 55%, ${theme.deep} 100%)`,
              }}
            />
          </button>
        );
      })}
    </div>
  );
}
