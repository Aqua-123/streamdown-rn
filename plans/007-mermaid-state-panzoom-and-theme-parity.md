# Plan 007: Complete Mermaid family, theme, and pan/zoom parity

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If a
> STOP condition occurs, stop and report instead of improvising. A reviewer
> maintains `plans/README.md`; do not edit plan files.
>
> **Drift check (run first)**:
> `git diff --exit-code 2ad4cdd -- src/plugins/mermaid/index.ts src/plugins/mermaid/MermaidBlock.tsx src/plugins/mermaid/webview/index.ts src/controls/PanZoomSurface.tsx src/platform/capabilities.ts fixtures/current-rn/App.js docs/api.md docs/plugins.md`
> Any output is a STOP condition.

## Status

- **Status**: DONE
- **Priority**: P1
- **Effort**: L
- **Risk**: MED
- **Depends on**: plans 001 and 004 (DONE)
- **Category**: bug/UI
- **Planned at**: commit `2ad4cdd`, 2026-07-21
- **Implemented in isolated commit**: `a468dcbe8688356ca7c71f18015486172bad9804`

## Why this matters

The current basic flowchart path works, but valid Mermaid sources with leading
comments or directives can be misclassified, native SVG colors are fixed to a
light palette, and a theme change does not trigger a new adapter request. The
default pan/zoom UI also exposes zoom without any way to pan when the host did
not supply a gesture adapter, and its absolute toolbar covers diagram content.
This plan makes the adapter contract theme-aware and the optional gesture UI
truthful without bundling a renderer or gesture dependency.

## Current state

- `src/plugins/mermaid/index.ts`
  - `MermaidRenderRequest` contains only `source`, `family`, and `config`.
  - `detectMermaidFamily` reads the first trimmed token, so a leading `%%`
    comment/directive or frontmatter prevents correct routing.
  - `normalizeBeautifulMermaidSvg` replaces CSS variables with the fixed
    light-only `BEAUTIFUL_MERMAID_COLORS` table.
  - `DiagramPlugin.render` accepts only `source`.
- `src/plugins/mermaid/MermaidBlock.tsx`
  - calls `plugin.render(source)` and its render effect does not depend on the
    active theme;
  - deliberately retains the previous visual while the next source renders,
    although downloads are already hidden for a mismatched source;
  - already uses the shared download `Dropdown`, `ActionButton`, and the shared
    `FullscreenModal` canvas mode. Preserve those boundaries.
- `src/controls/PanZoomSurface.tsx`
  - applies a scale transform even when `capabilities.gestures` is absent, so
    enlarged content is clipped with no two-axis pan path;
  - always renders adjustable semantics and zoom buttons;
  - positions a hard-coded light vertical toolbar absolutely over the content.
- `src/platform/capabilities.ts` defines `renderPanZoom`. The injected host
  owns native two-axis pan/pinch behavior; core owns bounded scale state and
  action accessibility.
- `fixtures/current-rn/App.js` already includes flowchart, sequence, and state
  scenarios, but its `beautiful-mermaid` provider always renders with a fixed
  light palette.
- Current focused baseline: 24 Mermaid/fullscreen tests pass and the one
  `pan-zoom-interaction` toolbar-layout test fails. The full suite has the same
  single failure.

## Public contract decisions

1. Add `theme?: ThemeConfig` to `MermaidRenderRequest` and allow
   `DiagramPlugin.render(source, theme?)`. Both are optional so direct callers
   and third-party adapters remain source-compatible.
2. `MermaidBlock` always passes its resolved `ThemeConfig`. The request object
   sent to either the native adapter or full-fidelity adapter contains the
   theme unchanged; adapters may select their renderer-specific palette.
3. `normalizeBeautifulMermaidSvg(svg, theme?)` accepts the same optional theme.
   Omission retains the current light constants for direct-call compatibility.
   When present, map variables only to existing theme tokens:
   - background/group fill -> `colors.background`;
   - foreground/text/arrow -> `colors.foreground`;
   - secondary/muted/faint text and lines -> `colors.muted`;
   - node/group-header fill -> `colors.codeBackground`;
   - strokes/badges -> `colors.border`.
4. The offline WebView bridge receives an optional compact theme value derived
   from the request (`colorScheme`, background, foreground, muted, border,
   surface, and mono font). Do not overwrite the user's Mermaid `config.theme`;
   the trusted transport decides how to apply the separate host theme.
5. Pan/zoom controls and adjustable semantics render only when
   `capabilities.gestures?.renderPanZoom` exists. Without it, render children at
   neutral scale with no false zoom affordance. Do not add a partial ScrollView
   or transform fallback.

## Scope

**In scope** (only these files may change):

- `src/plugins/mermaid/index.ts`
- `src/plugins/mermaid/MermaidBlock.tsx`
- `src/plugins/mermaid/webview/index.ts`
- `src/controls/PanZoomSurface.tsx`
- `src/platform/capabilities.ts`
- `fixtures/current-rn/App.js`
- `docs/api.md`
- `docs/plugins.md`
- `src/plugins/__tests__/mermaid.test.tsx`
- `src/plugins/__tests__/mermaid-webview.test.ts`
- `src/controls/__tests__/translations-icons-panzoom.test.tsx`
- Mermaid and pan/zoom tests under `tests/parity/ports/streamdown/`
- One `.changeset/*.md` patch file

**Out of scope**:

- Shared `Button`, `Dropdown`, `ActionButton`, or `FullscreenModal` changes
- Mermaid copy/download formats and capability adapters
- Adding `react-native-gesture-handler`, Reanimated, Mermaid, WebView, or any
  other dependency
- Implementing a core PanResponder, pinch recognizer, or incomplete two-axis
  scrolling fallback
- Table, code, math, parser, visual-baseline, or screenshot infrastructure
- Pixel-identical SVG output or replacing the host-owned renderer
- Changes to the fixture's dependency manifest or lockfile

## Git workflow

- Create isolated branch `codex/007-mermaid-state-panzoom-theme` from exactly
  `2ad4cdd`.
- Run `bun install --frozen-lockfile` in the isolated worktree before tests.
- Use one conventional commit such as
  `fix(mermaid): align theme and pan zoom behavior`.
- Do not push, merge, amend, or touch the primary worktree.
- Never stage `benchmarks/results/`.

## Steps

### Step 1: Route valid sources through the correct adapter

In `detectMermaidFamily`, inspect a derived detection view while preserving the
original `source` everywhere else. Skip only:

- leading whitespace;
- complete leading `%%` comment lines, including one-line `%%{...}%%`
  directives;
- one complete leading Mermaid/YAML frontmatter block delimited by lines that
  contain only `---`.

Do not parse or apply directive/frontmatter configuration in core. An
unterminated frontmatter block remains `invalid`. Add table-driven tests for
flowchart, `stateDiagram-v2`, and `sequenceDiagram` after each supported prefix,
plus unterminated and non-leading cases. Assert the adapter still receives the
byte-for-byte original source.

**Verify**:
`bun run test --silent -- src/plugins/__tests__/mermaid.test.tsx` -> all tests
pass.

### Step 2: Make every Mermaid adapter request theme-aware

Add the optional theme contract described above. Pass the active theme from
`MermaidBlock`, include the theme in the effect identity, and send it through
`createMermaidPlugin` to whichever adapter is selected. Keep `config` security
normalization unchanged.

At the start of every new source/theme/retry request, clear and release the
previous rendered result before starting the next render. The existing `active`
guard must continue to release late obsolete results and prevent them from
reappearing. Track freshness by the complete active request, not source alone,
so stale SVG/PNG downloads are never exposed during a theme switch.

Update the offline WebView request with the compact optional theme fields from
the public-contract section. Do not merge them into `config` and do not loosen
CSP, navigation, message-size, or sanitization behavior.

Tests must prove:

- light and dark rerenders issue distinct adapter requests;
- the previous visual disappears and its `release` runs exactly once;
- a late first request cannot replace the second request;
- download items do not expose the obsolete theme result;
- custom `config.theme` remains intact;
- the WebView transport receives theme context without any security-field
  regression.

**Verify**:
`bun run test --silent -- src/plugins/__tests__/mermaid.test.tsx src/plugins/__tests__/mermaid-webview.test.ts tests/parity/ports/streamdown/mermaid-download.test.test.ts tests/parity/ports/streamdown/mermaid-component.test.test.ts` -> all pass.

### Step 3: Resolve native SVG variables from the active theme

Use the existing sanitizer/normalizer path; do not add a second SVG rewrite.
Derive the variable table from the request theme in
`createBeautifulMermaidAdapter` and keep the fixed current table as the
no-theme default. Update the RN fixture provider to select its
`beautiful-mermaid` palette from `request.theme.colors`, with the existing
literal colors only as the direct-call fallback.

Add a paired light/dark test over the same SVG input. Assert exact token colors
for background, foreground, muted text, node fill, and stroke, and rerun all
malicious SVG cases to prove sanitization is unchanged.

**Verify**:
`bun run test --silent -- src/plugins/__tests__/mermaid.test.tsx tests/parity/ports/streamdown/mermaid.test.test.ts tests/parity/ports/streamdown/mermaid-utils.test.test.ts` -> all pass.

### Step 4: Make the pan/zoom surface capability-truthful and in-flow

Reuse the existing `ActionButton`; do not introduce another control component.
When a gesture provider exists:

- retain bounded scale state, accessibility increment/decrement actions, and
  reset behavior;
- call the provider with `children`, `scale`, and the bounded
  `onScaleChange` callback;
- place the zoom-in, zoom-out, and reset toolbar after the content in normal
  layout flow with `flexDirection: 'row'`;
- accept optional toolbar `backgroundColor` and `borderColor` props and pass
  the active Mermaid theme tokens from `MermaidBlock`;
- preserve 44-point action targets through the shared button path.

When the provider is absent, render only untransformed children: no toolbar,
no adjustable node, and no scale transform. `showControls={false}` hides the
toolbar but retains adjustable semantics only when the provider exists.

Update all affected tests that previously assumed zoom existed without a
provider. Preserve their parity markers while giving provider-present tests a
minimal fake adapter. Add explicit provider-absent assertions and prove the
toolbar has no absolute-position properties.

**Verify**:
`bun run test --silent -- src/controls/__tests__/translations-icons-panzoom.test.tsx tests/parity/ports/streamdown/pan-zoom.test.test.ts tests/parity/ports/streamdown/pan-zoom-interaction.test.test.ts tests/parity/ports/streamdown/final-coverage.test.test.ts` -> all pass, including the previously failing placement test.

### Step 5: Preserve shared fullscreen behavior and document the seam

Keep `FullscreenModal contentMode="canvas"` and the download dropdown unchanged.
Add/adjust tests proving inline and fullscreen Mermaid content both use the
gesture adapter when present, controls remain below the content, and closing
fullscreen remains functional. Update `docs/api.md` and `docs/plugins.md` to
explain the optional theme request, host-owned gesture/pan responsibility, and
the no-provider behavior. Add one patch changeset.

**Verify**:
`bun run test --silent -- tests/parity/ports/streamdown/mermaid-fullscreen.test.test.ts tests/parity/ports/streamdown/scroll-lock.test.test.ts tests/parity/ports/streamdown/mermaid.test.test.ts` -> all pass.

## Final verification

Run every command; do not substitute partial results:

```sh
bun run test --silent -- src/plugins/__tests__/mermaid.test.tsx src/plugins/__tests__/mermaid-webview.test.ts src/controls/__tests__/translations-icons-panzoom.test.tsx tests/parity/ports/streamdown/mermaid.test.test.ts tests/parity/ports/streamdown/mermaid-component.test.test.ts tests/parity/ports/streamdown/mermaid-download.test.test.ts tests/parity/ports/streamdown/mermaid-fullscreen.test.test.ts tests/parity/ports/streamdown/mermaid-utils.test.test.ts tests/parity/ports/streamdown/pan-zoom.test.test.ts tests/parity/ports/streamdown/pan-zoom-interaction.test.test.ts tests/parity/ports/streamdown/final-coverage.test.test.ts tests/parity/ports/streamdown/scroll-lock.test.test.ts
bun run type-check
bun run test:device-contract --silent
bun run docs:verify
bun run changeset:verify
bun run pack:verify-optional-renderers
bun run test --silent
git diff --check
git status --short
```

Expected results:

- all focused tests pass;
- typecheck, device contracts, docs, changeset, and optional-renderer package
  verification exit 0;
- the full Jest suite exits 0. The former PanZoom baseline failure is owned and
  fixed by this plan, so no failure is permitted;
- only in-scope files are changed, the final commit exists, and the isolated
  worktree is clean.

## Done criteria

- [ ] Prefixed valid state, sequence, and flowchart sources route correctly
      while adapters receive the unchanged source.
- [ ] Light/dark changes rerender with theme-derived colors; obsolete results
      are released and cannot reappear or be downloaded.
- [ ] Full-fidelity adapters receive theme context without weakening security
      or overwriting explicit Mermaid config.
- [ ] The toolbar is horizontal and in flow, never over diagram content.
- [ ] Zoom UI appears only with a provider capable of panning enlarged content.
- [ ] Inline and shared fullscreen canvas modes preserve the same truthful
      behavior.
- [ ] Every final verification command has the expected result.

## STOP conditions

Stop and report if:

- any drift-check path differs from `2ad4cdd`;
- theme propagation requires changing `ThemeConfig` or shared UI primitives;
- correct pan behavior appears to require a bundled gesture dependency or a
  core PanResponder/partial scrolling implementation;
- preserving security requires loosening Mermaid SVG or WebView validation;
- fixture theming requires a dependency or lockfile change;
- a verification command fails twice after one reasonable correction;
- any source file outside the explicit scope must change.

## Maintenance notes

- Any future theme-token additions should update the single variable mapping in
  `normalizeBeautifulMermaidSvg`, not add adapter-specific string rewrites.
- Gesture providers remain host-owned. If the project later chooses a standard
  gesture dependency, add a separate optional adapter rather than hiding it in
  core.
- Plan 008 owns simulator screenshots and visual baselines for flowchart,
  state, sequence, light/dark, and fullscreen states.
