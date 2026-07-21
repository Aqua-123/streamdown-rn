# Migration

## From `vercel/streamdown`

Use `Streamdown` as the component name, but replace browser concepts with native contracts:

| Web contract | React Native contract |
| --- | --- |
| DOM elements and CSS classes | `components`, `theme`, React Native styles |
| `rehypePlugins`/HAST | remark/MDAST plus native semantic overrides |
| browser clipboard/download/dialog | `capabilities` and native controls |
| KaTeX CSS | `streamdown-rn/math` host adapter |
| browser Mermaid DOM | native subset adapter or offline WebView subpath |
| browser visual snapshots | reviewed iOS and Android baselines |

Do not pass `className`, `prefix`, `rehypePlugins`, or `remarkRehypeOptions`; the public type rejects them.

## From streamdown-rn 0.1/0.2

The compact dynamic-component syntax remains `[{c:"Name",p:{...}}]`. Prefer `mode="static"` for complete documents. For streams, set `isAnimating` only while tokens are arriving and set `isComplete` when final. Native actions now require explicit capability adapters. Code highlighting is a token-provider plugin rather than an implicit Prism renderer.

Existing custom themes remain source-compatible: `ThemeConfig.colors` keeps its original meanings and `primitives` is optional. Semantic values omitted from a custom theme are derived from its legacy colors. Add partial `primitives` overrides only when a native surface needs a value distinct from that fallback; no OKLCH converter is required at runtime.

```tsx verify
import React from 'react';
import { StreamdownRN } from 'streamdown-rn';

export function Migrated({ content, pending }: { content: string; pending: boolean }) {
  return <StreamdownRN mode="streaming" isAnimating={pending} isComplete={!pending}>{content}</StreamdownRN>;
}
```
