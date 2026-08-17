# @tjcages/connect-twizzler

Reusable, worker-backed renderer for the Cloudflare Connect Twizzler.

```tsx
import { ConnectTwizzler } from "@tjcages/connect-twizzler/react";

<ConnectTwizzler
  posterSrc="/connect/twizzler-poster.png"
  settings={{ speed: 0.55 }}
  style={{ width: "100%", aspectRatio: "5 / 1" }}
/>;
```

All mounted instances share one worker. Rendering pauses outside the viewport,
defaults to 30 fps and 1.5 DPR, and becomes a still when reduced motion is
requested. The poster remains visible when workers or OffscreenCanvas are not
available.
