# Contributing

Use Node 20.19.4 or newer and Bun 1.3.14. Install the locked dependency graph without lifecycle scripts:

```bash
bun install --frozen-lockfile --ignore-scripts
```

Before running the complete hosted gate, restore the pinned upstream parity oracle:

```bash
git clone https://github.com/vercel/streamdown.git .reference/streamdown
git -C .reference/streamdown checkout e5deed330aa4231751a106445d93d62e4716a22f
```

For ordinary changes, run the focused Jest suites first, followed by `bun run lint`, `bun run type-check`, and `bun run test`. On macOS or Linux, run `bun run ci:hosted` before requesting review. The checksum-pinned Actionlint bootstrap used by that aggregate command is not available on Windows; Windows contributors can run the portable checks with `bun run lint && bun run type-check && bun run test` and rely on the Linux hosted gate for workflow lint and package fixtures. Add or update a Changeset when the packaged behavior or public API changes.

Parity case IDs and their pinned upstream mapping are evidence, not generated decoration. Update them only when the upstream pin or the demonstrated implementation changes, and keep every executable mapping backed by its case-specific proof.

Do not hand-edit PNG hashes, capture receipts, protected review attestations, device-result claims, benchmark results, or release reports. Schema-2 visual manifests come only from `tests/visual/capture.mjs`; capture invalidates the old attestation, and the protected `release-evidence` job creates a new candidate-bound attestation after environment approval. Physical-device performance evidence is created on the protected evidence runner and independently verified by the release workflow. These maintainer-only publication gates are expected to remain blocked on normal contributor machines; never weaken them to make a pull request green.

Keep changes focused and preserve unrelated work already present in the checkout. Security-sensitive reports should use the private process in [SECURITY.md](./SECURITY.md), not a public issue.
