# Compatibility

The declared peer range is React Native `^0.81.0 || ^0.85.0` with React 19.

| Host | Evidence | Status |
| --- | --- | --- |
| Expo 54 / RN 0.81.5 | packed Metro plus iOS simulator and Android emulator Release launch | passed; Android hierarchy asserted, iOS visual-only |
| Expo 56 / RN 0.85.3 | packed Metro, Release launch, and 24-case visual matrix on iOS/Android | passed; both platform hierarchies asserted in the visual matrix |
| Shiki JS engine, RaTeX, beautiful-mermaid, react-native-svg, react-native-webview | Expo 56 iOS/Android Metro bundle | bundling only |
| Pixel 8 and iPhone 15 hardware | release-Hermes performance and screen readers | blocked |

All four host/platform Release launches are recorded. The packed Expo 56 fixture additionally passed reviewed iOS and Android visual matrices with automated semantic assertions. These simulator/emulator results do not establish physical-device budgets, manual VoiceOver/TalkBack behavior, Expo 54 iOS semantics, or optional provider runtime correctness. Exact artifacts and limitations are in `tests/device/evidence.json`; run `bun run release:report` for a machine-readable summary.
