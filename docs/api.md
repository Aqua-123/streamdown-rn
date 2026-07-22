# API

The root entry exports `Streamdown`, `StreamdownRN`, the default alias, skeleton primitives, controls, capability helpers, security utilities, streaming instrumentation, and public types. DOM-only Streamdown properties such as `className`, `rehypePlugins`, `prefix`, and `remarkRehypeOptions` are typed as unsupported.

```tsx verify
import React from 'react';
import {
  Streamdown,
  createStreamingInstrumentation,
  type StreamdownProps,
} from 'streamdown-rn';

const instrumentation = createStreamingInstrumentation();
const props: StreamdownProps = {
  children: '# Hello',
  mode: 'static',
  controls: { code: { copy: true, download: false }, mermaid: { panZoom: true } },
  instrumentation,
  allowedLinkSchemes: ['https', 'mailto'],
};

export function Example() {
  return <Streamdown {...props} />;
}
```

Important streaming properties are `mode`, `isAnimating`, `isComplete`, `parseIncompleteMarkdown`, `animated`, `caret`, and `reducedMotion`. `announceStreaming` is opt-in and coalesced. `components` overrides semantic native elements; `componentRegistry` serves the compact dynamic-component syntax. Consult the emitted `dist/index.d.ts` for the complete contract; `bun run docs:verify` compiles this example against that public declaration.

## Themes

`lightTheme` and `darkTheme` include complete semantic `primitives` for native surfaces, controls, and charts. The palette is precomputed to React Native-compatible hex and `rgba(...)` strings; it does not require runtime OKLCH conversion.

Custom themes keep the existing `colors`, `fonts`, and `spacing` contract. Add only the semantic values you want to override; `getTheme` and `resolveThemePrimitives` fill every missing value from the legacy palette without mutating the supplied theme.

```tsx verify
import { lightTheme, resolveThemePrimitives, type ThemeConfig } from 'streamdown-rn';

const customTheme: ThemeConfig = {
  ...lightTheme,
  primitives: { primary: '#1447e6', radius: 12 },
};

export const resolvedPrimitives = resolveThemePrimitives(customTheme);
```

## Native capabilities

Core has no clipboard or file dependency. A host supplies `NativeCapabilities`, and Streamdown hides copy or download actions when the corresponding provider is absent. Each provider returns a `CapabilityResult`: `success`, `unavailable`, `denied`, `cancelled`, or `failed` with an optional `Error`. Thrown provider errors are also shown as accessible failure feedback.

Image downloads require both `files.save` and `imageDownloads.download`. The latter receives a `NativeImageDownloadRequest` containing the final rendered URL, filename, `maxBytes`, `timeoutMs`, allowed MIME types, and `validateUrl`. The host transport must validate the initial URL and each redirect before issuing that request, enforce the byte ceiling while reading rather than after allocating the body, enforce MIME and timeout, and return a bounded `NativeFileRequest`. Without that capability the image download control is hidden. The exported `fetchImageFileRequest` keeps its original first four parameters, but now fails closed unless its fifth argument is an explicit `NativeImageDownloadCapability`; it never falls back to global `fetch`.

This Expo recipe uses real clipboard, cache-file, and system sharing APIs. Install `expo-clipboard`, `expo-file-system`, and `expo-sharing` with `npx expo install`, then pass the memoized capabilities to every Streamdown surface:

```tsx noverify
import React, { useMemo } from 'react';
import * as Clipboard from 'expo-clipboard';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import {
  Streamdown,
  type CapabilityResult,
  type NativeCapabilities,
  type NativeFileRequest,
} from 'streamdown-rn';

function failed(error: unknown): CapabilityResult {
  return { status: 'failed', error: error instanceof Error ? error : new Error(String(error)) };
}

function createCapabilities(): NativeCapabilities {
  return {
    clipboard: {
      writeText: async (text) => {
        try {
          return await Clipboard.setStringAsync(text)
            ? { status: 'success' }
            : { status: 'failed', error: new Error('Clipboard rejected the write') };
        } catch (error) {
          return failed(error);
        }
      },
    },
    files: {
      save: async ({ basename, extension, mimeType, content }: NativeFileRequest) => {
        try {
          if (!(await Sharing.isAvailableAsync())) return { status: 'unavailable' };
          const file = new File(Paths.cache, `${basename}-${Date.now()}.${extension}`);
          file.write(content);
          await Sharing.shareAsync(file.uri, {
            dialogTitle: `Save ${basename}.${extension}`,
            mimeType,
          });
          return { status: 'success' };
        } catch (error) {
          return failed(error);
        }
      },
    },
    share: {
      shareText: async (text, title) => {
        try {
          if (!(await Sharing.isAvailableAsync())) return { status: 'unavailable' };
          const file = new File(Paths.cache, `streamdown-share-${Date.now()}.txt`);
          file.write(text);
          await Sharing.shareAsync(file.uri, { dialogTitle: title, mimeType: 'text/plain' });
          return { status: 'success' };
        } catch (error) {
          return failed(error);
        }
      },
    },
  };
}

export function Message({ markdown }: { markdown: string }) {
  const capabilities = useMemo(createCapabilities, []);
  return <Streamdown mode="static" capabilities={capabilities}>{markdown}</Streamdown>;
}
```

The save provider writes only to Expo's cache and then opens the native share/save sheet, so it does not need storage permission or invent a destination. `expo-sharing` resolves without distinguishing a dismissed sheet; return `cancelled` only from an API that explicitly reports dismissal.

Mermaid pan and zoom are host-owned. Supply `capabilities.gestures.renderPanZoom` to render a two-axis pan/pinch surface from `{ children, scale, onScaleChange }`; Streamdown owns the bounded scale and accessible actions. When this provider is absent, diagram content remains untransformed and zoom controls and adjustable semantics are omitted.
