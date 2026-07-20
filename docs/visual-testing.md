# Visual testing

`tests/visual/matrix.json` defines 24 states for each platform across themes, direction, layout width, font scale, streaming checkpoints, controls, fallbacks, fullscreen, images, code, math, and Mermaid.

Reviewed baselines require both:

- `tests/visual/baselines/ios.manifest.json`
- `tests/visual/baselines/android.manifest.json`

Each manifest binds the platform/runtime, matrix hash, review ID, and PNG hashes. Baseline writes require `REVIEWED_VISUAL_BASELINE_UPDATE=1`, `BASELINE_REVIEW_ID`, and `VISUAL_RUNTIME`. Android also requires semantic hierarchy evidence; iOS capture requires Maestro. Manual VoiceOver/TalkBack remains separate.

No reviewed platform manifests currently exist, so visual comparison and publish are blocked. Unreviewed simulator screenshots are evidence of launch, not baselines.
