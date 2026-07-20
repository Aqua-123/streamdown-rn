# Upstream parity ledger

`upstream.json` is the deterministic AST inventory of every statically registered test in the pinned Vercel Streamdown suites. `manifest.json` maps each case exactly once to a planned or implemented React Native assertion.

The oracle is pinned to Vercel Streamdown commit `e5deed330aa4231751a106445d93d62e4716a22f`. Refreshing preserves edited mappings by stable case ID:

```sh
bun run parity:refresh
bun run parity:validate
```

`implemented` entries must point to a real target test containing their `parity:<id>` marker. `adapted`, `browser-only`, and `known-upstream-bug` entries require evidence; browser-only exclusions cannot be a bare N/A, and known upstream bugs require both upstream and corrected-regression evidence.

Upstream drift is intentionally advisory and never rewrites the pin:

```sh
bun run parity:drift
# or inspect another checkout without network access
bun scripts/parity/check-drift.ts --candidate-root /path/to/streamdown
```

Current pinned inventory: 1,511 cases across 101 files (`streamdown` 982, `remend` 458, `streamdown-code` 22, `streamdown-cjk` 25, `streamdown-math` 10, `streamdown-mermaid` 14).
