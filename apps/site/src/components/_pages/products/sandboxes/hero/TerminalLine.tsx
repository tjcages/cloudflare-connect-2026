import cn from "classnames";

import Icon from "@/components/icon/Icon";

import type { Line } from "./acts";

export default function TerminalLine({
  line,
  typed,
}: {
  line: Line;
  typed?: number;
}) {
  const { kind, text } = line;
  const gutter =
    kind === "command" || kind === "check" || kind === "step" || kind === "add";

  return (
    <div
      className={cn([
        "flex h-24 items-center gap-8",
        (kind === "step" || kind === "add") && "pl-12",
      ])}
    >
      {gutter ? (
        <span className="flex-center h-24 w-12 shrink-0">
          {kind === "command" ? (
            <span className="text-code-default text-text-subtle">$</span>
          ) : null}

          {kind === "check" ? (
            <Icon
              name="checkmark-1-medium"
              size={20}
              className="text-icon-accent-success"
            />
          ) : null}

          {kind === "step" ? (
            <Icon
              name="chevron-right-small"
              size={20}
              className="text-icon-muted"
            />
          ) : null}

          {kind === "add" ? (
            <Icon name="plus-small" size={20} className="text-icon-muted" />
          ) : null}
        </span>
      ) : null}

      <span
        className={cn([
          "text-code-default whitespace-nowrap",
          (kind === "command" || kind === "check" || kind === "log") &&
            "text-text-base",
          (kind === "step" || kind === "add" || kind === "trace") &&
            "text-text-default",
          kind === "note" && "text-text-subtle",
          kind === "link" &&
            "text-text-accent-orange underline decoration-solid [text-underline-position:from-font]",
        ])}
      >
        {typed === undefined ? text : text.slice(0, typed)}

        {typed === undefined ? null : (
          <span className="ml-1 inline-block h-14 w-7 translate-y-2 bg-text-base" />
        )}
      </span>
    </div>
  );
}
