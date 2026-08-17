import { animate } from "motion";
import { motion } from "motion/react";
import { useLayoutEffect, useRef, useState } from "react";
import Browser from "@/components/browser/Browser";
import BrowserContent from "@/components/browser/BrowserContent";
import { createBrowserContent } from "@/components/browser/archetypes";
import type { BrowserVariant } from "@/components/browser/types";

export default function RequestsBrowser({
  children,
  flash,
  overlay,
  variant,
  loading,
  active,
  enabled,
}: {
  children: React.ReactNode;
  flash: React.ReactNode;
  overlay: React.ReactNode;
  variant: BrowserVariant;
  loading?: boolean;
  active: boolean;
  enabled: boolean;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const [showing, setShowing] = useState(false);

  useLayoutEffect(() => {
    const host = hostRef.current;
    const page = pageRef.current;
    if (!host || !page) return;

    const panels = [
      ...host.querySelectorAll<HTMLElement>("[data-browser-archetype]"),
    ];

    if (!enabled) {
      const clear = () => {
        setShowing(false);
        for (const panel of panels) {
          panel.removeAttribute("data-active");
          panel.removeAttribute("data-revealing");
          panel.style.removeProperty("transform");
          panel.style.removeProperty("opacity");
          panel.style.removeProperty("filter");
        }
        page.style.removeProperty("opacity");
      };
      if (!panels.some((p) => p.hasAttribute("data-active"))) return clear();

      const out = animate(
        page,
        { opacity: 0 },
        { duration: 0.25, ease: [0.6, 0.6, 0, 1] }
      );
      out.then(clear);
      return () => out.stop();
    }

    setShowing(true);
    page.style.removeProperty("opacity");

    const content = createBrowserContent(host);
    const panel = content.begin();
    if (!panel) {
      content.settle();
      return;
    }

    panel.style.removeProperty("transform");

    const reveal = animate(
      panel,
      { opacity: [0, 1], filter: ["blur(1px)", "blur(0px)"] },
      { duration: 0.45, ease: [0.6, 0.6, 0, 1] }
    );
    reveal.then(() => content.settle());

    return () => reveal.stop();
  }, [enabled]);

  return (
    <motion.div
      data-card-active={active || undefined}
      initial={{ y: 0 }}
      className="relative z-10"
    >
      <Browser
        ref={hostRef}
        className="h-136 w-208"
        variant={variant}
        loading={loading}
        reveal={false}
        data-active={enabled || undefined}
        viewport={
          <div className="overlay" ref={pageRef}>
            <BrowserContent />
            {showing && children}
          </div>
        }
      >
        {enabled && flash}
      </Browser>

      {enabled && overlay}
    </motion.div>
  );
}
