# streamdown-rn

Streaming Markdown for React Native with a native semantic renderer, append-aware block caching, explicit security policy, and opt-in rich-renderer adapters.

> **Published versus next release:** This main branch documents the next release. npm `0.2.1` does not export `Streamdown` or any plugin subpaths; use the published example below with npm installs.

This repository uses Vercel Streamdown as a pinned parity oracle, not as a claim that browser behavior is automatically native behavior. Publication requires device, accessibility, visual, and physical-device performance evidence for the exact packed candidate. See [parity status](./docs/parity.md) and [release status](./docs/release.md).

## Published npm 0.2.1

```bash
npm install streamdown-rn
```

Published `0.2.1` requires React `^19.0.0` and React Native `^0.81.0`.

```tsx verify-published
import React from 'react';
import { StreamdownRN } from 'streamdown-rn';

export function Message({ markdown }: { markdown: string }) {
  return <StreamdownRN>{markdown}</StreamdownRN>;
}
```

## Unreleased / next release

The source package requires React 19 and React Native `^0.81.0 || ^0.85.0`. Its `Streamdown`, mode, capabilities, and plugin-subpath APIs are not in npm `0.2.1`.

Expo applications must install the required SVG peer with Expo's compatible version:

```bash
npx expo install react-native-svg
```

Bare React Native applications must install `react-native-svg` `>=15.12.1 <16.0.0` and complete its platform setup:

```bash
npm install react-native-svg@">=15.12.1 <16.0.0"
cd ios && pod install
```

The host owns this single native dependency so its version matches the app's Expo or React Native runtime. Core controls and task-list checkmarks use it, so it is required even when optional Mermaid rendering is disabled.

```tsx verify
import React from 'react';
import { Streamdown } from 'streamdown-rn';

export function Message({ markdown, done }: { markdown: string; done: boolean }) {
  return <Streamdown mode="streaming" isAnimating={!done} isComplete={done} theme="dark">{markdown}</Streamdown>;
}
```

`StreamdownRN` and the default export are aliases of `Streamdown` in the next release. Static content should use `mode="static"`. Code highlighting, native math, native Mermaid SVG, and full-fidelity WebView rendering are optional host integrations; they are not bundled into the core entry.

`maxInputLength` limits both static input and the cumulative value of a stream. It defaults to 2,097,152 JavaScript string code units. Oversized input is not parsed: `onError` receives a `RangeError` and the renderer shows an alert containing only the final 2,048 code units, prefixed by an ellipsis when text was omitted. Rendering resumes normally when the value returns below the limit or a new `streamKey` begins within it.

## Next-release features

- CommonMark/GFM semantic rendering, incomplete-stream repair, stable block caching, direction detection, footnotes, tables, task lists, links, and images.
- Capability-backed clipboard, file, share, link approval, focus, announcement, and gesture actions. Controls for unavailable capabilities are hidden; failures from an invoked provider are announced and shown visibly.
- Typed `slots` compose around safe native semantic defaults. Legacy `components` remains a caller-owned full replacement, and `[{c:"Name",p:{...}}]` keeps its separate component registry.
- Separate `code`, `cjk`, `renderers`, `math`, `mermaid`, and `mermaid/webview` entry points. Core Metro bundles are tested for optional-renderer isolation.

## Documentation

The following pages describe unreleased main-branch source unless they explicitly say otherwise.

- [API](./docs/api.md)
- [Plugins and optional native providers](./docs/plugins.md)
- [Migration from web Streamdown and older streamdown-rn](./docs/migration.md)
- [Parity methodology](./docs/parity.md)
- [Security boundaries](./docs/security.md)
- [Security reporting policy](./SECURITY.md)
- [Accessibility](./docs/accessibility.md)
- [Performance protocol](./docs/performance.md)
- [Compatibility](./docs/compatibility.md)
- [Visual testing](./docs/visual-testing.md)
- [Release gates](./docs/release.md)
- [Architecture](./ARCHITECTURE.md)

## Verify

```bash
bun install --frozen-lockfile --ignore-scripts
git clone https://github.com/vercel/streamdown.git .reference/streamdown
git -C .reference/streamdown checkout --detach e5deed330aa4231751a106445d93d62e4716a22f
bun run ci:hosted
bun run release:report
```

`ci:hosted` proves the source, semantic tests, pinned ledger, documentation examples, direct runtime licenses, packed exports, and core bundle isolation. It does not substitute for the manual/hardware gates. `bun run release:verify` intentionally exits non-zero while those gates remain blocked.

## Stability before 1.0

Before `1.0.0`, minor releases may contain breaking API changes. Such changes are documented in the changelog and Changesets; compatibility aliases receive at least one minor release of deprecation where practical. A security fix may remove an unsafe API without that deprecation period.

## License and attribution

Apache-2.0. The parity inventory derives test names and layout from Vercel Streamdown at the exact SHA in `parity/upstream.json`; the upstream source snapshot is not published in this package. See [NOTICE](./NOTICE) and [third-party notices](./docs/third-party.md).
