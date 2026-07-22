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
- `src/components/ui/` is the public `streamdown-rn/ui` boundary. Button and Dropdown are supported primitives; ActionButton, FullscreenModal, NativeLink, and PanZoomSurface are compatibility compositions re-exported from their existing implementations.
- `src/controls/` owns accessible action UI; `src/platform/` owns injectable native capabilities. Renderer assemblies such as CodeControls, TableControls, and SafeImage remain private.
- `src/plugins/` contains separately exported code, CJK, math, Mermaid, and renderer contracts. Type-only references from core prevent optional runtime dependencies from entering the default bundle.

The default entry never imports Shiki, RaTeX, beautiful-mermaid, or react-native-webview. It does use `react-native-svg` for the exact Streamdown control-icon paths and task checkmark; Mermaid engines and SVG document rendering remain optional host-injected behavior. Packed Expo fixtures verify that boundary. Optional-provider Metro resolution is a separate bundling gate and does not prove native rendering.

### Renderer ownership

`ASTRenderer.tsx` owns root materialization, security, direction, definitions,
and empty-footnote collection. It passes the resulting context to the one
explicit node-type switch in `nodeDispatcher.tsx`. The dispatcher owns routing
and optional custom-renderer selection; substantial state and layout live in
the cohesive `codeRenderer.tsx`, `tableRenderer.tsx`, and
`registryComponents.tsx` modules. `semanticComposition.tsx` owns semantic slot
metadata, legacy override precedence, and shared composition helpers, while
`rendererTypes.ts` contains renderer-internal contracts.

The dependency direction is facade -> dispatcher -> cohesive renderers and
semantic composition. Cohesive renderers may use semantic composition, but do
not import the dispatcher or facade. To add a semantic node, add its routing to
the dispatcher and extend semantic composition only when it introduces a slot
or shared composition rule. Keep optional provider implementations outside the
default renderer graph.

`ASTRendererProps` is the renderer option contract and `RenderContext` adds only
materialized direction, definitions, footnotes, and resolved styles. Stable,
active, and static entry paths must pass the same option set into `ASTRenderer`;
adding a renderer option therefore requires contract, propagation, memoization,
and both stable/active-path tests together. Custom language-renderer selection
belongs to the dispatcher; the public renderer plugin only constructs the typed
registry supplied through that context.

## Math and Mermaid

Math parsing uses `remark-math` at the end of the portable remark pipeline. Math source remains readable when no proven native adapter exists or rendering fails. The RaTeX host adapter has Expo 56 Release-Hermes correctness evidence on the pinned iOS simulator and Android emulator; physical-device resource budgets remain pending.

The native Mermaid subset routes the six families supported by the pinned provider spike—flowchart, state, sequence, class, ER, and XY—to an injected beautiful-mermaid/react-native-svg adapter. SVG crossing into native code is bounded and strictly sanitized. Other Mermaid families require the separate offline WebView controller. Its DOM stays inside a CSP-locked host surface; only a bounded surface identifier crosses the bridge, and every surface has explicit release semantics.

## Trust model

Markdown, component props, URLs, downloaded images, adapter output, and WebView messages are trust boundaries. Host-injected React components and capability implementations are trusted application code. The WebView transport is also trusted to enforce the declared CSP, asset digest, network/file/navigation denial, timeout, and teardown contract; simulator/device proof for a production transport remains a release requirement.

## Evidence

Semantic behavior is tied to the pinned upstream ledger. Host benchmarks characterize parsers only. Release-Hermes device results, reviewed PNG baselines, screen-reader checks, and physical-device traces are separate evidence classes and cannot be inferred from Jest or Metro success. See [performance](./docs/performance.md) and [release gates](./docs/release.md).

Evidence producers and validators remain separate trust domains. Small path,
hash, size, and symlink checks are intentionally repeated at each import
boundary rather than shared with an untrusted producer; shared helpers are
appropriate only within one validator process. A protected review attestation
is created after visual artifacts exist and binds their exact hashes, so editing
any captured artifact requires a new protected review.
