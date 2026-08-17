import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import DownloadButton from "./DownloadButton";
import CarouselCardRequests, {
  type CardAnimationContext,
} from "./requests/Requests";

export default function Generation() {
  const [isFinish, setIsFinish] = useState(false);

  async function generationAnimation({ sleep }: CardAnimationContext) {
    await sleep(1900);

    setIsFinish(true);
  }

  return (
    <CarouselCardRequests
      title="pdf"
      setFinish={setIsFinish}
      variant="site-3"
      loading={!isFinish}
      startAnimation={generationAnimation}
    >
      <AnimatePresence mode="popLayout">
        {isFinish && (
          <motion.div
            key="download"
            initial={{ opacity: 0, filter: "blur(1px)", y: 6 }}
            animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
            exit={{ opacity: 0, filter: "blur(1px)", y: 6 }}
            transition={{ duration: 0.25, ease: [0.6, 0.6, 0, 1] }}
            className="absolute inset-0 z-30 flex-center bg-background-base"
          >
            <DownloadButton iconName="file-pdf" title="PDF" />
          </motion.div>
        )}
      </AnimatePresence>
    </CarouselCardRequests>
  );
}
