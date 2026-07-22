# Plugins and native providers

> **Current release:** Plugin entry points for npm `0.1.0`.

Plugin entry points are separate so the default bundle does not pull in optional renderer implementations.

```tsx verify
import React from 'react';
import { Text } from 'react-native';
import { Streamdown } from 'streamdown-rn';
import { createCodePlugin } from 'streamdown-rn/code';
import { cjk } from 'streamdown-rn/cjk';
import { createRendererPlugin } from 'streamdown-rn/renderers';
import { createMathPlugin } from 'streamdown-rn/math';
import { createBeautifulMermaidAdapter, createMermaidPlugin } from 'streamdown-rn/mermaid';
import { createOfflineWebViewAdapter } from 'streamdown-rn/mermaid/webview';

const code = createCodePlugin({
  highlightTimeoutMs: 15_000,
  provider: {
    languages: ['text'],
    highlight: ({ code: source, colorScheme }) => ({
      tokens: [[{ content: source, color: colorScheme === 'light' ? '#24292e' : '#c9d1d9' }]],
    }),
  },
});
const math = createMathPlugin({ adapter: { render: ({ source }) => <Text>{source}</Text> } });
const nativeMermaid = createBeautifulMermaidAdapter({
  render: async () => ({ svg: '<svg><text>diagram</text></svg>' }),
  renderSvg: (svg) => <Text>{svg}</Text>,
});
const webview = createOfflineWebViewAdapter({
  assets: { mermaidJs: 'application-bundled source' },
  transport: {
    render: async ({ id }) => JSON.stringify({ id, type: 'rendered', surfaceId: id }),
    release: () => undefined,
    dispose: () => undefined,
  },
  renderSurface: (id) => <Text>{id}</Text>,
});
const renderers = createRendererPlugin([{ language: 'log', component: ({ code: source }) => <Text>{source}</Text> }]);
const mermaid = createMermaidPlugin({ adapter: nativeMermaid, fullFidelityAdapter: webview.mermaid });

export function RichMessage() {
  return <Streamdown mode="static" plugins={{ code, cjk, math, mermaid, renderers }}>{'# ready'}</Streamdown>;
}
```

The code provider can be synchronous or asynchronous and always falls back to plain code. `HighlightOptions.colorScheme` is the resolved active `light` or `dark` scheme, so providers can select a matching palette. Custom `ThemeConfig.colorScheme` values are optional and default to `dark`. Highlights are cached per scheme. Asynchronous requests time out after `highlightTimeoutMs` (15 seconds by default), release their pending cache entry, and leave readable plain code; the option must be a positive integer. A Shiki JavaScript-regex-engine setup has Expo 56 Release-Hermes correctness evidence but is not a core dependency. Native math adapters are synchronous React renderers; RaTeX has the same simulator/emulator correctness evidence. The beautiful-mermaid adapter covers flowchart, state, sequence, class, ER, and XY syntax and normalizes its browser CSS into the strict offline native SVG subset before sanitization. `MermaidRenderRequest.theme` and `DiagramPlugin.render(source, theme?)` are optional for backward compatibility; when supplied, adapters receive the resolved `ThemeConfig`, and theme changes replace and release prior output. Unsupported Mermaid syntax must route to the separately imported offline WebView contract or remain readable source.

The WebView controller does not ship react-native-webview or executable assets. The host owns a pinned offline asset bundle, CSP enforcement, navigation/network/file denial, surface rendering, and release. Mermaid bridge requests carry an optional compact theme palette separately from `config`, so a user-selected Mermaid `config.theme` is preserved. The bridge carries only bounded status identifiers, never diagram DOM. Native Release mount and offline-load correctness pass on the pinned simulators; physical resource proof remains blocked. See [compatibility](./compatibility.md).
