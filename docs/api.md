# API

The root entry exports `Streamdown`, `StreamdownRN`, the default alias, skeleton primitives, controls, capability helpers, security utilities, streaming instrumentation, and public types. DOM-only Streamdown properties such as `className`, `rehypePlugins`, `prefix`, and `remarkRehypeOptions` are typed as unsupported.

```tsx verify
import React from 'react';
import {
  Streamdown,
  createStreamingInstrumentation,
  type NativeCapabilities,
  type StreamdownProps,
} from 'streamdown-rn';

const capabilities: NativeCapabilities = {
  clipboard: { writeText: async () => ({ status: 'success' }) },
  share: { shareText: async () => ({ status: 'success' }) },
  files: { save: async () => ({ status: 'success' }) },
  links: {
    approve: async () => ({ status: 'success' }),
    open: async () => ({ status: 'success' }),
  },
};
const instrumentation = createStreamingInstrumentation();
const props: StreamdownProps = {
  children: '# Hello',
  mode: 'static',
  capabilities,
  controls: { code: { copy: true, download: false }, mermaid: { panZoom: true } },
  instrumentation,
  allowedLinkSchemes: ['https', 'mailto'],
};

export function Example() {
  return <Streamdown {...props} />;
}
```

Important streaming properties are `mode`, `isAnimating`, `isComplete`, `parseIncompleteMarkdown`, `animated`, `caret`, and `reducedMotion`. `announceStreaming` is opt-in and coalesced. `components` overrides semantic native elements; `componentRegistry` serves the compact dynamic-component syntax. Consult the emitted `dist/index.d.ts` for the complete contract; `bun run docs:verify` compiles this example against that public declaration.
