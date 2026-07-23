# Release gates

## Maintainer flow

1. Add a release note in every user-visible pull request with `bun run changeset`; choose patch, minor, or major and write the changelog entry in user-facing language.
2. Merge the pull request only after `Hosted gates / verify` passes. A push to `main` automatically creates or updates the Changesets version pull request.
3. Review and merge the version pull request. Changesets updates `package.json`, `CHANGELOG.md`, and the promoted versioned documentation; maintainers do not edit release versions by hand.
4. Capture and approve the exact commit's physical-device evidence through the protected `Release evidence` workflow.
5. Manually dispatch `Release` with that successful evidence run ID. If the dedicated evidence runner is unavailable, the maintainer may instead explicitly attest completed physical iOS and Android verification with the `hardware_verified` input. After all remaining stop gates pass, approve the protected `npm` environment deployment.
6. The workflow publishes the sealed tarball through npm trusted publishing, then creates the matching `v<version>` tag and GitHub release. No local machine or long-lived npm write token publishes production releases.

Use `bun run changeset:status` to inspect pending release intent and `bun run release:report -- --output release-report.json` to inspect release readiness.

There are two intentionally different gates.

`bun run ci:hosted` can run on a hosted Linux runner. It verifies locked installation, types, all Jest suites, visual artifact integrity, the pinned ledger and local pin drift, compiled documentation examples, direct runtime licenses, all dependency advisories (including build tooling), Changesets metadata, packed exports, core optional-dependency isolation, and real optional-provider Metro bundling. Valid but incomplete visual evidence is printed as blocked completeness without failing this hosted gate; corrupt, stale, missing, duplicated, or unreferenced evidence fails it.

`bun run release:verify` is the publish stop gate. It additionally requires:

- zero planned pinned parity cases;
- `tests/device/evidence.json` status `pass` with no blockers;
- reviewed iOS and Android visual manifests with every current matrix case and valid PNG hashes;
- physical-device release-Hermes performance and memory evidence;
- manual VoiceOver and TalkBack evidence;
- a pending Changeset before versioning, or a matching changelog entry after versioning.

The repository snapshot does not treat its checked-in simulator evidence as a publish pass. It records Expo 54 and Expo 56 launches on both iOS simulators and Android emulators, 24 hash-valid legacy PNGs per platform with six current matrix cases absent, and packed Expo 56 Release-Hermes correctness for real optional providers. A release must replace those gaps with candidate-bound protected evidence for physical-device profiling, complete schema-2 visuals, and manual screen readers; the report states the live result instead of this document making a lasting pass/fail claim.

Releases have two phases. While pending Changesets exist, every push to `main` can only create or update the version pull request and receives no npm identity. `changeset:version` also promotes the README, API, plugin documentation, and changelog to the new version; it removes the development-only changelog status rather than shipping stale `Unreleased` or `publishing blocked` claims. Missing transition markers fail the version job instead of producing a broken pull request, and repeating promotion for the same version is a no-op. After that pull request is merged, a manual dispatch builds one tarball, verifies hosted and hardware gates against its SHA-256, and uploads that exact tarball. A minimal environment-protected job receives OIDC only after verification and publishes only the downloaded, hash-checked artifact. Publish is unreachable while blockers remain. Successful publication creates the matching GitHub tag and release. After publishing, run `bun run docs:reopen-next` once in the next development change to restore the published-versus-next README and an empty changelog `Unreleased` section. Reopening and the next promotion are also idempotent and covered by the documentation self-test.

Publishing is restricted to `main`, serialized by workflow concurrency, and uses npm trusted publishing with GitHub OIDC instead of a long-lived write token. Before the first release from this repository and pipeline, the npm package owner must configure `Aqua-123/streamdown-rn` and `.github/workflows/release.yml` as the package's trusted GitHub publisher, and the GitHub `npm` environment must require an explicit reviewer. Keep the repository URL in `package.json` identical to the trusted-publisher repository.

Repository code cannot complete the remaining control-plane setup. Before making the repository public, the owner must confirm npm ownership or choose a new package name, configure the trusted publisher above, protect `main`, require the hosted checks, create protected `npm` and `release-evidence` environments with reviewers, restrict the self-hosted evidence runner group to the evidence workflow, and enable and test GitHub private vulnerability reporting. Record these as external release evidence; do not represent a local passing command as proof that they exist.

The post-version release dispatch requires the Actions run ID from the protected `Release evidence` workflow plus the approved `streamdown-native@0.1.0` commit and tarball SHA-256 used as the performance baseline. Its self-hosted runner imports `benchmarks/results`, `tests/device/evidence.json`, `tests/device/results`, and `tests/visual/baselines` from the structured `/opt/streamdown-rn-evidence` directory, reproduces the candidate tarball with the same pinned Node and npm versions, validates performance, compatibility, visual, and raw artifacts, and uploads those paths as `release-evidence`. Visual capture manifests must be schema 2 and contain candidate-bound tool receipts without reviewer claims; after artifact import, the protected `validate` job generates `release-review-attestation.json`, which hashes the immutable matrix/manifests/PNGs and records the workflow run. Android traces must parse with Perfetto's trace processor and iOS trace bundles must export a table of contents with `xctrace`; missing validators, malformed traces, symlinks, and oversized evidence fail closed. Configure the `release-evidence` GitHub environment with a required reviewer and restrict its self-hosted runner group to this workflow. The publishing workflow accepts only a successful manual evidence run on `main` for the same commit. Every result records the exact tested git commit and packed-tarball SHA-256; the baseline must match the immutable owned prior release. Raw and compatibility artifacts are confined to their evidence directories, carry SHA-256 values, cannot be reused across runs, and performance candidates expire after 30 days. Ignored workstation files are never accepted implicitly.

Generate the auditable report with:

```bash
bun run release:report -- --output release-report.json
bun run visual:verify
bun run release:report:verify
bun run release:verify
```

The report includes the pinned SHA, ledger totals and dispositions, native-adaptation and known-divergence counts, compatibility evidence, benchmark characterization/delta status, visual integrity and per-platform missing case IDs, and remaining blockers. `releaseReady` requires parity, manual/device evidence, physical release-Hermes evidence, and complete visual evidence together.
