import { useEffect, useState } from "react";
import IconSwap from "@/components/_animations/shared/swap/IconSwap";
import Button from "@/components/Button";
import { useCopyFeedback } from "@/components/copy-feedback/CopyFeedback";
import Icon from "@/components/icon/Icon";
import type { IslandProps } from "@/types/island-props";

interface Props {
  hash?: string;
  label?: string;
}

export default function CopyLink({ hash, label }: IslandProps<Props>) {
  const [page, setPage] = useState("");

  useEffect(() => {
    setPage(location.origin + location.pathname);
  }, []);

  const { copied, copy } = useCopyFeedback(hash ? `${page}#${hash}` : page);

  return (
    <Button
      aria-label={
        label ?? (hash ? "Copy link to this section" : "Copy link to this post")
      }
      onClick={copy}
      size="default"
      type="button"
      variant="ghost"
    >
      <IconSwap className="size-20" swapKey={`${copied}`}>
        <Icon name={copied ? "checkmark-1-medium" : "chain-link-3"} size={20} />
      </IconSwap>

      {label && <span>{label}</span>}
    </Button>
  );
}
