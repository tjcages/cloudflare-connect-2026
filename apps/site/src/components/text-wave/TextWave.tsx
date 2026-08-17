import type { CSSProperties } from "react";

import "./TextWave.css";

export default function TextWave({ text }: { text: string }) {
  // The cycle has to outrun the sweep, or the first letter lights again before
  // the last one has, and two highlights cross the word at once.
  const duration = `${text.length * 0.042 + 0.45}s`;

  return text.split("").map((char, index) => (
    <span
      key={index}
      className="text-wave whitespace-pre"
      style={
        {
          animationDelay: `${index * 0.042}s`,
          "--wave-duration": duration,
        } as CSSProperties
      }
    >
      {char}
    </span>
  ));
}
