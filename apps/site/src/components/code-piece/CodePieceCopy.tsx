import cn from "classnames";
import {
  CopyFeedbackIcon,
  useCopyFeedback,
} from "@/components/copy-feedback/CopyFeedback";

export default function CodePieceCopy({ code }: { code: string }) {
  const { copied, copy } = useCopyFeedback(code);

  return (
    <div
      className={cn(
        "absolute inset-y-4 right-4 flex w-80 justify-end bg-linear-to-l from-background-base from-50% p-16 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100",
        !copied && "translate-x-4 opacity-0"
      )}
    >
      <button
        aria-label={copied ? "Copied" : "Copy code"}
        className="relative z-10 size-20 cursor-pointer text-orange-900"
        onClick={copy}
        type="button"
      >
        <CopyFeedbackIcon className="overlay" copied={copied} />
      </button>
    </div>
  );
}
