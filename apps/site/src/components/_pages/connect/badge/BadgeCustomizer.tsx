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
    <div className="flex w-full flex-col gap-12">
      <div className="flex w-full flex-nowrap items-center gap-8 max-lg:justify-between max-lg:gap-0">
        <div
          aria-label="Color"
          className="flex flex-nowrap gap-8 max-lg:contents"
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
                  "flex size-40 max-lg:size-32 items-center justify-center rounded-full transition-transform",
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
        <div
          aria-hidden="true"
          className="h-13 w-px shrink-0 rounded-full bg-border-default"
        />
        <div className="flex size-40 shrink-0 items-center justify-center max-lg:size-32">
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
      </div>
      {error ? (
        <p className="text-body-small text-text-muted">{error}</p>
      ) : null}
    </div>
  );
}
