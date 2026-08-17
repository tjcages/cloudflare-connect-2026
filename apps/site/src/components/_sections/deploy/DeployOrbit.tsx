import { animate } from "motion/react";
import { useEffect, useRef } from "react";
import Icon from "@/components/icon/Icon";
import GithubBlackLogo from "./_svg/GithubBlackLogo.svg?react";

const MAJOR = 68;
const MINOR = 20;
const DIAG = Math.SQRT1_2;

export default function DeployOrbit() {
  const rootRef = useRef<HTMLDivElement>(null);
  const badgeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const badge = badgeRef.current;
    if (!root || !badge) return;

    const controls = animate(0, 1, {
      duration: 3.5,
      ease: "linear",
      repeat: Infinity,
      onUpdate: (p) => {
        const theta = p * Math.PI * 2;
        const sin = Math.sin(theta);
        const u = MAJOR * Math.cos(theta);
        const v = MINOR * sin;
        const scale = 1 - (sin > 0 ? 0.14 : 0.08) * sin;
        badge.style.transform = `translate(${(u - v) * DIAG - 48}px, ${-(u + v) * DIAG + 48}px) scale(${scale})`;
        badge.style.zIndex = sin > 0 ? "-1" : "";
      },
    });

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        controls.play();
      } else {
        controls.pause();
      }
    });
    observer.observe(root);

    return () => {
      observer.disconnect();
      controls.stop();
    };
  }, []);

  return (
    <div ref={rootRef} className="relative isolate mx-auto mb-24 size-80">
      <div className="flex-center size-full rounded-full bg-background-base shadow-elevation-default">
        <Icon name="cloudflare" variant="duo" className="h-32 w-48" />
      </div>
      <div
        ref={badgeRef}
        className="absolute -top-32 -right-32 flex-center size-48 rounded-full bg-background-base shadow-elevation-default"
      >
        <GithubBlackLogo className="text-icon-base" />
      </div>
    </div>
  );
}
