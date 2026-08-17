import { useCallback, useEffect, useRef, useState } from "react";
import type { rainLayer } from "./rain";

type RainHandle = ReturnType<typeof rainLayer>;

type Layer<T> = {
  element: HTMLElement;
  handle: RainHandle;
  id: number;
  value: T;
};

export function useRainLayerStack<T>(initialValue: T, initialKey: string) {
  const [settled, setSettled] = useState({ value: initialValue, layerId: 0 });
  const [pendingCount, setPendingCount] = useState(0);
  const displayedRef = useRef(initialValue);
  const eventualKeyRef = useRef(initialKey);
  const layersRef = useRef<Layer<T>[]>([]);
  const nextLayerId = useRef(0);

  const transition = useCallback(
    ({
      createLayer,
      key,
      start,
      value,
    }: {
      createLayer: () => HTMLElement;
      key: string;
      start: (context: {
        layer: HTMLElement;
        onComplete: () => void;
        under: T;
      }) => RainHandle;
      value: T;
    }) => {
      if (eventualKeyRef.current === key) return;
      eventualKeyRef.current = key;

      const id = ++nextLayerId.current;
      const element = createLayer();
      const under = layersRef.current.at(-1)?.value ?? displayedRef.current;
      const handle = start({
        layer: element,
        under,
        onComplete: () => {
          if (layersRef.current.at(-1)?.id === id) {
            setSettled({ value, layerId: id });
          }
        },
      });

      layersRef.current.push({ element, handle, id, value });
      setPendingCount(layersRef.current.length);
      return handle;
    },
    []
  );

  useEffect(() => {
    displayedRef.current = settled.value;
    if (settled.layerId === 0) return;

    const settledIndex = layersRef.current.findIndex(
      (layer) => layer.id === settled.layerId
    );
    if (settledIndex === -1) return;

    for (const layer of layersRef.current.slice(0, settledIndex + 1)) {
      layer.handle.stop();
      layer.element.remove();
    }
    layersRef.current = layersRef.current.slice(settledIndex + 1);
    setPendingCount(layersRef.current.length);
  }, [settled]);

  useEffect(
    () => () => {
      for (const layer of layersRef.current) {
        layer.handle.stop();
        layer.element.remove();
      }
    },
    []
  );

  return { displayed: settled.value, pendingCount, transition };
}
