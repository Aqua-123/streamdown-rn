# Architecture

## Runtime flow

`Streamdown` separates completed blocks from one active streaming block. Append-only updates reuse the registry and a bounded 128-entry stable-root cache. Replacement, truncation, equal-length changes, and mode transitions rebuild the affected state rather than trusting an append invariant.

The semantic pipeline is:

```text
source -> incomplete-markdown repair -> block registry -> remark/GFM MDAST
       -> security policy -> native semantic renderer -> React Native views
```

The active block reparses as text arrives. Completed blocks retain stable identities and parsed roots until an input that affects rendering changes. Instrumentation records document/stable/active parses, renders, and cache use; it does not claim UI-thread frame timing.

## Boundaries

- `src/core/` owns parsing, splitting, security, tables, and streaming state.
- `src/renderers/` maps semantic nodes to React Native and gives a configured custom language renderer precedence.
- `src/controls/` owns accessible action UI; `src/platform/` owns injectable native capabilities.
- `src/plugins/` contains separately exported code, CJK, math, Mermaid, and renderer contracts. Type-only references from core prevent optional runtime dependencies from entering the default bundle.

The default entry never imports Shiki, RaTeX, beautiful-mermaid, or react-native-webview. It does use `react-native-svg` for the exact Streamdown control-icon paths and task checkmark; Mermaid engines and SVG document rendering remain optional host-injected behavior. Packed Expo fixtures verify that boundary. Optional-provider Metro resolution is a separate bundling gate and does not prove native rendering.

## Math and Mermaid

Math parsing uses `remark-math` at the end of the portable remark pipeline. Math source remains readable when no proven native adapter exists or rendering fails. RaTeX is a host adapter candidate; its current evidence is Metro bundling only.

The native Mermaid subset routes the six families supported by the pinned provider spike—flowchart, state, sequence, class, ER, and XY—to an injected beautiful-mermaid/react-native-svg adapter. SVG crossing into native code is bounded and strictly sanitized. Other Mermaid families require the separate offline WebView controller. Its DOM stays inside a CSP-locked host surface; only a bounded surface identifier crosses the bridge, and every surface has explicit release semantics.

## Trust model

Markdown, component props, URLs, downloaded images, adapter output, and WebView messages are trust boundaries. Host-injected React components and capability implementations are trusted application code. The WebView transport is also trusted to enforce the declared CSP, asset digest, network/file/navigation denial, timeout, and teardown contract; simulator/device proof for a production transport remains a release requirement.

## Evidence

Semantic behavior is tied to the pinned upstream ledger. Host benchmarks characterize parsers only. Release-Hermes device results, reviewed PNG baselines, screen-reader checks, and physical-device traces are separate evidence classes and cannot be inferred from Jest or Metro success. See [performance](./docs/performance.md) and [release gates](./docs/release.md).
