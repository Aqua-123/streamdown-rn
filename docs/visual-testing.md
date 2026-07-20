# Visual testing

`tests/visual/matrix.json` defines 24 states for each platform across themes, direction, layout width, font scale, streaming checkpoints, controls, fallbacks, fullscreen, images, code, math, and Mermaid.

Reviewed baselines require both:

- `tests/visual/baselines/ios.manifest.json`
- `tests/visual/baselines/android.manifest.json`

Each manifest binds the platform/runtime, matrix hash, review ID, and PNG hashes. Baseline writes require `REVIEWED_VISUAL_BASELINE_UPDATE=1`, `BASELINE_REVIEW_ID`, and `VISUAL_RUNTIME`. Android also requires semantic hierarchy evidence; iOS capture requires Maestro. Manual VoiceOver/TalkBack remains separate.

Once a complete reviewed manifest exists, set `VISUAL_CASE_ID` to recapture one reviewed case after a focused repair. The harness validates the existing matrix and preserves only verified hashes for untouched cases; it still refuses incomplete manifests.

Both manifests contain 24 reviewed baselines from the packed Expo 56 Release-Hermes fixture under review ID `codex-2026-07-20-safe-area`. Human review caught and corrected fullscreen status-bar/Dynamic-Island overlap before acceptance. Final clean comparison passed all Android cases at 0.079%-0.130% and all iOS cases at 0.007%-0.046%, below the 0.250% budget. Android asserted the native accessibility hierarchy before every capture; iOS asserted two scenario-specific elements through Maestro 2.7.0 before every capture.
