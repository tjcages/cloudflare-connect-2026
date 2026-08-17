import { useEffect, useState } from "react";
import ScatterText from "@/components/scatter-text/ScatterText";
import { INITIAL_SLUG, randomSlug, SWAP_EVENT, URL_DOMAIN } from "./link";

export default function ShareUrl() {
  const [slug, setSlug] = useState(INITIAL_SLUG);

  useEffect(() => {
    const swap = () => setSlug(randomSlug());
    window.addEventListener(SWAP_EVENT, swap);
    return () => window.removeEventListener(SWAP_EVENT, swap);
  }, []);

  return (
    <span className="flex items-center px-4 text-label-x-small whitespace-nowrap">
      <ScatterText text={slug} />
      <span>{URL_DOMAIN}</span>
    </span>
  );
}
