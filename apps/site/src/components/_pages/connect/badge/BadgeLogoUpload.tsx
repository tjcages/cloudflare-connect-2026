import cn from "classnames";
import {
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ChangeEvent,
  type PointerEvent,
} from "react";
import DashedCircle from "@/components/dashed-line/DashedCircle";
import Dropdown from "@/components/dropdown/Dropdown";
import Icon from "@/components/icon/Icon";
import { LOGO_FILE_ACCEPT } from "./badge-logo";
import {
  BADGE_LOGO_SCALE_MAX,
  BADGE_LOGO_SCALE_MIN,
  BADGE_SOURCE_PAN,
  BADGE_TUNE_DEFAULTS,
} from "./badge-tune";
import BadgeInspectorField from "./BadgeInspectorField";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function PanelGrip() {
  return (
    <svg
      aria-hidden="true"
      fill="currentColor"
      height={14}
      viewBox="0 0 24 24"
      width={14}
    >
      <circle cx="9" cy="6" r="1.4" />
      <circle cx="15" cy="6" r="1.4" />
      <circle cx="9" cy="12" r="1.4" />
      <circle cx="15" cy="12" r="1.4" />
      <circle cx="9" cy="18" r="1.4" />
      <circle cx="15" cy="18" r="1.4" />
    </svg>
  );
}

function LogoThumb({ src, fill }: { src?: string; fill: string }) {
  if (!src) {
    return (
      <span className="relative flex size-28 items-center justify-center rounded-full text-icon-muted">
        <Icon name="plus-small" size={20} />
      </span>
    );
  }

  return (
    <span
      aria-hidden="true"
      className="size-28"
      style={{
        backgroundColor: fill,
        maskImage: `url("${src}")`,
        maskPosition: "center",
        maskRepeat: "no-repeat",
        maskSize: "contain",
        WebkitMaskImage: `url("${src}")`,
        WebkitMaskPosition: "center",
        WebkitMaskRepeat: "no-repeat",
        WebkitMaskSize: "contain",
      }}
    />
  );
}

function LogoCircle({
  active,
  fill,
  src,
  ...attributes
}: {
  active: boolean;
  fill: string;
  src?: string;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...attributes}
      className={cn(
        "relative flex size-40 items-center justify-center rounded-full outline-none",
        !active && "hover:scale-105"
      )}
      type="button"
    >
      <DashedCircle
        className={cn(
          "overlay",
          active ? "text-orange-900" : "text-border-dashed"
        )}
      />
      <LogoThumb fill={fill} src={src} />
    </button>
  );
}

export default function BadgeLogoUpload({
  fileName,
  previewSrc,
  markFill,
  onFile,
  onClear,
  plateSrc,
  sourcePanX,
  sourcePanY,
  logoScale,
  onPanChange,
  onScaleChange,
}: {
  fileName: string | null;
  previewSrc: string | null;
  markFill: string;
  onFile: (file: File) => void;
  onClear: () => void;
  plateSrc: string;
  sourcePanX: number;
  sourcePanY: number;
  logoScale: number;
  onPanChange: (panX: number, panY: number) => void;
  onScaleChange: (scale: number) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<{
    x: number;
    y: number;
    panX: number;
    panY: number;
    width: number;
    height: number;
  } | null>(null);
  const pickedRef = useRef(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (fileName && pickedRef.current) setOpen(true);
  }, [fileName]);

  const pickFile = () => inputRef.current?.click();

  const onInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      pickedRef.current = true;
      onFile(file);
    }
    event.target.value = "";
  };

  const onPadPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      x: event.clientX,
      y: event.clientY,
      panX: sourcePanX,
      panY: sourcePanY,
      width: Math.max(rect.width, 1),
      height: Math.max(rect.height, 1),
    };
  };

  const onPadPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    event.preventDefault();
    const dx = (event.clientX - drag.x) / drag.width;
    const dy = (event.clientY - drag.y) / drag.height;
    onPanChange(
      clamp(drag.panX + dx * 2, -BADGE_SOURCE_PAN, BADGE_SOURCE_PAN),
      clamp(drag.panY - dy * 2, -BADGE_SOURCE_PAN, BADGE_SOURCE_PAN)
    );
  };

  const onPadPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (dragRef.current) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;
  };

  const fileInput = (
    <input
      accept={LOGO_FILE_ACCEPT}
      className="hidden"
      onChange={onInputChange}
      ref={inputRef}
      type="file"
    />
  );

  const circle = (
    <LogoCircle
      active={open}
      aria-label={fileName ? `Edit ${fileName}` : "Add company logo"}
      fill={markFill}
      src={previewSrc ?? undefined}
    />
  );

  if (!fileName) {
    return (
      <>
        <LogoCircle
          active={false}
          aria-label="Add company logo"
          fill={markFill}
          onClick={pickFile}
        />
        {fileInput}
      </>
    );
  }

  return (
    <>
      <Dropdown
        align="end"
        label="Company logo"
        onOpenChange={setOpen}
        open={open}
        panelClassName="w-240 overflow-hidden rounded-12"
        scroll={false}
        side="top"
        trigger={circle}
      >
        <div className="flex items-center justify-between border-b border-border-muted px-12 py-8">
          <span className="truncate text-label-tiny text-text-base">
            {fileName ?? "Logo"}
          </span>
          <span className="shrink-0 text-label-tiny text-text-muted">
            Adjust
          </span>
        </div>

        <div className="flex flex-col gap-8 p-12">
          <div
            className="bg-black relative aspect-4/3 cursor-grab touch-none overflow-hidden rounded-8 select-none active:cursor-grabbing"
            onKeyDown={(event) => event.stopPropagation()}
            onPointerCancel={onPadPointerUp}
            onPointerDown={onPadPointerDown}
            onPointerMove={onPadPointerMove}
            onPointerUp={onPadPointerUp}
          >
            <img
              alt=""
              className="pointer-events-none absolute inset-0 size-full object-cover"
              src={plateSrc}
              style={{
                transform: `translate(${sourcePanX * 50}%, ${sourcePanY * -50}%)`,
              }}
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
              style={{ color: markFill }}
            >
              <PanelGrip />
            </span>
          </div>

          <div
            className="flex flex-col gap-8"
            onKeyDown={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <BadgeInspectorField
              active={logoScale !== BADGE_TUNE_DEFAULTS.logoScale}
              label="Size"
              max={Math.round(BADGE_LOGO_SCALE_MAX * 100)}
              min={Math.round(BADGE_LOGO_SCALE_MIN * 100)}
              onChange={(next) => onScaleChange(next / 100)}
              suffix="%"
              value={Math.round(logoScale * 100)}
            />
            <div className="grid min-w-0 grid-cols-2 gap-8">
              <BadgeInspectorField
                active={sourcePanX !== 0}
                label="X"
                max={Math.round(BADGE_SOURCE_PAN * 100)}
                min={Math.round(-BADGE_SOURCE_PAN * 100)}
                onChange={(next) => onPanChange(next / 100, sourcePanY)}
                value={Math.round(sourcePanX * 100)}
              />
              <BadgeInspectorField
                active={sourcePanY !== 0}
                label="Y"
                max={Math.round(BADGE_SOURCE_PAN * 100)}
                min={Math.round(-BADGE_SOURCE_PAN * 100)}
                onChange={(next) => onPanChange(sourcePanX, next / 100)}
                value={Math.round(sourcePanY * 100)}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-border-muted px-4">
          <button
            className="cursor-pointer px-8 py-8 text-label-tiny text-text-base transition-colors hover:text-orange-900"
            onClick={pickFile}
            type="button"
          >
            Replace
          </button>
          <button
            className="cursor-pointer px-8 py-8 text-label-tiny text-text-base transition-colors hover:text-orange-900"
            onClick={() => {
              setOpen(false);
              onClear();
            }}
            type="button"
          >
            Remove
          </button>
        </div>
      </Dropdown>
      {fileInput}
    </>
  );
}
