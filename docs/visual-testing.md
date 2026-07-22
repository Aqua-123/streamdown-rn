# Visual testing

`tests/visual/matrix.json` defines 30 states for each platform across themes, direction, layout width, font scale, streaming checkpoints, controls, fallbacks, fullscreen, images, code, math, Mermaid, and the harness.

Reviewed baselines require both:

- `tests/visual/baselines/ios.manifest.json`
- `tests/visual/baselines/android.manifest.json`

`tests/visual/capture.mjs` writes schema-2 manifests. Each manifest binds the candidate commit and tarball SHA-256, platform, device/runtime, complete matrix, PNG hashes, and tool-generated capture and semantic receipts. It deliberately contains no reviewer name or decision. A full capture requires `REVIEWED_VISUAL_BASELINE_UPDATE=1`, `VISUAL_PLATFORM`, `VISUAL_DEVICE_ID`, `VISUAL_APP_SCHEME`, `VISUAL_APP_ID`, `VISUAL_RUNTIME`, `STREAMDOWN_RELEASE_COMMIT`, and `STREAMDOWN_RELEASE_PACKAGE_SHA256`; Android uses `adb`/UIAutomator and iOS uses `simctl` plus Maestro. Any capture removes the prior review attestation.

Review happens only after capture. The protected `release-evidence` workflow imports the completed artifacts for the exact candidate, waits for the GitHub `release-evidence` environment approval, then runs `tests/visual/attest.mjs` in its `validate` job. That immutable attestation hashes the matrix, both manifests, and every PNG and records the protected workflow provenance. Reviewer strings or a locally written attestation cannot satisfy the release gate. `bun run visual:verify` checks manifest and PNG integrity without a device; release verification additionally requires the matching protected-workflow attestation. Integrity failures exit nonzero, while a valid subset is reported as incomplete.

Once a complete schema-2 manifest exists, set `VISUAL_CASE_ID` to recapture one case after a focused repair. The harness validates the existing complete matrix and receipts and preserves verified entries for untouched cases; it still removes the old attestation, so the complete artifact set must pass the protected review again.

Both checked-in manifests are legacy hash-only evidence from the packed Expo 56 Release-Hermes fixture under review ID `codex-2026-07-20-safe-area`; they predate the current capture-receipt and reviewer-attestation contract and cannot satisfy the publish gate. Their 24 PNGs per platform remain integrity-valid, but each platform is also missing six current matrix cases: `controls-dark-ltr-narrow-100`, `code-supported-dark-ltr-narrow-100`, `code-supported-dark-ltr-narrow-130`, `mermaid-sequence-dark-ltr-narrow-100`, `mermaid-state-dark-ltr-narrow-100`, and `harness-closed-dark-ltr-narrow-100`. Recapture and independently review every required real state under the current contract before release; do not synthesize them. Manual review and device capture remain separate from the hosted integrity check.
