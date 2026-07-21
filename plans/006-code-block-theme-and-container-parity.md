# Code block theme and container parity

## Status

- Priority: P1
- Effort: Medium
- Risk: Medium
- Depends on: `002-capability-truthful-native-actions.md`

## Problem

Code blocks currently reuse inline-code styling inside the block, the fixture highlighter is permanently configured for a light palette, raw fence metadata can leak into the header, and pending asynchronous highlights have no terminal timeout. These issues make the block look unlike the web reference, break dark-theme fidelity, and leave incomplete requests retained indefinitely.

## Evidence

- `src/renderers/ASTRenderer.tsx` applies `styles.code` to block tokens and line numbers even though that style includes inline-code background and padding.
- `fixtures/current-rn/App.js` creates the real Shiki highlighter with `github-light` regardless of active application theme.
- `src/plugins/code/index.ts` caches pending highlighter requests without a timeout or terminal cleanup when an adapter never settles.
- `src/controls/CodeControls.tsx` renders copy before download, while the live Streamdown playground presents download then copy in the code header.
- Code actions use the shared `Button`/`ActionButton` path. This plan may reorder and style those consumers but must not introduce code-block-specific press primitives.
- The extension mapping has limited coverage, and the unknown-language download behavior is not locked by a focused test.
- Current visual captures mostly prove fixture headings and do not assert the code panel's header/body hierarchy.

## Scope

- `src/plugins/code/index.ts`
- `src/renderers/ASTRenderer.tsx`
- `src/themes/index.ts`
- `src/controls/CodeControls.tsx`
- Code serialization/download helpers
- Code plugin and native renderer tests
- Current RN fixture highlighter configuration
- Package changeset

## Implementation plan

1. Add characterization tests for paired light/dark highlight requests, inline-code isolation, header action order, metadata display, known file extensions, unknown-language fallback, and a never-resolving highlighter.
2. Extend the highlighting request context with the active color scheme or resolved syntax palette. Include it in cache keys so a theme change cannot reuse tokens from the previous theme.
3. Update the fixture adapter to select matching Shiki themes from request context instead of hard-coding `github-light`. Keep the core package adapter-agnostic.
4. Separate theme tokens for inline code from block code:
   - retain pill/background treatment for inline code;
   - use neutral token text and dedicated line-number styles inside the block body;
   - apply the background and radius once at the block/container level.
5. Build a clear code hierarchy matching the reference behavior: outer rounded panel, compact language/file header, download then copy actions, and a horizontally scrollable code body. Keep both actions on the shared `Button`/`ActionButton` path and pass theme styles through existing props; do not add direct `Pressable` usage.
6. Parse only supported fence metadata into intentional UI. Do not render the raw metadata string. Preserve existing line-number options and add tests for unsupported metadata.
7. Add a bounded timeout and revision/cancellation guard for asynchronous highlighter requests. On timeout, release the pending entry and retain readable plain-code fallback; ignore late results for an obsolete source or theme.
8. Expand the extension mapping only for recognized language aliases already supported by the parser/highlighter. Keep a deterministic `.txt` fallback and test it explicitly.
9. Add a changeset covering appearance, theme switching, and download filename behavior.

## Verification

- Run focused code plugin, serialization, renderer, and control suites.
- Run `bun run type-check` and the full Jest suite.
- Exercise language-known, language-unknown, long-line, metadata, and highlighter-timeout fixtures.
- Compare light and dark fixtures to the same live Streamdown playground samples, evaluating hierarchy and behavior rather than copying browser pixel dimensions.

## Done when

- Dark and light modes request and retain the correct syntax palette.
- Block lines no longer inherit inline-code pills or padding.
- Header structure and action order match the reference behavior.
- Highlight requests always reach success, readable fallback, or timeout cleanup.
- Downloads have tested known and fallback filenames.

## Out of scope

- Adding a bundled syntax highlighter to the core package.
- Executing code or adding an editable code editor.
- Global action capability policy, owned by plan 002.
- Shared `Button`/`Dropdown` behavior; STOP and report if a missing primitive prop blocks the consumer styling instead of creating a local wrapper.
