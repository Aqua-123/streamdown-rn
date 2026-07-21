# Native benchmark protocol

The release gate uses `protocol.json`, the SHA-256 of the expanded 10 KiB mixed corpus, and `result.schema.json`. The reference Android budget is p95 append-to-commit at or below 16.67 ms in a release-Hermes build on Pixel 8 hardware. Stable rerenders must remain zero and caches at or below their declared ceilings. iOS and other devices are same-device regression baselines.

`bun run benchmark:host` produces parser and splitter characterization only. It cannot satisfy React commit, JS/UI dropped-frame, heap, bundle/startup, or first-render device gates. Those require logs from the packed fixture plus Android Perfetto/System Trace or Xcode Instruments. Results must retain raw traces and identify device, OS, build type, Hermes version, corpus hash, and fixture host.

`bun run benchmark:hermes` validates paired `*-baseline` and `*-candidate` JSON files in `benchmarks/results`. Android and iOS pairs must use the same physical device, OS, packed fixture, release-Hermes build, and corpus. Each result must retain a `.log` plus an Android `.perfetto-trace` or iOS `.trace`. Absolute budgets come from `protocol.json`; measured metrics may regress at most 10% against their same-device baseline.

Environment audit on 2026-07-20: Xcode 26.5 with iOS 26.5 simulators; Android emulator 36.5.11 with a successfully booted Pixel_8_2 API 34 AVD; Node 26.0.0, Bun 1.3.14, CocoaPods 1.16.2, and Java 17.0.19. No physical reference device was connected. Manual VoiceOver and TalkBack evidence is pending and cannot be replaced by Jest accessibility assertions.

Pinned hosts are Expo 54.0.36 / RN 0.81.5 / React 19.1.0 and Expo 56.0.16 / RN 0.85.3 / React 19.2.7. The current pin follows the official [Expo SDK 56 release](https://expo.dev/changelog/sdk-56), [SDK 56 reference](https://expo.dev/sdk/56), and [React Native versions](https://reactnative.dev/versions), checked 2026-07-20.
