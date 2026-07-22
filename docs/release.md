# Release gates

There are two intentionally different gates.

`bun run ci:hosted` can run on a hosted Linux runner. It verifies locked installation, types, all Jest suites, visual artifact integrity, the pinned ledger and local pin drift, compiled documentation examples, direct runtime licenses, current production advisories, Changesets metadata, packed exports, core optional-dependency isolation, and real optional-provider Metro bundling. Valid but incomplete visual evidence is printed as blocked completeness without failing this hosted gate; corrupt, stale, missing, duplicated, or unreferenced evidence fails it.

`bun run release:verify` is the publish stop gate. It additionally requires:

- zero planned pinned parity cases;
- `tests/device/evidence.json` status `pass` with no blockers;
- reviewed iOS and Android visual manifests with every current matrix case and valid PNG hashes;
- physical-device release-Hermes performance and memory evidence;
- manual VoiceOver and TalkBack evidence;
- a release changeset.

The gate currently fails by design. Release launch is recorded for Expo 54 and Expo 56 on both iOS simulators and Android emulators. The 24 referenced PNGs per platform remain hash-valid, but the current 30-case matrix is missing six reviewed cases per platform. Real optional providers pass packed Expo 56 Release-Hermes correctness on both platforms. Physical-device profiling—including optional-provider resource budgets—and manual screen readers also remain blocked. The release workflow runs hosted checks and then this self-contained stop gate before the Changesets publish action; publish is unreachable while blockers remain.

Generate the auditable report with:

```bash
bun run release:report -- --output release-report.json
bun run visual:verify
bun run release:report:verify
bun run release:verify
```

The report includes the pinned SHA, ledger totals and dispositions, native-adaptation and known-divergence counts, compatibility evidence, benchmark characterization/delta status, visual integrity and per-platform missing case IDs, and remaining blockers. `releaseReady` requires parity, manual/device evidence, physical release-Hermes evidence, and complete visual evidence together.
