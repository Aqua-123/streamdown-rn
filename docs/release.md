# Release gates

There are two intentionally different gates.

`bun run ci:hosted` can run on a hosted Linux runner. It verifies locked installation, types, all Jest suites, the pinned ledger and local pin drift, compiled documentation examples, direct runtime licenses, current production advisories, Changesets metadata, packed exports, core optional-dependency isolation, and real optional-provider Metro bundling.

`bun run release:verify` is the publish stop gate. It additionally requires:

- zero planned pinned parity cases;
- `tests/device/evidence.json` status `pass` with no blockers;
- reviewed iOS and Android visual manifests;
- physical-device release-Hermes performance and memory evidence;
- manual VoiceOver and TalkBack evidence;
- a release changeset.

The gate currently fails by design. Release launch is recorded for Expo 54 and Expo 56 on both iOS simulators and Android emulators. Reviewed 24-case Android and iOS visual baselines and clean comparisons pass with semantic assertions. Real optional providers also pass packed Expo 56 Release-Hermes correctness on both platforms. Physical-device profiling—including optional-provider resource budgets—and manual screen readers remain blocked. The release workflow runs hosted checks and then this stop gate before the Changesets publish action; publish is unreachable while blockers remain.

Generate the auditable report with:

```bash
bun run release:report -- --output release-report.json
bun run release:report:verify
bun run release:verify
```

The report includes the pinned SHA, ledger totals and dispositions, native-adaptation and known-divergence counts, compatibility evidence, benchmark characterization/delta status, visual manifests, and remaining blockers.
