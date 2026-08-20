import { useRef } from "react";
import Button from "@/components/Button";

export default function BadgeLogoUpload({
  fileName,
  error,
  onFile,
  onClear,
}: {
  fileName: string | null;
  error: string | null;
  onFile: (file: File) => void;
  onClear: () => void;
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
          <span className="max-w-240 truncate">{fileName ?? "Upload SVG"}</span>
        </Button>
        {fileName ? (
          <Button onClick={onClear} size="large" type="button" variant="ghost">
            <span>Remove</span>
          </Button>
        ) : null}
        <input
          accept="image/svg+xml,.svg"
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
