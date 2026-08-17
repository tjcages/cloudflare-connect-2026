import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";

import HeroWindow from "@/components/HeroWindow";

import type { EmailKind, Ghosts } from "./emails";
import { SCROLL_DURATION, SCROLL_HOLD, SCROLL_TO } from "./emails";
import PreviewCard from "./PreviewCard";
import PreviewChrome from "./PreviewChrome";
import { part } from "./preview-variants";
import "./EmailPreview.css";

interface Props {
  email: EmailKind;
  ghosts: Ghosts;
  reveal: number;
  sent: boolean;
  started: boolean;
}

export default function EmailPreview({
  email,
  ghosts,
  reveal,
  sent,
  started,
}: Props) {
  const { preview } = email;
  const headerShown = reveal >= 1;
  const bodyShown = reveal >= 2;
  // The opening state reads as revealed but has never run, so it does not scroll.
  const scrolled = started && bodyShown;

  return (
    <HeroWindow
      variant="preview"
      className="bg-background-base shadow-elevation-default"
    >
      <PreviewChrome sent={sent} title={email.title} />

      <div className="relative mx-6 h-196 overflow-clip before:inner-border before:z-20 before:border-border-default">
        <motion.div
          animate={{ y: scrolled ? SCROLL_TO : 0 }}
          transition={{
            duration: scrolled ? SCROLL_DURATION : 0.45,
            ease: [0.6, 0.6, 0, 1],
            delay: scrolled ? SCROLL_HOLD : 0,
          }}
          className="absolute inset-x-0 top-0 pt-20"
        >
          <div className="px-20">
            <Row
              ghost={ghosts.header[0]}
              index={0}
              label="From"
              shown={headerShown}
            >
              <span className="text-text-base">{preview.fromName}</span>{" "}
              <span className="text-text-muted">
                &lt;{preview.fromAddress}&gt;
              </span>
            </Row>
            <Row
              ghost={ghosts.header[1]}
              index={1}
              label="To"
              shown={headerShown}
            >
              <span className="text-text-base">{preview.toName}</span>{" "}
              <span className="text-text-muted">
                &lt;{preview.toAddress}&gt;
              </span>
            </Row>
            <Row
              ghost={ghosts.header[2]}
              index={2}
              label="Subject"
              shown={headerShown}
            >
              <span className="text-text-base">{preview.subject}</span>
            </Row>
          </div>

          <div className="mx-20 mt-16 bg-background-ghost pt-8 pb-40">
            <PreviewCard
              ghosts={ghosts}
              preview={preview}
              shown={bodyShown}
              validated={reveal >= 3}
            />
          </div>
        </motion.div>
      </div>
    </HeroWindow>
  );
}

function Row({
  children,
  ghost,
  index,
  label,
  shown,
}: {
  children: ReactNode;
  ghost: number;
  index: number;
  label: string;
  shown: boolean;
}) {
  return (
    <div className="relative flex h-16 items-center gap-12 not-first:mt-8">
      <span className="w-56 shrink-0 text-body-tiny text-text-muted">
        {label}
      </span>

      {/* Fixed height: with only the absolutely-placed ghost inside, this box
          would collapse to 0 and the centring would drop the bar 8px. */}
      <div className="relative h-16 min-w-0 flex-1">
        <AnimatePresence initial={false} mode="popLayout">
          {shown ? (
            <motion.p
              key="text"
              variants={part(index)}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="truncate text-body-tiny"
            >
              {children}
            </motion.p>
          ) : (
            <motion.div
              key="ghost"
              variants={part(index)}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="ghost-bar absolute top-5 left-0 h-6 overflow-clip rounded-4 bg-darker/5"
              style={{ width: ghost }}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
