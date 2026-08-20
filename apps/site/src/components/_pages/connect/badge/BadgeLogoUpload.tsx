import cn from "classnames";
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type PointerEvent,
} from "react";
import Dropdown from "@/components/dropdown/Dropdown";
import DropdownItem from "@/components/dropdown/DropdownItem";
import DropdownSeparator from "@/components/dropdown/DropdownSeparator";
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

const circleClass = (active: boolean) =>
  cn(
    "flex size-40 items-center justify-center rounded-full transition-transform outline-none",
    active
      ? "shadow-[inset_0_0_0_2px_var(--color-orange-900)]"
      : "hover:scale-105"
  );

function LogoThumb({ src }: { src?: string }) {
  if (!src) {
    return (
      <span className="relative flex size-28 items-center justify-center rounded-full bg-background-faint text-icon-muted before:inner-border before:border-border-default">
        <Icon name="plus-small" size={20} />
      </span>
    );
  }

  return (
    <span className="relative flex size-28 items-center justify-center overflow-hidden rounded-full bg-background-faint before:inner-border before:border-border-default">
      <img alt="" className="size-full object-contain p-4" src={src} />
    </span>
  );
}

export default function BadgeLogoUpload({
  fileName,
  previewSrc,
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

  const trigger = (
    <button
      aria-label={fileName ? `Edit ${fileName}` : "Add company logo"}
      className={circleClass(open)}
      type="button"
    >
      <LogoThumb src={previewSrc ?? undefined} />
    </button>
  );

  if (!fileName) {
    return (
      <>
        <button
          aria-label="Add company logo"
          className={circleClass(false)}
          onClick={pickFile}
          type="button"
        >
          <LogoThumb />
        </button>
        {fileInput}
      </>
    );
  }

  return (
    <>
      <Dropdown
        label="Company logo"
        onOpenChange={setOpen}
        open={open}
        panelClassName="w-232"
        trigger={trigger}
      >
        <div
          className="p-8"
          onKeyDown={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <div className="mb-8 text-label-x-small text-text-muted">
            Shader source
          </div>
          <div
            className="bg-black relative aspect-4/3 cursor-grab touch-none overflow-hidden rounded-8 select-none active:cursor-grabbing"
            onPointerDown={onPadPointerDown}
            onPointerMove={onPadPointerMove}
            onPointerUp={onPadPointerUp}
            onPointerCancel={onPadPointerUp}
          >
            <img
              alt="Luminance plate converted into the badge stripe shader"
              className="pointer-events-none absolute inset-0 size-full object-contain"
              src={plateSrc}
              style={{
                transform: `translate(${sourcePanX * 50}%, ${sourcePanY * -50}%)`,
              }}
            />
            {previewSrc ? (
              <img
                alt=""
                className="pointer-events-none absolute top-1/2 left-1/2 object-contain"
                src={previewSrc}
                style={{
                  width: `${logoScale * 55}%`,
                  height: `${logoScale * 55}%`,
                  transform: "translate(-50%, -50%)",
                }}
              />
            ) : null}
          </div>
          <p className="mt-8 text-label-x-small text-text-muted">
            Drag to move
          </p>
        </div>

        <div
          className="flex min-h-36 items-center gap-8 p-8"
          onKeyDown={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <Icon
            className="shrink-0 text-icon-default"
            name="arrows-zoom"
            size={20}
          />
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
          <span className="w-36 text-right text-label-x-small text-text-muted tabular-nums">
            {Math.round(logoScale * 100)}%
          </span>
        </div>

        <DropdownSeparator />

        <DropdownItem
          className="group w-full gap-12"
          closeOnClick={false}
          onClick={pickFile}
        >
          <Icon
            className="text-icon-default transition-all group-hover:text-icon-base"
            name="images-2"
            size={20}
          />
          <span>Replace logo</span>
        </DropdownItem>
        <DropdownItem
          className="group w-full gap-12"
          onClick={() => {
            setOpen(false);
            onClear();
          }}
        >
          <Icon
            className="text-icon-default transition-all group-hover:text-icon-base"
            name="cross-small"
            size={20}
          />
          <span>Remove</span>
        </DropdownItem>
      </Dropdown>
      {fileInput}
    </>
  );
}
