---
"streamdown-native": patch
---

Fix native streaming text colors on iOS and Android by sending React Native processed color values through the bridge, including platform and dynamic colors; restore React Native codegen compatibility in the ESM build; and export `streamdown-native/package.json` for tooling that resolves package metadata.
