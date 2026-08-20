import { createPortal } from "react-dom";
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
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-10000 flex justify-center p-20 max-sm:p-12">
      <div className="pointer-events-auto relative w-full max-w-840 overflow-hidden rounded-16 bg-background-base shadow-elevation-default before:inside-border before:z-2 before:border-border-default">
        <button
          aria-label="Dismiss shareable card"
          className="absolute top-12 right-12 z-3 flex size-44 cursor-pointer items-center justify-center rounded-full bg-background-base text-icon-base shadow-elevation-default transition-transform hover:scale-105 focus-visible:outline-none"
          onClick={onDismiss}
          type="button"
        >
          <Icon name="cross-small" size={24} />
        </button>
        <img
          alt={title}
          className="block w-full bg-background-base"
          draggable
          src={src}
        />
        <p className="flex min-h-48 items-center px-20 py-16 pr-64 text-label-x-small text-text-muted">
          {copied
            ? "Copied — right-click the image to save"
            : "Right-click the image to save"}
        </p>
      </div>
    </div>,
    document.body
  );
}
