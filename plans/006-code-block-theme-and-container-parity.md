# Code block theme and container parity

## Status

- Status: DONE
- Priority: P1
- Effort: Medium
- Risk: Medium
- Depends on: `002-capability-truthful-native-actions.md` (DONE)
- Planned against: `16c1441`
- Implemented in isolated commit: `1b21beab986e4247d2d5349e8973ec25e18ac2b1`

## Problem

Code blocks currently reuse the inline-code pill style for block content, the
fixture highlighter is permanently configured for a light palette, raw fence
metadata leaks into the header, asynchronous highlights can remain pending
forever, and download filenames cover only a narrow language set. The result
does not match Streamdown's panel hierarchy or theme-aware behavior.

## Current evidence

- `src/renderers/ASTRenderer.tsx` applies `styles.code` to block tokens and
  line numbers even though that style includes an inline background, padding,
  and radius. It also renders `node.meta` verbatim.
- `src/core/types.ts` has no explicit light/dark scheme in `ThemeConfig`, and
  `src/plugins/code/index.ts` neither accepts nor caches by an active scheme.
- `fixtures/current-rn/App.js` loads both GitHub Shiki themes but always calls
  the highlighter with `github-light`.
- `src/plugins/code/index.ts` retains a pending subscriber set until the
  provider settles. A provider that never settles has no terminal cleanup, and
  a late result needs an identity guard so it cannot satisfy a newer retry.
- `src/controls/CodeControls.tsx` renders copy before download; the pinned web
  reference renders download before copy.
- `src/controls/serialization.ts` covers only a small extension set and falls
  back to `.txt`; the fallback and common native-development aliases are not
  comprehensively characterized.
- The current full Jest baseline has one unrelated failure in
  `tests/parity/ports/streamdown/pan-zoom-interaction.test.test.ts`. This plan
  must not modify or claim to fix it.

## User-visible contract

1. Inline code keeps its compact pill styling. Fenced code uses a single
   rounded panel/body surface; individual lines and line numbers do not receive
   inline-code padding or backgrounds.
2. The code header shows the language and actions in download-then-copy order.
   Existing shared `Button`/`ActionButton` primitives remain the only action
   implementation.
3. Supported metadata (`startLine=N`, `noLineNumbers`) continues to affect
   rendering, but the raw fence metadata string is not displayed. Custom
   renderers still receive the original node metadata unchanged.
4. A highlight request carries the resolved active color scheme. Switching
   scheme cannot reuse cached tokens from the previous scheme.
5. An asynchronous provider either resolves, rejects, or times out. Timeout
   releases the pending entry and leaves readable plain code. Results arriving
   after timeout or after a newer retry are ignored.
6. Common recognized languages download with deterministic extensions;
   unknown languages continue to use `.txt`.

## Public API decisions

- Add optional `colorScheme?: 'light' | 'dark'` to `ThemeConfig`. Built-in
  themes set it explicitly. Custom themes remain source-compatible; renderer
  requests use `'dark'` when it is omitted, matching the existing default
  theme.
- Add optional `colorScheme?: 'light' | 'dark'` to `HighlightOptions`. The
  renderer always supplies a resolved value, while direct callers that omit it
  remain source-compatible. The code plugin normalizes omission to `'dark'`,
  passes the value to the provider, and includes it in the cache key.
- Add optional `highlightTimeoutMs?: number` to `CodePluginOptions`, defaulting
  to `15_000`. Validate it as a positive finite integer consistently with the
  plugin's existing numeric options.
- Do not add a bundled highlighter or change the provider's ownership model.

## Implementation steps

1. Extend the theme and highlighting types with the optional scheme, set it on
   the built-in light/dark themes, and pass the resolved scheme from
   `NativeCodeBlock` to `plugin.highlight`.
2. Include the normalized scheme in the highlight cache key. Update the RN
   fixture provider to select `github-light` or `github-dark` from the request
   instead of hard-coding a palette.
3. Replace the pending subscriber set with an identity-bearing request entry,
   for example `{ subscribers, timer }`. For promise providers:
   - start one timeout per cache key;
   - on resolve, reject, or timeout, mutate state only when
     `pending.get(key) === entry`;
   - clear the timer, delete the matching entry, and notify its subscribers;
   - on timeout, notify with the readable fallback and invoke `onError` once;
   - never cache or publish a late result from an obsolete entry.
   Preserve synchronous provider behavior and request deduplication.
4. Add dedicated fenced-code text and line-number styles in
   `src/themes/index.ts`. Keep `styles.code` unchanged for inline code. Apply
   the block background/border/radius at the panel/body level only, while
   preserving horizontal scrolling and token foreground colors.
5. Remove the raw metadata label from the normal code header. Preserve the
   existing parsing of `startLine=N` and `noLineNumbers`, and do not alter the
   metadata passed to custom renderers.
6. Reorder `CodeControls` to download then copy and use existing primitive
   styling props for compact alignment/gap. Do not add a local `Pressable`,
   button, menu, or dropdown implementation.
7. Expand filename aliases to the following bounded set: `jsx`, `tsx`, `c`,
   `cpp`/`c++`, `csharp`/`c#`, `go`, `java`, `rust`/`rs`, and
   `shellscript`/`sh`. Retain all existing mappings and the `.txt` fallback.
8. Update `docs/plugins.md` to document `colorScheme`, scheme-aware providers,
   `highlightTimeoutMs`, timeout fallback, and the default behavior.
9. Add a patch changeset describing theme-aware highlighting, corrected block
   styling/header behavior, timeout cleanup, and filename improvements.

## Tests and acceptance criteria

- Plugin tests prove light and dark requests call the provider independently,
  repeated same-scheme requests still cache/dedupe, and omission defaults to
  dark.
- Timeout tests use fake timers and prove fallback notification, pending-entry
  cleanup via a successful retry, one `onError` call, and that a late obsolete
  resolution neither fills the cache nor notifies the retry's subscribers.
- Renderer/theme tests prove inline code retains pill properties while fenced
  code text and line numbers omit them; token foreground styles still render.
- Renderer tests prove `startLine` and `noLineNumbers` work without displaying
  raw metadata, and custom renderer metadata remains available.
- Controls tests prove download precedes copy without bypassing the shared
  primitives.
- Serialization tests cover every newly added alias and unknown `.txt`.
- Existing source changes, download/copy behavior, long-line scrolling, and
  accessibility tests remain green.
- No implementation file outside the scope below changes.

## Verification commands

Run from a fresh isolated worktree. First install the locked dependencies:

```sh
bun install --frozen-lockfile
bun run test --silent -- src/plugins/__tests__/code-cjk.test.tsx tests/parity/ports/streamdown/code-block-body.test.test.ts tests/parity/ports/streamdown/code-block-loading.test.test.ts
bun run test --silent -- src/controls/__tests__/serialization.test.ts src/controls/__tests__/native-controls.test.tsx tests/parity/ports/streamdown/code-block.test.test.ts
bun run type-check
bun run test:device-contract --silent
bun run docs:verify
bun run changeset:verify
bun run test --silent
```

The final full Jest run may report only the pre-existing PanZoom failure in
`tests/parity/ports/streamdown/pan-zoom-interaction.test.test.ts`. Any new or
different failure blocks completion.

## In-scope paths

- `src/core/types.ts`
- `src/themes/index.ts`
- `src/plugins/code/index.ts`
- `src/renderers/ASTRenderer.tsx`
- `src/controls/CodeControls.tsx`
- `src/controls/serialization.ts`
- `fixtures/current-rn/App.js`
- `docs/plugins.md`
- Focused tests under `src/plugins/__tests__`, `src/controls/__tests__`, and
  `tests/parity/ports/streamdown` that directly cover this contract
- One `.changeset/*.md` file

## Out of scope

- Shared `Button`, `Dropdown`, `ActionButton`, fullscreen, PanZoom, Mermaid, or
  table primitive changes
- A bundled Shiki dependency or core-owned syntax provider
- Code execution, editing, or a public cancellation/cache-control API
- Displaying arbitrary fence metadata or inventing title/filename metadata
- Porting the pinned web library's entire extension table
- Dual-theme CSS/root-style parsing; React Native selects one active palette
- Screenshot infrastructure or visual goldens, which remain plan 008

## Drift and stop conditions

- Execute from an isolated worktree branched exactly from `16c1441`.
- Before implementation, run
  `git diff --exit-code 16c1441 -- src/core/types.ts src/themes/index.ts src/plugins/code/index.ts src/renderers/ASTRenderer.tsx src/controls/CodeControls.tsx src/controls/serialization.ts fixtures/current-rn/App.js docs/plugins.md`.
  Stop if it reports drift.
- Stop if the requested UI requires changing a shared primitive API; report the
  missing prop instead of creating a code-specific wrapper.
- Preserve unrelated work and never add `benchmarks/results/`.
- Commit the completed implementation in the isolated worktree. Do not push,
  merge, or modify the primary worktree's implementation files.
