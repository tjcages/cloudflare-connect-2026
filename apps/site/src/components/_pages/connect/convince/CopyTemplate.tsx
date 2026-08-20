import Button from "@/components/Button";
import {
  CopyFeedbackIcon,
  useCopyFeedback,
} from "@/components/copy-feedback/CopyFeedback";
import type { IslandProps } from "@/types/island-props";
import { useState } from "react";

type Tab = "email" | "message";

type Props = IslandProps<{
  emailTemplate: string;
  messageTemplate: string;
}>;

export default function CopyTemplate({
  emailTemplate,
  messageTemplate,
}: Props) {
  const [tab, setTab] = useState<Tab>("email");
  const value = tab === "email" ? emailTemplate : messageTemplate;
  const { copied, copy } = useCopyFeedback(value);
  const copyLabel =
    copied ? "Copied" : tab === "email" ? "Copy email" : "Copy message";

  return (
    <div className="flex flex-col gap-24">
      <div className="flex items-center justify-between gap-12">
        <div className="flex min-w-0 flex-wrap gap-8">
          <Button
            onClick={() => setTab("email")}
            size="default"
            variant={tab === "email" ? "primary" : "ghost"}
          >
            <span>Email</span>
          </Button>
          <Button
            onClick={() => setTab("message")}
            size="default"
            variant={tab === "message" ? "primary" : "ghost"}
          >
            <span>Message (Slack, Teams or Chat)</span>
          </Button>
        </div>

        <Button
          aria-label={copyLabel}
          className="shrink-0"
          onClick={copy}
          size="default"
          title={copyLabel}
          variant="secondary"
        >
          <CopyFeedbackIcon copied={copied} />
        </Button>
      </div>

      <div className="relative bg-background-surface p-40 before:inside-border before:border-border-muted max-lg:p-20">
        <pre className="font-sans text-body-medium whitespace-pre-wrap text-text-default">
          {value}
        </pre>
      </div>
    </div>
  );
}
