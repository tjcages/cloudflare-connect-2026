import { useRef } from "react";
import Button from "@/components/Button";
import Icon from "@/components/icon/Icon";
import BadgeShaderSource from "./BadgeShaderSource";

export default function BadgeLogoUpload({
  fileName,
  error,
  onFile,
  onClear,
  plateSrc,
}: {
  fileName: string | null;
  error: string | null;
  onFile: (file: File) => void;
  onClear: () => void;
  plateSrc: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col gap-12">
      <div className="text-label-x-small text-text-muted">Company logo</div>
      <div className="flex flex-wrap items-center gap-12">
        <Button
          onClick={() => inputRef.current?.click()}
          size="large"
          type="button"
          variant="secondary"
        >
          <span className="max-w-240 truncate">{fileName ?? "Upload logo"}</span>
        </Button>
        <div className="group/source relative">
          <Button
            aria-label="Preview shader source"
            size="large"
            type="button"
            variant="ghost"
          >
            <Icon name="images-2" size={20} />
          </Button>
          <div className="pointer-events-none invisible absolute top-0 left-full z-30 pl-12 opacity-0 transition-opacity duration-150 group-focus-within/source:visible group-focus-within/source:opacity-100 group-hover/source:visible group-hover/source:opacity-100 max-lg:top-auto max-lg:bottom-full max-lg:left-0 max-lg:pl-0 max-lg:pb-12">
            <BadgeShaderSource src={plateSrc} />
          </div>
        </div>
        {fileName ? (
          <Button onClick={onClear} size="large" type="button" variant="ghost">
            <span>Remove</span>
          </Button>
        ) : null}
        <input
          accept="image/svg+xml,.svg,image/png,.png"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onFile(file);
            event.target.value = "";
          }}
          ref={inputRef}
          type="file"
        />
      </div>
      {error ? (
        <p className="text-body-small text-text-muted">{error}</p>
      ) : null}
    </div>
  );
}
