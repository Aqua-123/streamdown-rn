# Visual testing

`tests/visual/matrix.json` defines 30 states for each platform across themes, direction, layout width, font scale, streaming checkpoints, controls, fallbacks, fullscreen, images, code, math, Mermaid, and the harness.

Reviewed baselines require both:

- `tests/visual/baselines/ios.manifest.json`
- `tests/visual/baselines/android.manifest.json`

Each manifest binds the platform/runtime, covered matrix cases, review ID, and PNG hashes. `bun run visual:verify` checks those fields, every referenced PNG and hash, duplicates, and unreferenced PNGs without a device. It exits nonzero for integrity corruption, but exits zero while listing valid missing cases so hosted CI can distinguish completeness from corruption. Baseline writes require `REVIEWED_VISUAL_BASELINE_UPDATE=1`, `BASELINE_REVIEW_ID`, and `VISUAL_RUNTIME`. Android also requires semantic hierarchy evidence; iOS capture requires Maestro. Manual VoiceOver/TalkBack remains separate.

Once a complete reviewed manifest exists, set `VISUAL_CASE_ID` to recapture one reviewed case after a focused repair. The harness validates the existing matrix and preserves only verified hashes for untouched cases; it still refuses incomplete manifests.

Both manifests contain 24 reviewed baselines from the packed Expo 56 Release-Hermes fixture under review ID `codex-2026-07-20-safe-area`. Those artifacts remain integrity-valid, but each platform is missing six current matrix cases: `controls-dark-ltr-narrow-100`, `code-supported-dark-ltr-narrow-100`, `code-supported-dark-ltr-narrow-130`, `mermaid-sequence-dark-ltr-narrow-100`, `mermaid-state-dark-ltr-narrow-100`, and `harness-closed-dark-ltr-narrow-100`. Capture and review those real states before release; do not synthesize them. Manual review and device capture remain separate from the hosted integrity check.
