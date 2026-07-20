# Visual testing

`tests/visual/matrix.json` defines 24 states for each platform across themes, direction, layout width, font scale, streaming checkpoints, controls, fallbacks, fullscreen, images, code, math, and Mermaid.

Reviewed baselines require both:

- `tests/visual/baselines/ios.manifest.json`
- `tests/visual/baselines/android.manifest.json`

Each manifest binds the platform/runtime, matrix hash, review ID, and PNG hashes. Baseline writes require `REVIEWED_VISUAL_BASELINE_UPDATE=1`, `BASELINE_REVIEW_ID`, and `VISUAL_RUNTIME`. Android also requires semantic hierarchy evidence; iOS capture requires Maestro. Manual VoiceOver/TalkBack remains separate.

The Android manifest contains 24 reviewed Release-Hermes emulator baselines. Every case also passed an immediate clean comparison at 0.001%-0.022% differing pixels, below the 0.250% budget, with a native accessibility hierarchy assertion before capture. The iOS manifest remains absent because an approved semantic runner is unavailable, so the cross-platform visual and publish gates remain blocked.
