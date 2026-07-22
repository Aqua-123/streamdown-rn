# API

> **Unreleased / next release:** This is the main-branch API. npm `0.2.1` does not export `Streamdown`; see the published example in the [README](../README.md#published-npm-021).

The root entry exports `Streamdown`, `StreamdownRN`, the default alias, skeleton primitives, controls, capability helpers, security utilities, streaming instrumentation, and public types. DOM-only Streamdown properties such as `className`, `rehypePlugins`, `prefix`, and `remarkRehypeOptions` are typed as unsupported.

## Stability before 1.0

Before `1.0.0`, minor releases may contain breaking API changes. They are documented in the changelog and Changesets; compatibility aliases receive at least one minor release of deprecation where practical. Security fixes may remove unsafe APIs immediately.

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

## UI primitives

Import UI building blocks from `streamdown-rn/ui`. `Button`, `Action`, `Toolbar`,
and the Dropdown compound parts are supported primitives. `ActionButton`,
`FullscreenModal`, `NativeLink`, and `PanZoomSurface` are compatibility
compositions; their root exports remain aliases of the same components.
Renderer-owned `CodeControls`, `TableControls`, and `SafeImage` are private and
are not exported here.

`Button` accepts static children and native view styles, or callbacks receiving
`{ pressed, focused, hovered, disabled }`. The callback contract is React
Native-specific: it deliberately does not provide DOM `asChild` or element
replacement semantics.

```tsx verify
import React from 'react';
import { Button, Dropdown, type ButtonProps, type ButtonState } from 'streamdown-rn/ui';

const triggerProps: Omit<ButtonProps, 'children'> = { accessibilityLabel: 'More actions' };
const pressedStyle = ({ pressed }: ButtonState) => ({ opacity: pressed ? 0.6 : 1 });

export function Actions() {
  return (
    <Dropdown.Root>
      <Dropdown.Trigger {...triggerProps} style={pressedStyle}>{({ pressed }) => pressed ? 'Opening' : 'More'}</Dropdown.Trigger>
      <Dropdown.Popup accessibilityLabel="More actions">
        <Dropdown.Item onSelect={() => undefined}>Retry</Dropdown.Item>
      </Dropdown.Popup>
    </Dropdown.Root>
  );
}
```

`Action.Root` owns one synchronous or asynchronous capability lifecycle;
`Action.Trigger` uses the shared Button interaction and `Action.Status` exposes
polite result feedback. `Toolbar.Root` uses React Native's supported `toolbar`
role and layout direction, and shares its disabled state with `Toolbar.Button`.
Both Roots accept typed state render props for custom descendants. Toolbar
deliberately does not claim a DOM roving-focus or arrow-key contract.

```tsx verify
import React from 'react';
import { type CapabilityResult } from 'streamdown-rn';
import { Action, Toolbar } from 'streamdown-rn/ui';

async function save(): Promise<CapabilityResult> {
  return { status: 'success' };
}

export function EditorActions() {
  return (
    <Action.Root onAction={save} successMessage="Saved">{({ busy }) => <>
      <Toolbar.Root accessibilityLabel="Editor actions">{({ orientation }) => <>
        <Action.Trigger accessibilityLabel="Save">{busy ? 'Saving…' : 'Save'}</Action.Trigger>
        <Toolbar.Button accessibilityLabel="Undo" accessibilityHint={`Toolbar orientation: ${orientation}`} onPress={() => undefined}>Undo</Toolbar.Button>
      </>}</Toolbar.Root>
      <Action.Status />
    </>}</Action.Root>
  );
}
```

Important streaming properties are `mode`, `isAnimating`, `isComplete`, `parseIncompleteMarkdown`, `animated`, `caret`, and `reducedMotion`. For long streams that are guaranteed to append, set `appendOnly` and change `streamKey` whenever a new message replaces the source; this avoids rescanning the full prior prefix while preserving an explicit reset boundary. `maxInputLength` is a positive integer ceiling over JavaScript string code units, not bytes; it defaults to 2,097,152 and applies to static input and the full cumulative stream value. Invalid values use the default. An oversized value bypasses parsing and capability invocation, calls `onError` with a `RangeError` on entry into the oversized state, and renders an accessible plain-text alert containing at most the final 2,048 code units. Dropping below the ceiling, or starting an in-limit value under a new `streamKey`, restores normal rendering. `announceStreaming` is opt-in and coalesced. `componentRegistry` serves the compact dynamic-component syntax. Consult the emitted `dist/index.d.ts` for the complete contract; `bun run docs:verify` compiles this example against that public declaration.

## Semantic slots

Prefer `slots` when styling or wrapping standard Markdown elements. A slot sees
rendered safe children and post-policy semantic values, then calls
`renderDefault` to retain native accessibility, link approval, image loading and
retry, downloads, and controls. `renderDefault` accepts only presentation
`style` and, except for images, trusted replacement `children`; it cannot replace
a URL or capability.

```tsx verify
import React from 'react';
import { Text, View } from 'react-native';
import { Streamdown, type NativeSlots } from 'streamdown-rn';

const slots: NativeSlots = {
  p: ({ children, renderDefault }) => (
    <View accessibilityLabel="markdown-paragraph">
      {renderDefault({ style: { opacity: 0.9 }, children })}
    </View>
  ),
  a: ({ children, semantic, renderDefault }) => (
    <Text accessibilityHint={`Opens ${semantic.url}`}>
      {renderDefault({ style: { fontWeight: '700' }, children })}
    </Text>
  ),
  img: ({ renderDefault }) => renderDefault({ style: { marginVertical: 8 } }),
};

export function ComposedMessage() {
  return <Streamdown mode="static" slots={slots}>{'[Safe link](https://example.com)'}</Streamdown>;
}
```

`NativeElementName` is the exact standard slot vocabulary. Custom or literal
tag names are intentionally absent; use the existing string-keyed `components`
API for those trusted host replacements. `components` replaces the library
renderer completely, so the caller owns URL handling, accessibility,
interaction, loading, retry, and controls. When both APIs target the same
standard element, legacy `components` replacement takes precedence.

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

Image downloads require both `files.save` and `imageDownloads.download`. The latter receives a `NativeImageDownloadRequest` containing the final rendered URL, filename, `maxBytes`, `timeoutMs`, allowed MIME types, and `validateUrl`. The host transport must validate the initial URL and each redirect before issuing that request, enforce the byte ceiling while reading rather than after allocating the body, enforce MIME and timeout, and return a bounded `NativeImageDownloadResult` with `Uint8Array` content. Without that capability the image download control is hidden. The exported `fetchImageFileRequest(capability, uri, basename?, maxBytes?, timeoutMs?, resourcePolicy?)` requires an explicit `NativeImageDownloadCapability` as its first argument and the renderer's `SecurityPolicyOptions` as its final argument when called outside `SafeImage`; it never falls back to global `fetch`. The policy is applied to the initial URL and every redirect through the supplied `validateUrl`. When `urlTransform` changed the initial URL, redirects are restricted to that transformed URL's origin because replaying a signing or proxy transform on an arbitrary redirect would be unsafe.

Code-block display and highlighting are capped at the first 65,536 JavaScript string code units or 2,000 lines, whichever comes first. A visible truncation notice follows the retained source. Copy and download controls still receive the complete original code, while a token provider receives only the displayed prefix; provider output above 2,001 token lines, 8,192 tokens, or the display-size ceiling falls back to bounded plain code.

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
