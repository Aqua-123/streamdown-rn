# Performance

The performance claim is architectural and measured, not a fixed timing promise. Append-aware state limits work to the active block and memoized stable roots. Set `appendOnly` with a per-message `streamKey` when the host guarantees append-only delivery; verified replacement detection necessarily scans the prior string. A single active Markdown block over 2 KiB, or a progressive component payload over 8 KiB, switches to a readable plain-text streaming preview to bound token-by-token reparsing; semantic formatting is restored when the document completes. Code rendering and highlighting retain at most the first 65,536 JavaScript string code units or 2,000 lines on screen, with a visible notice; copy/download actions retain the full code. Bounded caches, component depth/node limits, provider input ceilings, WebView message/source/asset limits, and image download limits prevent unbounded retained work.

Animated prose is laid out once at its final size by a Fabric leaf view. JavaScript serializes UTF-16 style/link ranges and Unicode grapheme-safe append ranges, while `Choreographer` on Android and `CADisplayLink` on iOS advance opacity and the optional `slideUp` glyph offset. Existing ranges keep their native start times across later appends, completed ranges are removed, and incoming append revisions are presented at most once per display frame. Reduce Motion, zero duration, corrections, completion, and resets skip the animation queue. Rich atomic renderers and inline trees containing unsupported custom components stay on the existing React Native path.

```tsx verify
import React from 'react';
import { Streamdown, createStreamingInstrumentation } from 'streamdown-native';

const metrics = createStreamingInstrumentation();

export function Measured({ content }: { content: string }) {
  return <Streamdown mode="streaming" isAnimating appendOnly streamKey="message-id" instrumentation={metrics}>{content}</Streamdown>;
}

export function snapshot() {
  return metrics.snapshot();
}
```

`bun run benchmark:host` measures parser/splitter characterization against the pinned 10 KiB corpus and rejects quadratic append growth through 512 KiB in explicit append-only mode. It cannot prove UI commit latency, dropped frames, heap growth, startup, or first render. The release protocol in `benchmarks/protocol.json` requires release Hermes on Pixel 8 and iPhone 15 hardware, raw trace attribution, the approved `streamdown-native@0.1.0` baseline on the same device, and the exact corpus SHA.

`bun run benchmark:hermes:capture -- --platform <android|ios> --device <serial-or-udid> --fixture <current-rn|expo54> --role <baseline|candidate> --pair-id <same-device-pair> --commit <git-sha> --package-sha256 <packed-tarball-sha> --core-bundle <file> --optional-bundle <file> --output benchmarks/results/<empty-run-directory>` is the fail-closed physical producer. It starts Perfetto with app tracing on a physical Pixel 8 or attaches Instruments to an idle physical iPhone 15 before triggering the candidate-bound URL, then stops on the fixture's completion marker. The fixture records parser samples around the real semantic parser, React Profiler commits, requestAnimationFrame and Choreographer/CADisplayLink intervals, append signposts, cache state, and native process memory. `heapGrowthMiB` is Android process PSS or iOS physical footprint growth—not a claim that native tooling can isolate only the Hermes heap. Bundle byte and optional-marker events are cross-checked against retained, hashed bundle inputs. The protected verifier re-extracts every retained trace and re-derives the result; a missing device, marker, primitive event, or platform tool blocks capture. Run `bun run benchmark:hermes:capture:self-test` for the fake-executor and tamper checks without hardware.

Current simulator measurements are explicitly non-reference characterization. No publishable physical-device delta exists yet. `bun run release:report` exposes that blocker rather than converting host or simulator timings into a pass.
