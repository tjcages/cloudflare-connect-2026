import { useEffect } from "react";
import {
  createCanvasVisuals,
  type CanvasVisualRegistry,
} from "./canvas-visuals";

export default function CanvasVisuals({
  scopeAttr,
  rootAttr,
  registry,
}: {
  scopeAttr: string;
  rootAttr: string;
  registry: CanvasVisualRegistry;
}) {
  "use no memo";

  useEffect(() => {
    const disposers = Array.from(
      document.querySelectorAll<HTMLElement>(`[${scopeAttr}]`)
    ).map((scope) => createCanvasVisuals(scope, { rootAttr, registry }));

    return () => {
      for (const dispose of disposers) dispose();
    };
  }, [scopeAttr, rootAttr, registry]);

  return null;
}
