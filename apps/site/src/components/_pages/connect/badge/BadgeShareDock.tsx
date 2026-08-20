import { createPortal } from "react-dom";
import Icon from "@/components/icon/Icon";

export default function BadgeShareDock({
  src,
  title,
  onDismiss,
}: {
  src: string;
  title: string;
  onDismiss: () => void;
}) {
  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-10000 flex justify-center p-24 max-sm:p-16">
      <div className="pointer-events-auto relative w-full max-w-280">
        <button
          aria-label="Dismiss shareable card"
          className="absolute -top-12 -right-12 z-3 flex size-44 cursor-pointer items-center justify-center rounded-full bg-background-base text-icon-base shadow-elevation-default transition-transform hover:scale-105 focus-visible:outline-none"
          onClick={onDismiss}
          type="button"
        >
          <Icon name="cross-small" size={24} />
        </button>
        <img
          alt={title}
          className="block w-full rounded-16 bg-background-base shadow-elevation-default-drops"
          draggable
          src={src}
        />
      </div>
    </div>,
    document.body
  );
}
