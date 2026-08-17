import cn from "classnames";
import { motion } from "motion/react";
import { useRef, useState } from "react";
import {
  CopyFeedbackIcon,
  useCopyFeedback,
} from "@/components/copy-feedback/CopyFeedback";
import { rainLayer } from "@/components/scramble/rain";
import { useRainLayerStack } from "@/components/scramble/use-rain-layer-stack";

const commandHtml = (command: string) =>
  `<span style="color:var(--color-orange-900)">${command}</span>`;

export default function DeployTerminal() {
  const [activeTab, setActiveTab] = useState(0);
  const { copied, copy } = useCopyFeedback(tabs[activeTab].command);
  const { displayed, transition } = useRainLayerStack(
    tabs[0].command,
    tabs[0].command
  );
  const stackRef = useRef<HTMLSpanElement>(null);

  function selectTab(index: number) {
    if (index === activeTab) return;
    const direction = index > activeTab ? 1 : -1;
    setActiveTab(index);

    const command = tabs[index].command;
    const stack = stackRef.current;
    if (!stack) return;

    transition({
      key: command,
      value: command,
      createLayer: () => {
        const layer = document.createElement("span");
        layer.className = "absolute top-0 left-0 whitespace-pre";
        stack.appendChild(layer);
        return layer;
      },
      start: ({ layer, onComplete, under }) =>
        rainLayer({
          layerEl: layer,
          underHtml: commandHtml(under),
          toHtml: commandHtml(command),
          direction,
          onComplete,
        }),
    });
  }

  return (
    <div className="relative z-10 my-20 w-full bg-background-base shadow-elevation-default">
      <div className="relative flex h-40 before:inside-border-b before:border-border-default">
        {tabs.map((tab, i) => (
          <button
            key={tab.label}
            type="button"
            onClick={() => selectTab(i)}
            className={cn(
              "relative cursor-pointer px-16 py-10 text-body-x-small transition-colors duration-200",
              i === activeTab ? "text-orange-900" : "text-text-default"
            )}
          >
            {tab.label}
            {i === activeTab && (
              <motion.div
                layoutId="deploy-terminal-tab-underline"
                transition={{ duration: 0.25, ease: [0.165, 0.84, 0.44, 1] }}
                className="absolute bottom-0 left-0 h-1 w-full bg-orange-900"
              />
            )}
          </button>
        ))}

        <button
          type="button"
          aria-label={copied ? "Copied" : "Copy command"}
          onClick={copy}
          className="absolute top-0 right-0 flex-center size-40 cursor-pointer text-orange-900 before:inside-border-l before:border-border-default"
        >
          <CopyFeedbackIcon copied={copied} />
        </button>
      </div>

      <div className="flex h-80 items-center gap-12 pl-28 text-code-default">
        <span className="text-text-subtle">$</span>
        <span
          ref={stackRef}
          className="relative whitespace-pre text-orange-900"
        >
          {displayed}
        </span>
      </div>
    </div>
  );
}

const tabs = [
  { label: "npx", command: "npx wrangler deploy --env production" },
  { label: "pnpx", command: "pnpx wrangler deploy --env production" },
  { label: "yarn-exec", command: "yarn exec wrangler deploy --env production" },
];
