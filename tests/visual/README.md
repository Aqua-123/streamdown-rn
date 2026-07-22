# Visual regression evidence

`matrix.json` is executed once per platform and currently defines 30 required baselines. Each platform covers light/dark, LTR/RTL, 1.0/1.3/2.0 font scales, narrow/wide layouts, deterministic stream checkpoints, controls, fallbacks, fullscreen, and distinct image, code, math, Mermaid, and harness states.

Android and iOS baselines were captured from the packed Expo 56 Release-Hermes fixture and accepted under review ID `codex-2026-07-20-safe-area`. `capture.mjs` refuses baseline writes unless `REVIEWED_VISUAL_BASELINE_UPDATE=1`, `BASELINE_REVIEW_ID`, and `VISUAL_RUNTIME` are supplied. It writes a reviewed manifest containing the review ID, platform, device/runtime, matrix SHA-256, and every PNG SHA-256; ordinary comparison rejects stale or modified manifests. A baseline is never generated from a unit-test snapshot. Comparison failures write PNGs under `tests/visual/artifacts/`, which is ignored except in CI artifact upload.

Android capture also requires a successful accessibility hierarchy assertion. iOS capture requires `maestro`; screenshot-only output is rejected. Manual VoiceOver/TalkBack remains a separate hardware gate.

`bun run visual:verify` is device-independent. It rejects malformed or stale manifests, duplicate cases, missing or modified referenced PNGs, and unreferenced PNGs. A valid subset is reported as incomplete without being mislabeled corrupt. The current 24 reviewed artifacts per platform are valid, with six current matrix cases still requiring real capture and review.

After the complete reviewed matrix exists, `VISUAL_CASE_ID=<case-id>` may be used for a surgical baseline replacement. Partial updates still require the baseline-update review variables, validate the existing manifest and covered matrix hash, and refuse to write a manifest unless every current artifact hash remains present.
