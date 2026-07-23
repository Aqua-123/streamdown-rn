# streamdown-native

## 0.1.2

### Patch Changes

- 4f1cd52: Fix native streaming text colors on iOS and Android by sending React Native processed color values through the bridge, including platform and dynamic colors; restore React Native codegen compatibility in the ESM build; and export `streamdown-native/package.json` for tooling that resolves package metadata.

## 0.1.1

### Patch Changes

- fe1e9b8: Show a temporary checkmark after successful code, table, and Mermaid copies.

## 0.1.0

Initial release of the native Streamdown renderer, including Fabric-driven `fadeIn` and `slideUp` streaming prose, streaming Markdown repair and caching, semantic React Native output, themes, accessibility and security boundaries, host capabilities, optional code/CJK/math/Mermaid renderers, the Expo sample app, and parity/release verification tooling. Animated prose requires React Native's New Architecture and a native development or production build; Expo Go is not supported.
