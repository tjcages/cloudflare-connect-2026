import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { StripesShader } from "@necatikcl/stripes-engine/react";

const IMAGE_SRC =
  "data:image/svg+xml;base64," +
  btoa(
    `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256">
      <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#101820"/>
        <stop offset="0.5" stop-color="#8899aa"/>
        <stop offset="1" stop-color="#f0e8d8"/>
      </linearGradient></defs>
      <rect width="256" height="256" fill="url(#g)"/>
      <circle cx="170" cy="85" r="42" fill="#ff8833"/>
      <rect x="30" y="140" width="105" height="78" fill="#1b3b6f"/>
    </svg>`,
  );

const VIDEO_SRC = "./clip.mp4";

const SECTIONS = [
  { id: "img-0", kind: "image" as const, label: "image (top, on-screen)" },
  { id: "vid-0", kind: "video" as const, label: "video (top, on-screen)" },
  { id: "img-1", kind: "image" as const, label: "image (mid)" },
  { id: "vid-1", kind: "video" as const, label: "video (mid)" },
  { id: "img-2", kind: "image" as const, label: "image (bottom, off-screen)" },
  { id: "vid-2", kind: "video" as const, label: "video (bottom, off-screen)" },
];

function App() {
  return (
    <>
      {SECTIONS.map((s) => (
        <section
          className="section"
          key={s.id}
          data-shader-id={s.id}
          data-shader-kind={s.kind}
          style={{ minHeight: 480 }}
        >
          <h2>
            {s.id} — {s.label}
          </h2>
          <StripesShader
            sharedContext
            src={s.kind === "video" ? VIDEO_SRC : IMAGE_SRC}
            mediaKind={s.kind}
            rootMargin="0px"
            className="shader"
            width={280}
            height={200}
          />
        </section>
      ))}
    </>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
