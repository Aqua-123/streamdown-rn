# Compatibility

The declared peer range is React Native `^0.81.0 || ^0.85.0` with React 19. The host must also provide one `react-native-svg` version in the tested `>=15.12.1 <16.0.0` range: Expo SDK 54 uses 15.12.1 and the current Expo fixture uses 15.15.5.

The New Architecture is required. The package autolinks a Codegen/Fabric component for prose layout and streaming animation on both platforms. Expo applications therefore need a development build, `expo run:*`, EAS build, or another native build that includes the package; Expo Go cannot load it. After adding or upgrading the package, regenerate native projects as appropriate and run CocoaPods on iOS.

| Host | Evidence | Status |
| --- | --- | --- |
| Expo 54 / RN 0.81.5 | packed Metro plus iOS simulator and Android emulator Release launch | passed; Android hierarchy asserted, iOS visual-only |
| Expo 56 / RN 0.85.3 | packed Metro, Release launch, and 24-case visual matrix on iOS/Android | passed; both platform hierarchies asserted in the visual matrix |
| Shiki JS engine, RaTeX, beautiful-mermaid, react-native-svg, react-native-webview | Expo 56 / RN 0.85 iOS and Android Release-Hermes | simulator/emulator correctness passed; physical resource budgets pending |
| Pixel 8 and iPhone 15 hardware | release-Hermes performance and screen readers | blocked |

All four host/platform Release launches are recorded. The packed Expo 56 fixture additionally passed reviewed iOS and Android visual matrices with automated semantic assertions. A separate packed Release-Hermes fixture rendered real Shiki, RaTeX, beautiful-mermaid/react-native-svg, and WebView providers with provider-completion assertions on both platforms. These simulator/emulator results do not establish physical-device budgets, manual VoiceOver/TalkBack behavior, or Expo 54 iOS semantics. Exact artifacts and limitations are in `tests/device/evidence.json`; run `bun run release:report` for a machine-readable summary.

Passing release evidence must identify the exact candidate commit and packed-tarball SHA-256. Its `coverage` array must contain one unique passed entry for every `<host>:<platform>:<scenario>` combination in `tests/device/matrix.json`, plus each required `manual:<platform>:<scenario>` screen-reader check. Every entry must reference its own non-empty result artifact under `tests/device/results` or `tests/visual/baselines`; the evidence file records each artifact SHA-256. Each schema-version-1 result repeats the coverage ID, host, platform, scenario, release/Hermes environment, evidence type, and candidate identity, reports `passed`, and retains at least one independently hashed raw artifact. Symlinks, paths outside those directories, duplicate coverage IDs, reused paths or content hashes, stale candidate identities, and missing matrix cases block publication.
