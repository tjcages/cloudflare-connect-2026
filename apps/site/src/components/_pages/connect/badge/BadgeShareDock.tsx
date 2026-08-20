import { createPortal } from "react-dom";
import Button from "@/components/Button";
import Icon from "@/components/icon/Icon";

export default function BadgeShareDock({
  src,
  title,
  copied,
  onDismiss,
}: {
  src: string;
  title: string;
  copied: boolean;
  onDismiss: () => void;
}) {
  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-60 flex justify-center p-16 max-sm:p-12">
      <div className="pointer-events-auto relative w-full max-w-720 overflow-hidden bg-background-base shadow-elevation-default">
        <Button
          aria-label="Dismiss shareable card"
          className="absolute top-8 right-8 z-1"
          onClick={onDismiss}
          size="default"
          type="button"
          variant="ghost"
        >
          <Icon name="cross-small" size={20} />
        </Button>
        <img alt={title} className="block w-full" src={src} />
        <p className="flex min-h-44 items-center px-16 py-12 text-label-x-small text-text-muted">
          {copied ? "Copied to clipboard" : title}
        </p>
      </div>
    </div>,
    document.body
  );
}
