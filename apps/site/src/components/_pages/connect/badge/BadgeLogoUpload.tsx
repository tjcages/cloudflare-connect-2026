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
} from "./badge-tune";

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
        panelClassName="w-220"
        scroll={false}
        side="top"
        trigger={circle}
      >
        <div
          className="bg-black relative aspect-4/3 cursor-grab touch-none overflow-hidden select-none active:cursor-grabbing"
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
          className="flex items-center gap-12 px-12 py-10"
          onKeyDown={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <span className="text-label-x-small text-text-muted">Size</span>
          <input
            aria-label="Logo size"
            className="h-20 min-w-0 flex-1 accent-orange-900"
            max={BADGE_LOGO_SCALE_MAX}
            min={BADGE_LOGO_SCALE_MIN}
            onChange={(event) => onScaleChange(Number(event.target.value))}
            step={0.01}
            type="range"
            value={logoScale}
          />
          <span className="w-32 text-right text-label-x-small text-text-muted tabular-nums">
            {Math.round(logoScale * 100)}%
          </span>
        </div>

        <div className="before:inner-border-t relative flex before:border-border-muted">
          <button
            className="flex-1 cursor-pointer py-10 text-center text-label-x-small text-text-base transition-colors hover:bg-background-ghost"
            onClick={pickFile}
            type="button"
          >
            Replace
          </button>
          <button
            className="relative flex-1 cursor-pointer py-10 text-center text-label-x-small text-text-base transition-colors before:inner-border-l before:border-border-muted hover:bg-background-ghost"
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
