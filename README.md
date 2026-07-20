# streamdown-rn

Streaming Markdown for React Native with a native semantic renderer, append-aware block caching, explicit security policy, and opt-in rich-renderer adapters.

This repository uses Vercel Streamdown as a pinned parity oracle, not as a claim that browser behavior is automatically native behavior. The current release gate is blocked until every planned parity case and the required device, accessibility, visual, and physical-device performance evidence are complete. See [parity status](./docs/parity.md) and [release status](./docs/release.md).

## Install

```bash
npm install streamdown-rn
```

Required peers are React 19 and React Native `^0.81.0 || ^0.85.0`. Code highlighting, native math, native Mermaid SVG, and full-fidelity WebView rendering are optional host integrations; they are not bundled into the core entry.

## Use

```tsx verify
import React from 'react';
import { Streamdown } from 'streamdown-rn';

export function Message({ markdown, done }: { markdown: string; done: boolean }) {
  return (
    <Streamdown mode="streaming" isAnimating={!done} isComplete={done} theme="dark">
      {markdown}
    </Streamdown>
  );
}
```

`StreamdownRN` and the default export are aliases of `Streamdown`. Static content should use `mode="static"`.

## What is included

- CommonMark/GFM semantic rendering, incomplete-stream repair, stable block caching, direction detection, footnotes, tables, task lists, links, and images.
- Capability-backed clipboard, file, share, link approval, focus, announcement, and gesture actions. Unavailable native capabilities fail visibly instead of silently.
- Custom native semantic components and the existing `[{c:"Name",p:{...}}]` component registry syntax.
- Separate `code`, `cjk`, `renderers`, `math`, `mermaid`, and `mermaid/webview` entry points. Core Metro bundles are tested for optional-renderer isolation.

## Documentation

- [API](./docs/api.md)
- [Plugins and optional native providers](./docs/plugins.md)
- [Migration from web Streamdown and older streamdown-rn](./docs/migration.md)
- [Parity methodology](./docs/parity.md)
- [Security boundaries](./docs/security.md)
- [Accessibility](./docs/accessibility.md)
- [Performance protocol](./docs/performance.md)
- [Compatibility](./docs/compatibility.md)
- [Visual testing](./docs/visual-testing.md)
- [Release gates](./docs/release.md)
- [Architecture](./ARCHITECTURE.md)

## Verify

```bash
bun install --frozen-lockfile
bun run ci:hosted
bun run release:report
```

`ci:hosted` proves the source, semantic tests, pinned ledger, documentation examples, direct runtime licenses, packed exports, and core bundle isolation. It does not substitute for the manual/hardware gates. `bun run release:verify` intentionally exits non-zero while those gates remain blocked.

## License and attribution

Apache-2.0. The parity inventory derives test names and layout from Vercel Streamdown at the exact SHA in `parity/upstream.json`; the upstream source snapshot is not published in this package. See [NOTICE](./NOTICE) and [third-party notices](./docs/third-party.md).
