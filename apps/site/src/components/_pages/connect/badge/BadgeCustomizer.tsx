import cn from "classnames";
import type { BadgeParams } from "./badge-params";
import {
  BADGE_PRESET_THEMES,
  badgeMarkFill,
  resolveBadgeTheme,
} from "./badge-themes";
import BadgeColorPicker from "./BadgeColorPicker";
import BadgeLogoUpload from "./BadgeLogoUpload";
import BadgeThemeSwatch from "./BadgeThemeSwatch";

export default function BadgeCustomizer({
  params,
  onChange,
  fileName,
  previewSrc,
  error,
  onFile,
  onClear,
  plateSrc,
  sourcePanX,
  sourcePanY,
  logoScale,
  onPanChange,
  onScaleChange,
}: {
  params: BadgeParams;
  onChange: (next: BadgeParams) => void;
  fileName: string | null;
  previewSrc: string | null;
  error: string | null;
  onFile: (file: File) => void;
  onClear: () => void;
  plateSrc: string;
  sourcePanX: number;
  sourcePanY: number;
  logoScale: number;
  onPanChange: (panX: number, panY: number) => void;
  onScaleChange: (scale: number) => void;
}) {
  const viewTheme = resolveBadgeTheme(params.theme, params.color);

  return (
    <div className="flex flex-col gap-12">
      <div className="flex flex-wrap items-center gap-8">
        <div
          aria-label="Color"
          className="flex flex-wrap gap-8"
          role="radiogroup"
        >
          <BadgeColorPicker onChange={onChange} params={params} />
          {BADGE_PRESET_THEMES.map((theme) => {
            const selected = params.theme === theme.id;
            return (
              <button
                aria-checked={selected}
                aria-label={theme.label}
                className={cn(
                  "flex size-40 items-center justify-center rounded-full transition-transform",
                  selected
                    ? "shadow-[inset_0_0_0_2px_var(--color-orange-900)]"
                    : "hover:scale-105"
                )}
                key={theme.id}
                onClick={() => onChange({ ...params, theme: theme.id })}
                role="radio"
                type="button"
              >
                <BadgeThemeSwatch theme={theme} />
              </button>
            );
          })}
        </div>
        <div aria-hidden="true" className="mx-8 flex-center h-40">
          <div className="h-13 w-px rounded-full bg-border-default" />
        </div>
        <BadgeLogoUpload
          fileName={fileName}
          logoScale={logoScale}
          markFill={badgeMarkFill(viewTheme)}
          onClear={onClear}
          onFile={onFile}
          onPanChange={onPanChange}
          onScaleChange={onScaleChange}
          plateSrc={plateSrc}
          previewSrc={previewSrc}
          sourcePanX={sourcePanX}
          sourcePanY={sourcePanY}
        />
      </div>
      {error ? (
        <p className="text-body-small text-text-muted">{error}</p>
      ) : null}
    </div>
  );
}
