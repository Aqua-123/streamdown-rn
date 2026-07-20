# Performance

The performance claim is architectural and measured, not a fixed timing promise. Append-aware state limits work to the active block and memoized stable roots. Bounded caches, provider input ceilings, WebView message/source/asset limits, and image download limits prevent unbounded retained work.

```tsx verify
import React from 'react';
import { Streamdown, createStreamingInstrumentation } from 'streamdown-rn';

const metrics = createStreamingInstrumentation();

export function Measured({ content }: { content: string }) {
  return <Streamdown mode="streaming" isAnimating instrumentation={metrics}>{content}</Streamdown>;
}

export function snapshot() {
  return metrics.snapshot();
}
```

`bun run benchmark:host` measures parser/splitter characterization against the pinned 10 KiB corpus. It cannot prove UI commit latency, dropped frames, heap growth, startup, or first render. The release protocol in `benchmarks/protocol.json` requires release Hermes on Pixel 8 and iPhone 15 hardware, raw trace attribution, same-device baseline/candidate comparisons, and the exact corpus SHA.

Current simulator measurements are explicitly non-reference characterization. No publishable physical-device delta exists yet. `bun run release:report` exposes that blocker rather than converting host or simulator timings into a pass.
