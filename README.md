# streamdown-rn

Streaming Markdown for React Native, with native semantics, incremental rendering, explicit security boundaries, and opt-in rich-content adapters.

> **Current release:** This branch documents npm `0.1.0`.

## Install

```bash
npm install streamdown-rn
npx expo install react-native-svg
```

Bare React Native apps can install the tested SVG peer directly:

```bash
npm install react-native-svg@">=15.12.1 <16.0.0"
cd ios && pod install
```

The package requires React 19 and React Native `^0.81.0 || ^0.85.0`. The host owns `react-native-svg` so Expo or React Native can select the compatible native version.

`0.1.0` requires React Native's New Architecture (Fabric). Animated prose is rendered by the package's autolinked iOS and Android text component, so Expo projects must use a development or production native build. Expo Go is not supported.

## Quick start

```tsx verify
import React from 'react';
import { Streamdown } from 'streamdown-rn';

export function Message({ markdown, done }: { markdown: string; done: boolean }) {
  return (
    <Streamdown
      mode="streaming"
      animated
      isAnimating={!done}
      isComplete={done}
      theme="dark"
    >
      {markdown}
    </Streamdown>
  );
}
```

Use `mode="static"` for complete documents. `StreamdownRN` and the default export are aliases of `Streamdown`.

## Sample app

The Expo 56 sample app exercises native `fadeIn` and `slideUp` streaming at multiple chunk rates, static rendering, themes, tables, task lists, code, math, Mermaid, CJK/RTL text, incomplete Markdown, native actions, and long-stream performance.

```bash
bun install
bun run sample:android
# or
bun run sample:ios
```

The commands launch self-contained Release/Hermes builds, so they do not depend on Metro. Each run recreates the ignored `.sample/expo56` workspace and packs the current library source, preventing stale native or JavaScript bundles from hiding local changes.

## Features

- CommonMark and GFM rendering with incomplete-stream repair and append-aware block caching.
- Native-frame `fadeIn` and `slideUp` token animation for prose, with Unicode grapheme-safe word/character segmentation and Reduce Motion support.
- Native headings, lists, tables, links, images, task controls, focus, and accessibility semantics.
- Light, dark, and custom semantic themes.
- Capability-backed clipboard, file, share, link approval, focus, announcement, and gesture actions.
- Optional `code`, `cjk`, `renderers`, `math`, `mermaid`, and `mermaid/webview` entry points.
- Typed semantic slots plus compatibility support for custom components.
- Explicit input limits, URL sanitization, and host-controlled native side effects.

## Documentation

- [API](./docs/api.md)
- [Plugins and native providers](./docs/plugins.md)
- [Migration](./docs/migration.md)
- [Parity methodology](./docs/parity.md)
- [Security](./docs/security.md)
- [Accessibility](./docs/accessibility.md)
- [Performance](./docs/performance.md)
- [Compatibility](./docs/compatibility.md)
- [Visual testing](./docs/visual-testing.md)
- [Release gates](./docs/release.md)
- [Architecture](./ARCHITECTURE.md)

## Verify

```bash
bun install --frozen-lockfile --ignore-scripts
bun run type-check
bun run test
bun run pack:verify
```

The full parity and release gates require the pinned Vercel Streamdown checkout and candidate-bound device evidence. See [release gates](./docs/release.md) for the exact process.

## Credits

This project builds on work from:

- [darkresearch/generative-ui](https://github.com/darkresearch/generative-ui), used as the original `streamdown-rn` base.
- [shadcn/ui](https://ui.shadcn.com), which informed the open-code primitive patterns and semantic theme vocabulary.
- [Base UI](https://base-ui.com), which informed the headless, composable primitive APIs.
- [Vercel Streamdown](https://github.com/vercel/streamdown), used as the pinned feature and parity baseline.
- [Software Mansion's react-native-enriched-markdown](https://github.com/software-mansion/react-native-enriched-markdown), whose MIT-licensed native tail-animation work informed the platform animation design.

Thank you to the maintainers and contributors of each project. See [NOTICE](./NOTICE) and [third-party notices](./docs/third-party.md) for license details.

## License

Apache-2.0. See [LICENSE](./LICENSE).
