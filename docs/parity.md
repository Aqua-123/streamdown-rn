# Parity methodology

The oracle is Vercel Streamdown commit `e5deed330aa4231751a106445d93d62e4716a22f`. `parity/upstream.json` inventories 1,511 statically registered cases and hashes every source test file. `parity/manifest.json` maps every ID exactly once.

Classifications mean:

- `exact`: the same portable behavior is asserted.
- `adapted`: the native semantic equivalent is executable and its platform difference is recorded.
- `browser-only`: no native equivalent is claimed; case-specific evidence is required.
- `known-upstream-bug`: a corrected regression and upstream evidence are both required.

`implemented` exact and adapted mappings require a unique, passing, source-attested Jest case in the mapped target file with a concrete observable assertion. The current pin has 1,383 executable proofs; the remaining 126 browser-only cases and 2 known upstream bugs retain case-specific non-executable evidence. Adapted proof establishes the documented React Native semantic contract, not DOM implementation equivalence. `planned` is not a pass. Run `bun run release:report` for current totals rather than copying a stale badge into documentation.

```bash
bun run parity:validate
bun run parity:proof
bun run test:parity
bun run parity:drift
```

Drift is advisory and never rewrites the pin. A maintainer reviews additions, removals, and changed test files, deliberately updates the pinned SHA, regenerates inventory, and maps every new case before parity can be claimed. See [parity/README.md](../parity/README.md).
