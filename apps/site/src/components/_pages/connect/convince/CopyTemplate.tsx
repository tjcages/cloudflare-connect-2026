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
      <div className="flex items-start justify-between gap-12">
        <div className="flex min-w-0 flex-1 flex-wrap gap-8">
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
          className="size-32 shrink-0 self-start p-0! [&>span]:flex [&>span]:size-full [&>span]:items-center [&>span]:justify-center [&>span]:p-0! [&>span]:px-0!"
          onClick={copy}
          size="default"
          title={copyLabel}
          variant="secondary"
        >
          <CopyFeedbackIcon
            className="flex size-full items-center justify-center"
            copied={copied}
          />
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
